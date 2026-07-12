/**
 * globeModels.ts — STAGE E: the monuments stand on the living Earth.
 *
 * Places the exported .glb fleet (public/models/, built by
 * scripts/export-models.mjs from the same buildModel() recipes as the
 * viewer) directly on the Cesium globe: clamped to the ground, scaled to
 * true metres via the fit table, facing their calibrated bearings, appearing
 * as you fly below ~80 km — and obeying the TIMELINE: a monument stands only
 * after it is built (and Atlantis only until she drowns).
 *
 * HEADING CONVERSION (the trap the Stage E brief flags): our models author
 * the front at local +Z, and fitFor().facingDeg stores the three.js
 * rotation θ where the front faces compass bearing B = 180 − θ. Cesium's
 * headingPitchRollQuaternion uses a north-west-up local frame and glTF's
 * y-up→z-up lift, which leaves glTF +Z pointing EAST at heading 0 — so
 * heading = B − 90 = 90 − θ. GLOBE_HEADING_CAL is the one knob to turn if
 * the Captain's Westminster check reads otherwise.
 */
import * as Cesium from 'cesium';
import { fitFor } from './monumentFit';
import { yearToYearsBP } from './timeScale';
import { loadReview, loadLocalTransforms, type ModelTransform } from './review';

/** Calibration trim for the heading conversion — adjust ONCE, off Westminster. */
const GLOBE_HEADING_CAL = 0;

/** Models appear when the camera is nearer than this (metres). */
const REVEAL_DISTANCE = 80_000;

interface Placement {
  model: string;
  title: string;
  lat: number;
  lon: number;
  /** Signed year the monument rises. */
  builtYear: number;
  /** Optional signed year it leaves the world (Atlantis drowns). */
  endYear?: number;
  /** Optional signed year it becomes the ruin we know — from then on the
   * timeline shows the exported `{model}-ruin.glb` instead. */
  ruinYear?: number;
}

// The MVP fleet — the same marquee sites the Workshop calibrated.
const PLACEMENTS: Placement[] = [
  // ruinYear: when the monument became the ruin we know — the casing goes
  // to Cairo's mosques, the earthquake fells the Colosseum's south ring,
  // the Venetian shell guts the Parthenon, the sarsens topple.
  { model: 'giza', title: 'Giza Pyramids', lat: 29.9792, lon: 31.1342, builtYear: -2560, ruinYear: 1356 },
  { model: 'amphitheatre', title: 'Colosseum', lat: 41.8902, lon: 12.4922, builtYear: 80, ruinYear: 1349 },
  { model: 'greek-temple', title: 'Parthenon', lat: 37.9715, lon: 23.7267, builtYear: -438, ruinYear: 1687 },
  { model: 'stonehenge', title: 'Stonehenge', lat: 51.1789, lon: -1.8262, builtYear: -2500, ruinYear: -1500 },
  { model: 'cathedral', title: 'Notre-Dame de Paris', lat: 48.853, lon: 2.3499, builtYear: 1345 },
  // The Paris trio — all of Paris standing together from 1989 onward.
  { model: 'eiffel', title: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, builtYear: 1889 },
  { model: 'arc-triomphe', title: 'Arc de Triomphe', lat: 48.8738, lon: 2.295, builtYear: 1836 },
  // The model includes Pei's glass pyramid, so it stands from the pyramid's
  // year — an 1800s Louvre without it would be the honest earlier form.
  { model: 'louvre', title: 'Louvre', lat: 48.8606, lon: 2.3376, builtYear: 1989 },
  { model: 'westminster', title: 'Palace of Westminster', lat: 51.4995, lon: -0.1248, builtYear: 1860 },
  { model: 'buckingham', title: 'Buckingham Palace', lat: 51.5014, lon: -0.1419, builtYear: 1850 },
  { model: 'london-eye', title: 'London Eye', lat: 51.5033, lon: -0.1196, builtYear: 2000 },
  { model: 'liberty', title: 'Statue of Liberty', lat: 40.6892, lon: -74.0445, builtYear: 1886 },
  { model: 'leaning-tower', title: 'Leaning Tower of Pisa', lat: 43.723, lon: 10.3966, builtYear: 1372 },
  { model: 'aqueduct', title: 'Pont du Gard', lat: 43.9475, lon: 4.535, builtYear: 60 },
  // The flagged hypothesis: the ringed city stands on the Richat from deep
  // prehistory until the deluge of 9600 BCE takes her.
  { model: 'rings', title: 'Atlantis', lat: 21.124, lon: -11.396, builtYear: -11000, endYear: -9600 },
];

const entities: Array<{ entity: Cesium.Entity; p: Placement }> = [];

// Kept module-level so any site — not just the curated fleet — can be placed
// on the globe the moment the visitor asks to see it (`ensurePlacement`).
let theViewer: Cesium.Viewer | null = null;
let theManifest: Record<string, { footprint: number }> = {};
// Last visibility gate, so a just-placed model obeys it immediately.
let lastYearsBP = Number.NEGATIVE_INFINITY;
let lastShowSites = true;

// The Captain's hand-tuned placement trims, loaded from the review file and
// keyed per site — his eyeball is the calibration instrument.
let transforms: Record<string, ModelTransform> = {};

/** Review-file key for one monument's placement trim. */
export function transformKey(model: string, lat: number, lon: number): string {
  return `place:${model}@${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Seat (or re-seat) a monument on the globe: computed placement plus the
 * maker's trim — nudges in metres, extra heading, scale multiplier, and a
 * lift for terrain that swallows an edge. Also the cure for stale ground
 * clamps: re-assigning the position forces Cesium to re-clamp.
 */
function seat(entity: Cesium.Entity, p: Placement): void {
  const info = theManifest[p.model];
  if (!entity.model || !info?.footprint) return;
  const t = transforms[transformKey(p.model, p.lat, p.lon)] ?? {};
  const { widthM, facingDeg } = fitFor(p.title, p.model);
  const mPerDeg = 111_320;
  const lat = p.lat + (t.northM ?? 0) / mPerDeg;
  const lon = p.lon + (t.eastM ?? 0) / (mPerDeg * Math.cos((p.lat * Math.PI) / 180));
  const up = t.upM ?? 0;
  const position = Cesium.Cartesian3.fromDegrees(lon, lat, up);
  entity.position = new Cesium.ConstantPositionProperty(position);
  const heading = Cesium.Math.toRadians(90 - facingDeg + GLOBE_HEADING_CAL + (t.headingDeg ?? 0));
  entity.orientation = new Cesium.ConstantProperty(
    Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(heading, 0, 0)),
  );
  entity.model.scale = new Cesium.ConstantProperty((widthM / info.footprint) * (t.scale ?? 1));
  entity.model.heightReference = new Cesium.ConstantProperty(
    up !== 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
  );
  theViewer?.scene.requestRender();
}

/** Live preview of a trim (maker's Adjust panel) — not persisted here. */
export function applyLiveTransform(model: string, lat: number, lon: number, t: ModelTransform): void {
  transforms[transformKey(model, lat, lon)] = t;
  const found = entities.find(
    (e) => e.p.model === model && Math.abs(e.p.lat - lat) < 0.03 && Math.abs(e.p.lon - lon) < 0.03,
  );
  if (found) seat(found.entity, found.p);
}

/** Terrain provider changed (era crossed the paleo line): every clamped
 * model must re-seat, or it floats at the OLD ground's height. */
export function reseatAll(): void {
  for (const { entity, p } of entities) seat(entity, p);
}

function addPlacement(p: Placement): void {
  const viewer = theViewer;
  const info = theManifest[p.model];
  if (!viewer || !info?.footprint) return;
  const entity = viewer.entities.add({
    id: `mon3d-${p.model}-${p.lat.toFixed(3)}-${p.lon.toFixed(3)}`,
    position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
    model: {
      uri: `./models/${p.model}.glb`,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, REVEAL_DISTANCE),
      // Monuments sleep at night: glTF models carry their own light, so
      // when the Weather & Sky dial darkens the real globe they would
      // otherwise glow against black ground ("raised into the heavens" —
      // the Captain, 2026-07-12). Dim them by local solar time whenever
      // real sun lighting is on.
      color: new Cesium.CallbackProperty(() => {
        const v = theViewer;
        if (!v || !v.scene.globe.enableLighting) return Cesium.Color.WHITE;
        const d = Cesium.JulianDate.toDate(v.clock.currentTime);
        const solar = (d.getUTCHours() + d.getUTCMinutes() / 60 + p.lon / 15 + 24) % 24;
        const day = Math.max(0, Math.min(1, (Math.cos(((solar - 12) / 12) * Math.PI) + 0.3) / 0.9));
        const k = 0.12 + 0.88 * day;
        return new Cesium.Color(k, k, k, 1);
      }, false) as unknown as Cesium.Property,
    },
    show: false, // the timeline decides
  });
  entities.push({ entity, p });
  seat(entity, p);
  gate(entity, p);
}

/** Create the curated monument entities (once, after the viewer exists). */
export async function loadGlobeModels(viewer: Cesium.Viewer): Promise<void> {
  theViewer = viewer;
  try {
    const r = await fetch('./models/manifest.json');
    if (!r.ok) return; // no fleet exported — the globe just shows markers
    theManifest = await r.json();
  } catch {
    return;
  }
  // The maker's saved placement trims ride in the review file (published for
  // everyone)…
  try {
    const review = await loadReview();
    for (const [key, rec] of Object.entries(review)) {
      if (key.startsWith('place:') && rec.transform) transforms[key] = rec.transform;
    }
  } catch {
    /* trims are optional */
  }
  // …and this device's own local tweaks win on top (maker mode, no key).
  Object.assign(transforms, loadLocalTransforms());
  for (const p of PLACEMENTS) addPlacement(p);
}

/**
 * THE GLOBE IS THE VIEWER: place any site's archetype at its own coordinates
 * (once), so "Visit on the globe" always has something standing there.
 * Returns true when a model does (or already did) stand at this spot.
 */
export function ensurePlacement(t: { model: string; title: string; lat: number; lon: number; builtYear?: number }): number | null {
  if (!theViewer || !theManifest[t.model]?.footprint) return null;
  // Already standing here (curated or previously visited)? ~0.03° ≈ 3 km.
  // Return ITS build year — a curated placement's year (e.g. the Eye's 2000)
  // wins over the event's looser date (1999), so the dive nudges to a year
  // where the model is actually born, not a hair before it.
  const existing = entities.find(
    (e) => e.p.model === t.model && Math.abs(e.p.lat - t.lat) < 0.03 && Math.abs(e.p.lon - t.lon) < 0.03,
  );
  if (existing) return existing.p.builtYear;
  const builtYear = t.builtYear ?? -3000;
  addPlacement({ model: t.model, title: t.title, lat: t.lat, lon: t.lon, builtYear });
  return builtYear;
}

/** The live Cesium viewer, for other on-globe stages (battles). */
export function getViewer(): Cesium.Viewer | null {
  return theViewer;
}

function gate(entity: Cesium.Entity, p: Placement): void {
  const born = lastYearsBP <= yearToYearsBP(p.builtYear);
  const gone = p.endYear != null && lastYearsBP < yearToYearsBP(p.endYear);
  entity.show = lastShowSites && born && !gone;
  // Life phases: past its ruin date, the ruin model stands instead.
  if (p.ruinYear != null && entity.model && theManifest[`${p.model}-ruin`]?.footprint) {
    const ruined = lastYearsBP <= yearToYearsBP(p.ruinYear);
    const uri = `./models/${p.model}${ruined ? '-ruin' : ''}.glb`;
    const current = (entity.model.uri as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());
    if (current !== uri) entity.model.uri = new Cesium.ConstantProperty(uri);
  }
}

/** Timeline + layer gate — call whenever the year or the Sites toggle moves. */
export function updateGlobeModelVisibility(currentYearsBP: number, showSites: boolean): void {
  lastYearsBP = currentYearsBP;
  lastShowSites = showSites;
  for (const { entity, p } of entities) gate(entity, p);
}
