/**
 * fauna.ts — the Prehistoric Life layer.
 *
 * Animals from /public/data/fauna.json appear as emoji markers while the
 * timeline is inside their date range. Their positions come from each animal's
 * pre-computed `track` (GPlates point reconstructions), interpolated to the
 * current moment, so a T. rex stands on Cretaceous North America wherever that
 * continent happens to be on the drifting globe.
 */
import * as Cesium from 'cesium';
import type { PanelContent } from '../lib/types';
import { faunaIcon } from '../lib/markerIcons';

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

export class FaunaController {
  private viewer: Cesium.Viewer;
  private entities = new Map<string, Cesium.Entity>();
  private fauna: FaunaEntry[] = [];
  private lastMa = 0;
  private pending: { ma: number; show: boolean } | undefined;

  constructor(viewer: Cesium.Viewer, baseUrl: string) {
    this.viewer = viewer;
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
  }

  /** Called as the timeline moves. `ma` = millions of years before present. */
  update(ma: number, show: boolean) {
    this.pending = { ma, show };
    this.lastMa = ma;
    if (this.viewer.isDestroyed()) return;
    for (const entry of this.fauna) {
      const entity = this.entities.get(entry.id);
      if (!entity) continue;
      const alive = ma <= entry.fromMa && ma >= entry.toMa;
      entity.show = show && alive;
      if (entity.show) {
        const [lon, lat] = trackPos(entry, ma);
        entity.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(lon, lat),
        );
      }
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
    if (!this.viewer.isDestroyed()) {
      for (const e of this.entities.values()) this.viewer.entities.remove(e);
    }
    this.entities.clear();
  }
}
