/**
 * globeBattles.ts — battles fought on the living Earth.
 *
 * Stages a battle's choreography (curated battle-views, or synthesized for
 * any other battle) directly ON the Cesium globe at the real battlefield:
 * army units as ground-clamped points in each side's colour, phase
 * movements animated smoothly, attack arrows as ground-hugging arrow
 * polylines. The real terrain plays itself — Senlac Hill at Hastings is
 * the actual hill on the imagery.
 *
 * GRID → GROUND: the choreography grid is x 0..100 (west→east) by
 * y 0..70 (top→bottom, i.e. north→south — matching the 2D battle view
 * where y grows downward). The grid spans FIELD_M metres of real ground
 * centred on the battle's coordinates.
 */
import * as Cesium from 'cesium';
import type { BattleView } from './types';
import { getViewer } from './globeModels';

/** Real ground the 100-wide choreography grid spans (metres). */
const FIELD_M = 3000;
/** How long a phase movement takes on screen (ms). */
const ANIM_MS = 1600;

interface UnitTrack {
  entity: Cesium.Entity;
  from: Cesium.Cartesian3;
  to: Cesium.Cartesian3;
  t0: number; // performance.now() when the current move started
}

let units = new Map<string, UnitTrack>();
let arrows: Cesium.Entity[] = [];
let site: { lat: number; lon: number } | null = null;
let renderTick = 0;

function gridToPosition(gx: number, gy: number): Cesium.Cartesian3 {
  const { lat, lon } = site!;
  const mPerDeg = 111_320;
  const eastM = (gx - 50) * (FIELD_M / 100);
  const southM = (gy - 35) * (FIELD_M / 100);
  return Cesium.Cartesian3.fromDegrees(
    lon + eastM / (mPerDeg * Math.cos((lat * Math.PI) / 180)),
    lat - southM / mPerDeg,
  );
}

/** Keep Cesium rendering while any unit is still walking its move. */
function pumpFrames(): void {
  const viewer = getViewer();
  if (!viewer) return;
  cancelAnimationFrame(renderTick);
  const step = () => {
    const now = performance.now();
    let busy = false;
    for (const t of units.values()) if (now - t.t0 < ANIM_MS) busy = true;
    viewer.scene.requestRender();
    if (busy) renderTick = requestAnimationFrame(step);
  };
  renderTick = requestAnimationFrame(step);
}

/** Raise the armies at the real battlefield, standing in phase 0. */
export function showBattleOnGlobe(lat: number, lon: number, view: BattleView): void {
  const viewer = getViewer();
  if (!viewer) return;
  endGlobeBattle();
  site = { lat, lon };

  for (const u of view.units) {
    const colour = Cesium.Color.fromCssColorString(view.sides[u.side].color);
    const start = gridToPosition(u.pos[0][0], u.pos[0][1]);
    const track: UnitTrack = { entity: null as unknown as Cesium.Entity, from: start, to: start, t0: 0 };
    const position = new Cesium.CallbackPositionProperty(() => {
      const k = Math.min(1, (performance.now() - track.t0) / ANIM_MS);
      const s = k * k * (3 - 2 * k); // smoothstep — units accelerate then settle
      return Cesium.Cartesian3.lerp(track.from, track.to, s, new Cesium.Cartesian3());
    }, false);
    track.entity = viewer.entities.add({
      id: `gb-unit-${u.id}`,
      position,
      point: {
        pixelSize: 11 * (u.size ?? 1) + 4,
        color: colour,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: u.label,
        font: '11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 25_000),
      },
    });
    units.set(u.id, track);
  }
  setGlobeBattlePhase(view, 0);
}

/** March every unit to its place in phase `idx` and draw that phase's arrows. */
export function setGlobeBattlePhase(view: BattleView, idx: number): void {
  const viewer = getViewer();
  if (!viewer || !site) return;
  const now = performance.now();
  for (const u of view.units) {
    const track = units.get(u.id);
    if (!track) continue;
    const p = u.pos[Math.min(idx, u.pos.length - 1)];
    // Freeze wherever the unit currently stands, then march from there.
    const k = Math.min(1, (now - track.t0) / ANIM_MS);
    const s = k * k * (3 - 2 * k);
    track.from = Cesium.Cartesian3.lerp(track.from, track.to, s, new Cesium.Cartesian3());
    track.to = gridToPosition(p[0], p[1]);
    track.t0 = now;
  }

  for (const a of arrows) viewer.entities.remove(a);
  arrows = [];
  for (const a of view.phases[idx]?.arrows ?? []) {
    const colour = a.side ? Cesium.Color.fromCssColorString(view.sides[a.side].color) : Cesium.Color.WHITE;
    arrows.push(
      viewer.entities.add({
        polyline: {
          positions: [gridToPosition(a.from[0], a.from[1]), gridToPosition(a.to[0], a.to[1])],
          clampToGround: true,
          width: 14,
          material: new Cesium.PolylineArrowMaterialProperty(colour.withAlpha(0.9)),
        },
      }),
    );
  }
  pumpFrames();
}

/** The field falls silent — remove every unit and arrow. */
export function endGlobeBattle(): void {
  const viewer = getViewer();
  cancelAnimationFrame(renderTick);
  if (viewer) {
    for (const t of units.values()) viewer.entities.remove(t.entity);
    for (const a of arrows) viewer.entities.remove(a);
    viewer.scene.requestRender();
  }
  units = new Map();
  arrows = [];
  site = null;
}
