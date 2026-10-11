/**
 * fauna.ts — the Prehistoric Life layer.
 *
 * Animals from /public/data/fauna.json appear as emoji markers while the
 * timeline is inside their date range. Their positions come from each animal's
 * pre-computed `track` (GPlates point reconstructions), interpolated to the
 * current moment, so a T. rex stands on Cretaceous North America wherever that
 * continent happens to be on the drifting globe.
 *
 * FOSSIL RANGES (11 Oct 2026, "show their territories like country borders"):
 * each animal alive at the moment also shows the area around every known find
 * of its kind (public/data/fauna-ranges.json, scripts/build-fauna-ranges.mjs)
 * as a soft tint with a border line in its own colour. It is where fossils are
 * known — not a territory — and the panel says so.
 */
import * as Cesium from 'cesium';
import type { PanelContent } from '../lib/types';
import { faunaIcon } from '../lib/markerIcons';
import { horizonCheck, onCameraTurn } from '../lib/horizon';

interface TrackPoint {
  ma: number;
  lon: number;
  lat: number;
}

export interface FaunaEntry {
  id: string;
  name: string;
  emoji: string;
  lon: number;
  lat: number;
  /** Older bound, millions of years before present. */
  fromMa: number;
  /** Younger bound, millions of years before present. */
  toMa: number;
  region: string;
  blurb: string;
  wiki: string;
  track?: TrackPoint[];
}

/** "0.01" Ma -> "10,000 years ago"; "66" -> "66 million years ago". */
function maLabel(ma: number): string {
  if (ma >= 1) return `${Math.round(ma)} million years ago`;
  return `${Math.round(ma * 1_000_000).toLocaleString()} years ago`;
}

/** Interpolate the reconstructed position at `ma` along the animal's track. */
function trackPos(entry: FaunaEntry, ma: number): [number, number] {
  const track = entry.track;
  if (!track || track.length === 0) return [entry.lon, entry.lat];
  if (ma <= track[0].ma) return [track[0].lon, track[0].lat];
  const last = track[track.length - 1];
  if (ma >= last.ma) return [last.lon, last.lat];
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (ma >= a.ma && ma <= b.ma) {
      const f = (ma - a.ma) / (b.ma - a.ma || 1);
      // Take the short way around if the segment crosses the dateline.
      let dLon = b.lon - a.lon;
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      return [a.lon + dLon * f, a.lat + (b.lat - a.lat) * f];
    }
  }
  return [entry.lon, entry.lat];
}

/** A steady colour per animal, so its range and its border match. */
function rangeColour(id: string): Cesium.Color {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Cesium.Color.fromHsl((h % 360) / 360, 0.65, 0.55);
}

export class FaunaController {
  private viewer: Cesium.Viewer;
  private entities = new Map<string, Cesium.Entity>();
  /** Each animal's fossil-range area entities (fill + border), shown with it. */
  private ranges = new Map<string, Cesium.Entity[]>();
  private fauna: FaunaEntry[] = [];
  private lastMa = 0;
  private pending: { ma: number; show: boolean } | undefined;
  /** Animals alive and switched on at the moment shown (before the horizon). */
  private live = new Set<string>();
  private offCamera: () => void;

  constructor(viewer: Cesium.Viewer, baseUrl: string) {
    this.viewer = viewer;
    this.offCamera = onCameraTurn(viewer, () => this.applyHorizon());
    void this.init(baseUrl);
  }

  private async init(baseUrl: string) {
    try {
      const res = await fetch(`${baseUrl}data/fauna.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { fauna: FaunaEntry[] };
      this.fauna = json.fauna ?? [];
      if (this.viewer.isDestroyed()) return;
      for (const entry of this.fauna) {
        const entity = this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(entry.lon, entry.lat),
          show: false,
          billboard: {
            image: faunaIcon(entry.emoji, entry.id),
            scale: 0.5,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
          label: {
            text: entry.name,
            font: '12px "Segoe UI", sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#d6f5d6'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -34),
          },
        });
        (entity as Cesium.Entity & { chronosFauna?: FaunaEntry }).chronosFauna = entry;
        this.entities.set(entry.id, entity);
      }
      if (this.pending) this.update(this.pending.ma, this.pending.show);
    } catch (err) {
      console.warn('Prehistoric life data unavailable.', err);
    }
    void this.loadRanges(baseUrl);
  }

  private async loadRanges(baseUrl: string) {
    try {
      const res = await fetch(`${baseUrl}data/fauna-ranges.json`);
      if (!res.ok) return; // no ranges built — the markers stand alone
      const json = (await res.json()) as Record<string, Array<Array<[number, number]>>>;
      if (this.viewer.isDestroyed()) return;
      for (const [id, areas] of Object.entries(json)) {
        if (id === '_comment' || !Array.isArray(areas)) continue;
        const c = rangeColour(id);
        const list: Cesium.Entity[] = [];
        for (const ring of areas) {
          if (!Array.isArray(ring) || ring.length < 3) continue;
          const flat = ring.flat();
          list.push(this.viewer.entities.add({
            show: false,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat)),
              material: c.withAlpha(0.16),
              classificationType: Cesium.ClassificationType.TERRAIN,
            },
          }));
          list.push(this.viewer.entities.add({
            show: false,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray([...flat, ring[0][0], ring[0][1]]),
              width: 2,
              material: c.withAlpha(0.85),
              clampToGround: true,
            },
          }));
        }
        // Clicking the area opens the animal, exactly as its marker does
        // (the Captain: "the dino areas don't allow you to click on them").
        const entry = this.fauna.find((a) => a.id === id);
        if (entry) for (const e of list) (e as Cesium.Entity & { chronosFauna?: FaunaEntry }).chronosFauna = entry;
        if (list.length) this.ranges.set(id, list);
      }
      if (this.pending) this.update(this.pending.ma, this.pending.show);
    } catch {
      /* ranges are an extra — never break the layer */
    }
  }

  /** Called as the timeline moves. `ma` = millions of years before present. */
  update(ma: number, show: boolean) {
    this.pending = { ma, show };
    this.lastMa = ma;
    if (this.viewer.isDestroyed()) return;
    // Animals found at the SAME fossil site share a spot (the Burgess Shale's
    // Anomalocaris, Hallucigenia and Opabinia): fan their icons side by side
    // and stack their labels, or the three names print on top of each other.
    const spots = new Map<string, Cesium.Entity[]>();
    this.live.clear();
    for (const entry of this.fauna) {
      const entity = this.entities.get(entry.id);
      if (!entity) continue;
      const on = show && ma <= entry.fromMa && ma >= entry.toMa;
      if (on) {
        this.live.add(entry.id);
        const [lon, lat] = trackPos(entry, ma);
        entity.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(lon, lat),
        );
        const key = `${Math.round(lon * 3)}|${Math.round(lat * 3)}`; // ~1/3° cells
        spots.set(key, [...(spots.get(key) ?? []), entity]);
      }
      for (const r of this.ranges.get(entry.id) ?? []) r.show = on;
    }
    for (const group of spots.values()) {
      group.forEach((entity, i) => {
        const dx = (i - (group.length - 1) / 2) * 22;
        if (entity.billboard) entity.billboard.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(dx, 0));
        if (entity.label) entity.label.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -34 - 15 * i));
      });
    }
    this.applyHorizon();
  }

  /** Show the live animals whose spot faces the camera (lib/horizon). */
  private applyHorizon() {
    if (this.viewer.isDestroyed()) return;
    const visible = horizonCheck(this.viewer);
    const now = this.viewer.clock.currentTime;
    for (const [id, entity] of this.entities) {
      const pos = this.live.has(id) ? entity.position?.getValue(now) : undefined;
      const show = !!pos && visible(pos);
      if (entity.show !== show) entity.show = show;
    }
  }

  /** Build the info panel for a clicked animal. */
  panelFor(entry: FaunaEntry): PanelContent {
    const [lon, lat] = trackPos(entry, this.lastMa);
    return {
      kicker: 'Prehistoric life',
      title: `${entry.emoji} ${entry.name}`,
      date: `${maLabel(entry.fromMa)} – ${maLabel(entry.toMa)}`,
      summary: entry.blurb,
      sections: [
        {
          heading: 'Where the fossils were found',
          body: `${entry.region}. The marker follows this spot as the continents drift.`,
        },
        ...(this.ranges.has(entry.id)
          ? [{
              heading: 'The shaded area',
              body: 'Everywhere its fossils have been found (Paleobiology Database), moved to where those places were in its time. It shows where the evidence is — not how far it roamed.',
            }]
          : []),
      ],
      links: [
        {
          label: `Wikipedia: ${entry.name}`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(entry.wiki.replace(/ /g, '_'))}`,
        },
      ],
      fly: { lon, lat, altitude: 6_000_000 },
    };
  }

  dispose() {
    this.offCamera();
    if (!this.viewer.isDestroyed()) {
      for (const e of this.entities.values()) this.viewer.entities.remove(e);
      for (const list of this.ranges.values()) for (const e of list) this.viewer.entities.remove(e);
    }
    this.entities.clear();
    this.ranges.clear();
  }
}
