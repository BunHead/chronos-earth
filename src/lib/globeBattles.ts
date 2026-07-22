/**
 * globeBattles.ts — battles fought on the living Earth.
 *
 * Stages a battle's choreography (curated battle-views, or synthesized for
 * any other battle) directly ON the Cesium globe at the real battlefield:
 * army units as ground-clamped icon billboards in each side's colour, phase
 * movements animated smoothly, attack arrows as ground-hugging arrow
 * polylines — and the field breathes: marching units kick up dust (ships
 * cut white wakes), and every clash point burns with flickering fire and
 * smoke. Billboard sprites only — the one primitive this Cesium build
 * renders reliably (see disasterFx.ts).
 *
 * GRID → GROUND: the choreography grid is x 0..100 (west→east) by
 * y 0..70 (top→bottom, i.e. north→south — matching the 2D battle view
 * where y grows downward). The grid spans FIELD_M metres of real ground
 * centred on the battle's coordinates.
 */
import * as Cesium from 'cesium';
import type { BattleUnit, BattleView } from './types';
import { getViewer } from './globeModels';
import { clampDensity, figureCount, keepFraction } from './battleMath';

/** Real ground the 100-wide choreography grid spans (metres). */
const FIELD_M = 3000;
/** How long a phase movement takes on screen (ms). */
const ANIM_MS = 1600;

/**
 * How crowded the formations are, from the viewer's setting. A unit is drawn
 * as a BLOCK of little figures rather than one marker, so this is the dial
 * between "readable on a machine with no graphics card" and a crowded field.
 * Read when a battle is staged; changing it restages.
 */
let figureDensity = 1;

export function setBattleFigureDensity(d: number): void {
  figureDensity = clampDensity(d);
}

export function battleFigureDensity(): number {
  return figureDensity;
}

/** Effects shrink as you pull back so the terrain always stays readable
 * (the Captain's D-Day was disappearing under its own smoke). */
function fxScaleByDistance(): Cesium.NearFarScalar {
  return new Cesium.NearFarScalar(1_500, 1, 18_000, 0.3);
}
function fxFadeByDistance(): Cesium.NearFarScalar {
  return new Cesium.NearFarScalar(9_000, 1, 30_000, 0);
}

/* ---- sprite artwork (tiny canvases, built lazily so tests never touch DOM) ---- */

function glowCanvas(inner: string, outer: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(48, 48, 3, 48, 48, 46);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 96, 96);
  return c;
}

const sprites: Record<string, HTMLCanvasElement> = {};
function sprite(kind: 'dust' | 'wake' | 'fire' | 'smoke'): HTMLCanvasElement {
  if (!sprites[kind]) {
    sprites[kind] =
      kind === 'dust'
        ? glowCanvas('rgba(190,160,115,0.85)', 'rgba(190,160,115,0)')
        : kind === 'wake'
          ? glowCanvas('rgba(240,248,255,0.9)', 'rgba(240,248,255,0)')
          : kind === 'fire'
            ? glowCanvas('rgba(255,225,130,0.95)', 'rgba(255,80,20,0)')
            : glowCanvas('rgba(95,95,100,0.75)', 'rgba(95,95,100,0)');
  }
  return sprites[kind];
}

/** The unit's badge: a disc in its side's colour with a glyph for its kind. */
const GLYPH: Record<NonNullable<BattleUnit['shape']> | 'block', string> = {
  block: '⚔',
  cavalry: '🐎',
  ship: '⛵',
  vehicle: '🚙',
  plane: '✈',
};
const icons = new Map<string, HTMLCanvasElement>();
/**
 * One FIGURE in a formation — the little man (or horse, ship, tank, plane)
 * that a block is built from. Smaller and plainer than the old one-marker-
 * per-unit icon: at a block of twenty the glyph is what reads, not a ring.
 */
function figureIcon(shape: BattleUnit['shape'], colour: string): HTMLCanvasElement {
  const key = `fig|${shape ?? 'block'}|${colour}`;
  let c = icons.get(key);
  if (c) return c;
  const px = shape === 'block' || shape === 'cavalry' || !shape ? 18 : 24;
  c = document.createElement('canvas');
  c.width = c.height = px + 6;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(c.width / 2, c.height / 2, px / 2, 0, Math.PI * 2);
  g.fillStyle = colour;
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.stroke();
  g.font = `${Math.round(px * 0.72)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(GLYPH[shape ?? 'block'], c.width / 2, c.height / 2 + 1);
  icons.set(key, c);
  return c;
}

/**
 * Lay `count` figures out in ranks and files, centred on the unit's grid
 * position. Returned offsets are in GRID units (1 grid unit = FIELD_M/100
 * metres of real ground), so cavalry and ships stand further apart than foot.
 */
function formationOffsets(shape: BattleUnit['shape'], count: number): Array<[number, number]> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));
  const rows = Math.ceil(count / cols);
  const sp =
    shape === 'ship' ? 1.6 : shape === 'plane' ? 1.9 : shape === 'vehicle' ? 1.3 : shape === 'cavalry' ? 0.85 : 0.6;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // Odd ranks step half a file across so the block reads as a crowd
    // rather than a lattice.
    const stagger = r % 2 ? sp * 0.5 : 0;
    out.push([(c - (cols - 1) / 2) * sp + stagger, (r - (rows - 1) / 2) * sp]);
  }
  return out;
}

/* ---- the staged battle ---- */

/** One man (or ship, or tank) in a formation, with his own place in the ranks. */
interface FigureTrack {
  entity: Cesium.Entity;
  ox: number; // his offset from the formation centre, in grid units
  oy: number;
  from: Cesium.Cartesian3;
  to: Cesium.Cartesian3;
}

interface UnitTrack {
  /** Carries the unit's name; sits at the centre of the block. */
  entity: Cesium.Entity;
  dust: Cesium.Entity;
  figures: FigureTrack[];
  side: 'a' | 'b';
  shape: BattleUnit['shape'];
  fullCount: number;
  from: Cesium.Cartesian3;
  to: Cesium.Cartesian3;
  t0: number; // performance.now() when the current move started
}

let units = new Map<string, UnitTrack>();
let arrows: Cesium.Entity[] = [];
let fires: Cesium.Entity[] = [];
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

function moveProgress(t: UnitTrack): number {
  const k = Math.min(1, (performance.now() - t.t0) / ANIM_MS);
  return k * k * (3 - 2 * k); // smoothstep — accelerate, then settle
}

/** The battlefield breathes as long as it is staged: keep frames coming so
 * the callback properties (marching, dust, fire flicker) stay alive. */
function pumpFrames(): void {
  const viewer = getViewer();
  if (!viewer) return;
  cancelAnimationFrame(renderTick);
  const step = () => {
    if (!site) return;
    viewer.scene.requestRender();
    renderTick = requestAnimationFrame(step);
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
    const colour = view.sides[u.side].color;
    const start = gridToPosition(u.pos[0][0], u.pos[0][1]);
    const count = figureCount(u.shape, u.size ?? 1, figureDensity);
    const track: UnitTrack = {
      entity: null as unknown as Cesium.Entity,
      dust: null as unknown as Cesium.Entity,
      figures: [],
      side: u.side,
      shape: u.shape,
      fullCount: count,
      from: start,
      to: start,
      t0: 0,
    };
    const position = new Cesium.CallbackPositionProperty(
      () => Cesium.Cartesian3.lerp(track.from, track.to, moveProgress(track), new Cesium.Cartesian3()),
      false,
    );

    // THE BLOCK: one sprite per figure, each holding his own place in the
    // ranks as the whole formation marches. Billboards only — the one
    // primitive this Cesium build renders reliably.
    const figImage = figureIcon(u.shape, colour);
    for (const [ox, oy] of formationOffsets(u.shape, count)) {
      const fig: FigureTrack = {
        entity: null as unknown as Cesium.Entity,
        ox,
        oy,
        from: gridToPosition(u.pos[0][0] + ox, u.pos[0][1] + oy),
        to: gridToPosition(u.pos[0][0] + ox, u.pos[0][1] + oy),
      };
      fig.entity = viewer.entities.add({
        position: new Cesium.CallbackPositionProperty(
          () => Cesium.Cartesian3.lerp(fig.from, fig.to, moveProgress(track), new Cesium.Cartesian3()),
          false,
        ),
        billboard: {
          image: figImage,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance: new Cesium.NearFarScalar(2_000, 1, 25_000, 0.5),
        },
      });
      track.figures.push(fig);
    }

    // The unit's NAME rides at the centre of its block (no marker of its
    // own now — the men are the marker).
    track.entity = viewer.entities.add({
      id: `gb-unit-${u.id}`,
      position,
      label: {
        text: u.label,
        font: '11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 12),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 25_000),
      },
    });
    // The dust (or wake) trails a beat behind the unit and only shows while
    // it marches — progress < 1 means boots (or hulls) are churning ground.
    const trail = new Cesium.CallbackPositionProperty(
      () =>
        Cesium.Cartesian3.lerp(
          track.from,
          track.to,
          Math.max(0, moveProgress(track) - 0.12),
          new Cesium.Cartesian3(),
        ),
      false,
    );
    track.dust = viewer.entities.add({
      id: `gb-dust-${u.id}`,
      position: trail,
      billboard: {
        image: sprite(u.shape === 'ship' ? 'wake' : u.shape === 'plane' ? 'smoke' : 'dust'),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: fxScaleByDistance(),
        translucencyByDistance: fxFadeByDistance(),
        scale: new Cesium.CallbackProperty(() => {
          const p = moveProgress(track);
          return p >= 1 ? 0 : 0.45 + p * 0.7;
        }, false) as unknown as Cesium.Property,
        color: new Cesium.CallbackProperty(() => {
          const p = moveProgress(track);
          return Cesium.Color.WHITE.withAlpha(p >= 1 ? 0 : 0.55 * (1 - p * 0.6));
        }, false) as unknown as Cesium.Property,
      },
    });
    units.set(u.id, track);
  }
  setGlobeBattlePhase(view, 0);
  pumpFrames();
  if (import.meta.env.DEV) {
    (window as unknown as { __gb?: object }).__gb = {
      density: () => figureDensity,
      /** [figures standing, figures fielded] per unit — the field, countable. */
      counts: () =>
        [...units.entries()].map(([id, t]) => [id, t.figures.filter((f) => f.entity.show).length, t.fullCount]),
    };
  }
}

/** March every unit to its place in phase `idx`, draw that phase's arrows,
 * and set the clash points burning. */
export function setGlobeBattlePhase(view: BattleView, idx: number): void {
  const viewer = getViewer();
  if (!viewer || !site) return;
  const now = performance.now();
  // How far through the battle we are — the ranks thin as it wears on, and
  // the beaten side thins roughly twice as fast.
  const frac = Math.min(1, idx / Math.max(1, view.phases.length - 1));
  for (const u of view.units) {
    const track = units.get(u.id);
    if (!track) continue;
    const p = u.pos[Math.min(idx, u.pos.length - 1)];
    // Freeze wherever the unit currently stands, then march from there.
    const held = moveProgress(track);
    track.from = Cesium.Cartesian3.lerp(track.from, track.to, held, new Cesium.Cartesian3());
    track.to = gridToPosition(p[0], p[1]);
    for (const fig of track.figures) {
      fig.from = Cesium.Cartesian3.lerp(fig.from, fig.to, held, new Cesium.Cartesian3());
      fig.to = gridToPosition(p[0] + fig.ox, p[1] + fig.oy);
    }
    track.t0 = now;

    // BATTLES COST MEN: show only what is still standing. The fallen simply
    // stop being drawn, from the back rank forward.
    const standing = Math.max(
      2,
      Math.round(track.fullCount * keepFraction(frac, view.loser === track.side, view.severity)),
    );
    for (let i = 0; i < track.figures.length; i++) track.figures[i].entity.show = i < standing;
  }

  for (const a of arrows) viewer.entities.remove(a);
  for (const f of fires) viewer.entities.remove(f);
  arrows = [];
  fires = [];
  const phaseArrows = view.phases[idx]?.arrows ?? [];
  for (const a of phaseArrows) {
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
    // Where the arrow strikes, the fighting burns: flickering fire under a
    // slower curl of smoke, phased differently per clash point.
    const seed = Math.abs(a.to[0] * 7 + a.to[1] * 13);
    const at = gridToPosition(a.to[0], a.to[1]);
    fires.push(
      viewer.entities.add({
        position: at,
        billboard: {
          image: sprite('fire'),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: fxScaleByDistance(),
          translucencyByDistance: fxFadeByDistance(),
          scale: new Cesium.CallbackProperty(
            () => 0.45 + 0.15 * Math.sin(performance.now() / 90 + seed),
            false,
          ) as unknown as Cesium.Property,
          color: new Cesium.CallbackProperty(
            () => Cesium.Color.WHITE.withAlpha(0.55 + 0.25 * Math.sin(performance.now() / 130 + seed * 2)),
            false,
          ) as unknown as Cesium.Property,
        },
      }),
      viewer.entities.add({
        position: at,
        billboard: {
          image: sprite('smoke'),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          pixelOffset: new Cesium.Cartesian2(5, -12),
          scaleByDistance: fxScaleByDistance(),
          translucencyByDistance: fxFadeByDistance(),
          scale: new Cesium.CallbackProperty(
            () => 0.8 + 0.25 * Math.sin(performance.now() / 700 + seed),
            false,
          ) as unknown as Cesium.Property,
          color: new Cesium.CallbackProperty(
            () => Cesium.Color.WHITE.withAlpha(0.2 + 0.1 * Math.sin(performance.now() / 900 + seed)),
            false,
          ) as unknown as Cesium.Property,
        },
      }),
    );
  }
}

/** The field falls silent — remove every unit, arrow, dust cloud and fire. */
export function endGlobeBattle(): void {
  const viewer = getViewer();
  cancelAnimationFrame(renderTick);
  if (viewer) {
    for (const t of units.values()) {
      viewer.entities.remove(t.entity);
      viewer.entities.remove(t.dust);
      for (const f of t.figures) viewer.entities.remove(f.entity);
    }
    for (const a of arrows) viewer.entities.remove(a);
    for (const f of fires) viewer.entities.remove(f);
    viewer.scene.requestRender();
  }
  units = new Map();
  arrows = [];
  fires = [];
  site = null;
}
