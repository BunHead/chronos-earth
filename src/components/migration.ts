/**
 * migration.ts — "Out of Africa": the spread of Homo sapiens.
 *
 * The Captain (11 Oct 2026): "does this have the human migration from Africa
 * represented in the same way?" — the same way as the fossil ranges. Dated
 * sites from public/data/human-migration.json appear once the timeline
 * reaches their date; the area around every site reached so far is drawn as
 * a tint with a border (lib/rangeGeometry), and a thin line joins each site
 * to the earlier evidence it follows from. The lines join EVIDENCE in date
 * order — they are not mapped routes, and the panel says so.
 *
 * Shown with the Prehistoric life layer, from 315,000 years ago until
 * 10,000 years ago — after the last site, as farming and recorded history
 * take over. With no end it sat on the globe right up to 2000 CE (the
 * Captain, 11 Oct 2026: "a yellow border seems to have got stuck").
 */
import * as Cesium from 'cesium';
import { readableLabel } from '../lib/labelStyle';
import type { PanelContent } from '../lib/types';
import { faunaIcon } from '../lib/markerIcons';
import { areaAround, clusterPoints, type LonLat } from '../lib/rangeGeometry';
import { horizonCheck, onCameraTurn } from '../lib/horizon';

export interface MigrationSite {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  /** Years before present — the date the evidence gives. */
  yearsAgo: number;
  wiki: string;
  note: string;
}

/** Which earlier evidence each site follows from (for the joining lines). */
const FOLLOWS: Record<string, string> = {
  misliya: 'omo-kibish',
  'skhul-qafzeh': 'misliya',
  madjedbebe: 'skhul-qafzeh',
  'ust-ishim': 'skhul-qafzeh',
  'bacho-kiro': 'skhul-qafzeh',
  tianyuan: 'ust-ishim',
  'lake-mungo': 'madjedbebe',
  'white-sands': 'tianyuan',
  'monte-verde': 'white-sands',
};

/** Finds closer than this share one area (degrees). */
const LINK_DEG = 45;
/** The margin drawn around each find (degrees). */
const MARGIN_DEG = 4;
/** The layer closes here (years ago): the spread is told, history takes over. */
const MIGRATION_ENDS_YEARS_AGO = 10_000;
const COLOUR = Cesium.Color.fromCssColorString('#f0a33a');

/** 315000 -> "315,000 years ago". */
const agoLabel = (y: number) => `${y.toLocaleString()} years ago`;

export class MigrationController {
  private viewer: Cesium.Viewer;
  private sites: MigrationSite[] = [];
  private pins = new Map<string, Cesium.Entity>();
  private lines = new Map<string, Cesium.Entity>();
  private areas: Cesium.Entity[] = [];
  /** The set of sites the drawn areas were built for. */
  private areaKey = '';
  private pending: { yearsBP: number; show: boolean } | undefined;
  /** Sites reached and switched on at the moment shown (before the horizon). */
  private live = new Set<string>();
  private offCamera: () => void;

  constructor(viewer: Cesium.Viewer, baseUrl: string) {
    this.viewer = viewer;
    this.offCamera = onCameraTurn(viewer, () => this.applyHorizon());
    void this.init(baseUrl);
  }

  private async init(baseUrl: string) {
    try {
      const res = await fetch(`${baseUrl}data/human-migration.json`);
      if (!res.ok) return;
      const json = (await res.json()) as { sites: MigrationSite[] };
      this.sites = (json.sites ?? []).sort((a, b) => b.yearsAgo - a.yearsAgo);
      if (this.viewer.isDestroyed()) return;
      this.sites.forEach((s, i) => {
        // Sites a few km apart (Misliya and Skhul, 40 km) stack their labels.
        const stack = this.sites.slice(0, i).filter((o) => Math.abs(o.lon - s.lon) < 1 && Math.abs(o.lat - s.lat) < 1).length;
        const pin = this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat),
          show: false,
          billboard: {
            image: faunaIcon('🧍', `human-${s.id}`),
            scale: 0.5,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
          label: {
            text: s.name,
            font: '600 12px "Segoe UI", sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#ffe2b8'),
            ...readableLabel(),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -34 - 15 * stack),
          },
        });
        (pin as Cesium.Entity & { chronosMigration?: MigrationSite }).chronosMigration = s;
        this.pins.set(s.id, pin);
        const from = this.sites.find((o) => o.id === FOLLOWS[s.id]);
        if (from) {
          const line = this.viewer.entities.add({
            show: false,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray([from.lon, from.lat, s.lon, s.lat]),
              width: 2,
              arcType: Cesium.ArcType.GEODESIC,
              material: new Cesium.PolylineDashMaterialProperty({ color: COLOUR.withAlpha(0.8), dashLength: 14 }),
              clampToGround: true,
            },
          });
          (line as Cesium.Entity & { chronosMigration?: MigrationSite }).chronosMigration = s;
          this.lines.set(s.id, line);
        }
      });
      if (this.pending) this.update(this.pending.yearsBP, this.pending.show);
    } catch (err) {
      console.warn('Human migration data unavailable.', err);
    }
  }

  /** Sites whose evidence is at least as old as the moment shown. */
  private reached(yearsBP: number): MigrationSite[] {
    return this.sites.filter((s) => s.yearsAgo >= yearsBP);
  }

  /** Called as the timeline moves. */
  update(yearsBP: number, show: boolean) {
    this.pending = { yearsBP, show };
    if (this.viewer.isDestroyed() || !this.sites.length) return;
    const on = show && yearsBP <= this.sites[0].yearsAgo && yearsBP >= MIGRATION_ENDS_YEARS_AGO;
    const reached = on ? this.reached(yearsBP) : [];
    const ids = new Set(reached.map((s) => s.id));
    this.live = ids;
    this.applyHorizon();
    for (const [id, line] of this.lines) line.show = ids.has(id);
    const key = reached.map((s) => s.id).join('|');
    if (key === this.areaKey) return;
    this.areaKey = key;
    for (const e of this.areas) this.viewer.entities.remove(e);
    this.areas = [];
    const pts: LonLat[] = reached.map((s) => [s.lon, s.lat]);
    for (const group of clusterPoints(pts, LINK_DEG)) {
      const ring = areaAround(group, MARGIN_DEG);
      if (ring.length < 3) continue;
      const flat = ring.flat();
      // A click on the area opens the newest site inside it.
      const newest = reached
        .filter((s) => group.some(([lo, la]) => lo === s.lon && la === s.lat))
        .sort((a, b) => a.yearsAgo - b.yearsAgo)[0];
      const fill = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat)),
          material: COLOUR.withAlpha(0.22),
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
      });
      const border = this.viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([...flat, ring[0][0], ring[0][1]]),
          width: 3,
          material: COLOUR.withAlpha(0.9),
          clampToGround: true,
        },
      });
      for (const e of [fill, border]) (e as Cesium.Entity & { chronosMigration?: MigrationSite }).chronosMigration = newest;
      this.areas.push(fill, border);
    }
  }

  /** Show the reached sites whose spot faces the camera (lib/horizon). */
  private applyHorizon() {
    if (this.viewer.isDestroyed()) return;
    const visible = horizonCheck(this.viewer);
    for (const s of this.sites) {
      const pin = this.pins.get(s.id);
      if (!pin) continue;
      const show = this.live.has(s.id) && visible(Cesium.Cartesian3.fromDegrees(s.lon, s.lat));
      if (pin.show !== show) pin.show = show;
    }
  }

  /** Build the info panel for a clicked site, area or line. */
  panelFor(site: MigrationSite, yearsBP: number): PanelContent {
    const from = this.sites.find((o) => o.id === FOLLOWS[site.id]);
    const reached = this.reached(Math.min(yearsBP, site.yearsAgo));
    return {
      kicker: 'Out of Africa — early modern humans',
      title: `${site.name}, ${site.region}`,
      date: agoLabel(site.yearsAgo),
      summary: site.note,
      wikiTitle: site.wiki,
      sections: [
        {
          heading: 'The shaded area',
          body: 'The area around every dated site of Homo sapiens reached by the moment shown. It shows where the evidence is — not where people lived or how they travelled. New finds keep pushing these dates back. The layer closes 10,000 years ago, when farming and recorded history take over.',
        },
        ...(from
          ? [{
              heading: 'The dashed line',
              body: `Joins this site to earlier evidence at ${from.name} (${agoLabel(from.yearsAgo)}). It links the finds in date order; it is not a mapped route.`,
            }]
          : []),
        {
          heading: `Sites reached by then (${reached.length})`,
          body: reached.map((s) => `${s.name} — ${agoLabel(s.yearsAgo)}`).join('; ') + '.',
        },
      ],
      links: [
        { label: `Wikipedia: ${site.wiki}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(site.wiki.replace(/ /g, '_'))}` },
        { label: 'Wikipedia: Recent African origin of modern humans', url: 'https://en.wikipedia.org/wiki/Recent_African_origin_of_modern_humans' },
      ],
      fly: { lon: site.lon, lat: site.lat, altitude: 6_000_000 },
    };
  }

  dispose() {
    this.offCamera();
    if (!this.viewer.isDestroyed()) {
      for (const e of [...this.pins.values(), ...this.lines.values(), ...this.areas]) this.viewer.entities.remove(e);
    }
    this.pins.clear();
    this.lines.clear();
    this.areas = [];
  }
}
