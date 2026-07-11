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
}

// The MVP fleet — the same marquee sites the Workshop calibrated.
const PLACEMENTS: Placement[] = [
  { model: 'giza', title: 'Giza Pyramids', lat: 29.9792, lon: 31.1342, builtYear: -2560 },
  { model: 'amphitheatre', title: 'Colosseum', lat: 41.8902, lon: 12.4922, builtYear: 80 },
  { model: 'greek-temple', title: 'Parthenon', lat: 37.9715, lon: 23.7267, builtYear: -438 },
  { model: 'stonehenge', title: 'Stonehenge', lat: 51.1789, lon: -1.8262, builtYear: -2500 },
  { model: 'cathedral', title: 'Notre-Dame de Paris', lat: 48.853, lon: 2.3499, builtYear: 1345 },
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

/** Create the monument entities (once, after the viewer exists). */
export async function loadGlobeModels(viewer: Cesium.Viewer): Promise<void> {
  let manifest: Record<string, { footprint: number }> = {};
  try {
    const r = await fetch('./models/manifest.json');
    if (!r.ok) return; // no fleet exported — the globe just shows markers
    manifest = await r.json();
  } catch {
    return;
  }
  for (const p of PLACEMENTS) {
    const info = manifest[p.model];
    if (!info?.footprint) continue;
    const { widthM, facingDeg } = fitFor(p.title, p.model);
    const scale = widthM / info.footprint;
    const heading = Cesium.Math.toRadians(90 - facingDeg + GLOBE_HEADING_CAL);
    const position = Cesium.Cartesian3.fromDegrees(p.lon, p.lat);
    const entity = viewer.entities.add({
      id: `mon3d-${p.model}`,
      position,
      orientation: new Cesium.ConstantProperty(
        Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(heading, 0, 0)),
      ),
      model: {
        uri: `./models/${p.model}.glb`,
        scale,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, REVEAL_DISTANCE),
      },
      show: false, // the timeline decides
    });
    entities.push({ entity, p });
  }
}

/** Timeline + layer gate — call whenever the year or the Sites toggle moves. */
export function updateGlobeModelVisibility(currentYearsBP: number, showSites: boolean): void {
  for (const { entity, p } of entities) {
    const born = currentYearsBP <= yearToYearsBP(p.builtYear);
    const gone = p.endYear != null && currentYearsBP < yearToYearsBP(p.endYear);
    entity.show = showSites && born && !gone;
  }
}
