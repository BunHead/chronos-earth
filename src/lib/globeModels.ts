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
import WESTMINSTER_PLAN from '../data/westminster-plan.json';
import BUCKINGHAM_PLAN from '../data/buckingham-plan.json';
import { periodGround, periodTrees, PERIOD_GROUND_UNTIL } from './buckinghamGround';
import * as Cesium from 'cesium';
import { fitFor, curatedCovers } from './monumentFit';
import { eclipseLightFactor } from './eclipseDim';
import { yearToYearsBP, yearsBPToYear } from './timeScale';
import { loadReview, loadLocalTransforms, type ModelTransform } from './review';
import { STAGE_TABLE, buildStages, stageFor } from './stageTable';
import { isBuilderActive, sitePlanNear, supplantSitePlans } from './sitePlanRender';
import MESO_TEMPLES from '../data/meso-temples.json';
import { budgetTier } from './renderTier';
import { lightModelName, preferSmallModels } from './liteMode';
import { estuaryRibbon } from './atlantisVision';
import { createModelLoadWatch, type LoadState, type ModelLoad, type ModelLoadWatch } from './modelLoadWatch';

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
  /** Years of CONSTRUCTION before builtYear — the monument rises course by
   * course over this span, swapping through exported `{model}-b30/-b60/-b90`
   * stages before standing complete at builtYear. */
  buildYears?: number;
  /** Metres to sink the model below the clamped ground — for a model that
   * carries its own landform (Machu Picchu's ridge), so it sits INTO the real
   * terrain instead of standing on it as a raised plinth. The maker's upM trim
   * still adds on top. */
  sinkM?: number;
  /** Optional [from, until) signed years the monument lies BURIED and is not
   * shown — the Terracotta Army, burned and buried in 206 BCE, dug up 1974. */
  buried?: [number, number];
  /** Patches of plain ground laid over the satellite photo until the photo
   * comes TRUE. The photo is today's site, so at a stand-alone monument its
   * stones showed through a half-built Stonehenge, and Giza's pyramids and
   * Stonehenge's circle stood in the photo long BEFORE they were built (the
   * Captain, 11 Oct 2026). Covered from the dawn of time until the ruin date
   * (the ruin model stands on the real photo), or the build date for a
   * monument with no ruin. Each patch is [lat, lon, radius m] in the ground's
   * own colour, sampled from the rendered photo. City monuments get none: the
   * whole city around them is a modern photo anyway. until 'built': a SOLID
   * finished model hides the photo's monument by itself (Giza's pyramids sit
   * on the real ones to ~20 m, measured top-down), so cover only until it
   * stands complete — not around it for 4,000 years. */
  cover?: { rgb: [number, number, number]; at: Array<[number, number, number]>;
    /** When the photo comes true: the build year ('built') or a year of its own. */
    until?: 'built' | number;
    /** Exact plan-shaped patches instead of discs: rings of [lat, lon]. */
    poly?: Array<Array<[number, number]>>;
    /** A colour per poly ring (falls back to rgb): e.g. a gravel forecourt. */
    polyRgb?: Array<[number, number, number] | undefined>;
    /** An alpha (0-1) per poly ring, for feathered edges that fade into the
     * photo (Buckingham's period lawn and roads); solid otherwise. */
    polyAlpha?: Array<number | undefined>;
    /** A year window per poly ring, inside the cover's own: shown from
     * polyFrom[i] and only before polyUntil[i] (the cover's `until` otherwise).
     * Buckingham's period ground goes when the Memorial's roads come (1911). */
    polyFrom?: Array<number | undefined>;
    polyUntil?: Array<number | undefined>;
    /** Drape these rings on the terrain even on a `flat` cover: a long road
     * (the old Mall, Constitution Hill) runs over too much rise for one sheet. */
    polyDrape?: boolean[];
    /** Period trees on the cover ([lat, lon, crown radius m, height m, leaf
     * tone]), standing until treesUntil (Buckingham's park before the Memorial). */
    trees?: Array<[number, number, number, number, number?]>;
    treesUntil?: number;
    /** Lay the poly rings flat FLAT_COVER_M above the ground at their centre
     * instead of draping them (terrain classification). A draped patch whose
     * edge meets ground dropping to a river draws its shadow volume as thin
     * vertical streaks down into the water (Westminster's embankment, 19 Oct
     * 2026); a flat sheet has no volume. Only for a level site. */
    flat?: boolean };
  /** Radius (m) of the ring whose ground the monument stands on — default
   * half its width + 40 m. Giza's model is the whole 1 km plateau but anchors
   * at Khufu, so it reads the plateau round Khufu, not the Nile-side edge. */
  baseRingM?: number;
  /** [E–W, N–S] metres of TERRAIN to cut away and floor flat (in the cover
   * colour) until builtYear. The terrain is a surface model that holds the real
   * pyramids themselves (THE BUMP, below): before and while one is built, its
   * 140 m terrain hill stood there under the half-built course (the Captain's
   * Giza redo, 15 Oct 2026). Square, north-aligned, centred on lat/lon. */
  clipM?: [number, number];
  /** Keep the clipM cut at every date, not only until builtYear (the great
   * pyramids: the surface model's hill pokes through their stripped ruins). */
  clipAlways?: boolean;
  /** Added on the fly by ensurePlacement (a site visited on the globe), not
   * from the curated list — a curated placement at the same spot replaces it. */
  generic?: boolean;
}

// The Giza pyramids and queens' pyramids (see PLACEMENTS). built = complete;
// buildYears = the rise before it; clip = the square of terrain hill cut away
// until then (base + ~30 m: the surface model's hill spreads past the stone).
/** The Giza plateau's sand as the satellite photo shows it. */
export const GIZA_SAND: [number, number, number] = [200, 177, 134];
const GIZA_PYRAMIDS: Array<{ model: string; title: string; lat: number; lon: number; built: number; buildYears?: number; ring?: number; clip: number; cover: number; always?: boolean }> = [
  { model: 'giza-khufu', title: 'Pyramid of Khufu', lat: 29.97917, lon: 31.13421, built: -2566, buildYears: 23, ring: 175, clip: 262, cover: 170 , always: true },
  { model: 'giza-khafre', title: 'Pyramid of Khafre', lat: 29.97599, lon: 31.13074, built: -2532, buildYears: 26, ring: 165, clip: 246, cover: 160 , always: true },
  { model: 'giza-menkaure', title: 'Pyramid of Menkaure', lat: 29.97251, lon: 31.12826, built: -2503, buildYears: 29, ring: 95, clip: 132, cover: 90 , always: true },
  // The queens' pyramids east of Khufu (Khufu's reign) and south of Menkaure.
  { model: 'giza-queen', title: 'Pyramid G1-a (Hetepheres I)', lat: 29.97887, lon: 31.13621, built: -2570, clip: 68, cover: 38 },
  { model: 'giza-queen', title: 'Pyramid G1-b (Meritites I)', lat: 29.97834, lon: 31.13621, built: -2570, clip: 68, cover: 38 },
  { model: 'giza-queen', title: 'Pyramid G1-c (Henutsen)', lat: 29.97788, lon: 31.1362, built: -2566, clip: 64, cover: 36 },
  { model: 'giza-queen', title: 'Pyramid G3-a', lat: 29.97162, lon: 31.1283, built: -2510, clip: 60, cover: 34 },
  { model: 'giza-queen-step', title: 'Pyramid G3-b', lat: 29.97163, lon: 31.12781, built: -2510, clip: 44, cover: 26 },
  { model: 'giza-queen-step', title: 'Pyramid G3-c', lat: 29.97162, lon: 31.12734, built: -2510, clip: 44, cover: 26 },
];
/** The Sphinx stands in her hollow, ~20 m below the plateau: her ring is read
 * INSIDE the enclosure, not out on the plateau rim round it. */
const SPHINX_RING_M = 46;
/** The Tower of London's walled area (OSM way 370870741), grassed over until
 * Henry III's curtain walls (1240): the photo holds today's castle. */
const TOWER_OF_LONDON_COVER: Array<[number, number]> = [[51.507724,-0.077822],[51.507676,-0.077899],[51.507744,-0.077903],[51.507742,-0.077967],[51.507739,-0.078021],[51.507766,-0.078052],[51.507797,-0.078029],[51.5078,-0.077975],[51.507837,-0.077952],[51.507864,-0.077984],[51.507895,-0.077961],[51.507898,-0.077907],[51.507969,-0.077841],[51.508394,-0.077583],[51.508878,-0.077304],[51.508916,-0.077306],[51.508953,-0.077284],[51.508984,-0.077239],[51.508997,-0.077183],[51.509,-0.077125],[51.508992,-0.077067],[51.509111,-0.075701],[51.508879,-0.074837],[51.508869,-0.074761],[51.508875,-0.07469],[51.508858,-0.074615],[51.508822,-0.074556],[51.50878,-0.074528],[51.508742,-0.074521],[51.508702,-0.074534],[51.508672,-0.074564],[51.508651,-0.074609],[51.508374,-0.074668],[51.508339,-0.074615],[51.507298,-0.07478],[51.50721,-0.074662],[51.507172,-0.074804],[51.507179,-0.074985],[51.507157,-0.075054],[51.507192,-0.075348],[51.507193,-0.075372],[51.5072,-0.075541],[51.507178,-0.075565],[51.507204,-0.075639],[51.507448,-0.076736],[51.507434,-0.076757],[51.507367,-0.076791],[51.507358,-0.076784],[51.507347,-0.076786],[51.507339,-0.076795],[51.507335,-0.07681],[51.507335,-0.076826],[51.50734,-0.07684],[51.507349,-0.076848],[51.507359,-0.076848],[51.507429,-0.077138],[51.507422,-0.07715],[51.50742,-0.077165],[51.507423,-0.07718],[51.50743,-0.077191],[51.507439,-0.077195],[51.507449,-0.077192],[51.507457,-0.077181],[51.50746,-0.077166],[51.507458,-0.07715],[51.507676,-0.077625]];

/** The three causeways from each pyramid's mortuary temple down to its valley
 * temple, DRAPED on the terrain (the old one was a beam 14 m in the air). Ends
 * from OpenStreetMap: the temples' footprints and Khufu's causeway path (way
 * 354844304, as far as it is traced before the village covers it). Widths are
 * approximate. Drawn from completion until the photo's own remains take over. */
const GIZA_CAUSEWAYS: Array<{ from: number; widthM: number; lonLat: number[] }> = [
  { from: -2566, widthM: 10, lonLat: [31.13538, 29.97917, 31.135905, 29.979196, 31.136046, 29.979208, 31.136246, 29.979239, 31.136442, 29.979308, 31.136568, 29.979361, 31.137079, 29.979467, 31.137932, 29.979647] },
  { from: -2532, widthM: 5, lonLat: [31.133104, 29.975992, 31.138066, 29.974745] },
  { from: -2503, widthM: 5, lonLat: [31.129813, 29.97249, 31.1361, 29.972507] },
];
const CAUSEWAY_UNTIL = 1356;
/** The Stonehenge Avenue (c. 2400–2200 BCE): its two banks, ~14 m apart,
 * DRAPED on the terrain so they follow the real ground down into Stonehenge
 * Bottom. Only the straight first leg — 530 m NE from the entrance along the
 * solstice axis (49.9°) — is drawn; the rest of its 2.8 km to the Avon bends
 * east and is left to the photo. */
/** Today's palace, traced from OpenStreetMap (westminster-plan.json), as lat/lon
 * rings: the photo of Barry's palace is covered exactly to its own outline,
 * so before 1860 no disc of plain ground spills over Old Palace Yard or the river. */
const WESTMINSTER_COVER: Array<Array<[number, number]>> = (() => {
  const k = 111320 * Math.cos((51.4995 * Math.PI) / 180);
  const ll = (r: number[][]) => r.map(([x, y]) => [51.4995 + y / 110574, -0.1248 + x / k] as [number, number]);
  return [WESTMINSTER_PLAN.outer, ...Object.values(WESTMINSTER_PLAN.parts)].map(ll);
})();

/** Today's palace and the Victoria Memorial with its gardens, traced from
 * OpenStreetMap (buckingham-plan.json), as lat/lon rings for the photo cover;
 * the third ring is the forecourt inside Webb's 1911 railings, whose modern
 * pink gravel and parade lines showed in the photo before 1913 (19 Oct 2026). */
export const BUCKINGHAM_COVER: Array<Array<[number, number]>> = (() => {
  const k = 111320 * Math.cos((51.5014 * Math.PI) / 180);
  const ll = (r: number[][]) => r.map(([x, y]) => [51.5014 + y / 110574, -0.1419 + x / k] as [number, number]);
  const m = BUCKINGHAM_PLAN.memorial;
  const cx = m.reduce((a, p) => a + p[0], 0) / m.length;
  const cy = m.reduce((a, p) => a + p[1], 0) / m.length;
  const disc = Array.from({ length: 32 }, (_, i) => [cx + 37 * Math.cos((i * Math.PI) / 16), cy + 37 * Math.sin((i * Math.PI) / 16)]);
  return [BUCKINGHAM_PLAN.outer, disc, ...periodGround().map(([r]) => r), BUCKINGHAM_PLAN.railings].map(ll);
})();
/** Per ring: the palace patch, the Memorial disc (1911-13 only), the period
 * ground (before 1911), then the gravel forecourt on top. */
const BUCKINGHAM_GROUND = periodGround();
const BUCKINGHAM_POLY_RGB = [undefined, undefined, ...BUCKINGHAM_GROUND.map(([, c]) => c), [150, 140, 118] as [number, number, number]];
const BUCKINGHAM_POLY_ALPHA = [undefined, undefined, ...BUCKINGHAM_GROUND.map(([, , a]) => a)];
const BUCKINGHAM_POLY_FROM = [undefined, PERIOD_GROUND_UNTIL];
const BUCKINGHAM_POLY_UNTIL = [undefined, undefined, ...BUCKINGHAM_GROUND.map(() => PERIOD_GROUND_UNTIL)];
const BUCKINGHAM_POLY_DRAPE = [false, false, ...BUCKINGHAM_GROUND.map(() => true)];
const BUCKINGHAM_TREES: Array<[number, number, number, number, number]> = periodTrees().map(([x, y, r, h, tone]) => [
  51.5014 + y / 110574, -0.1419 + x / (111320 * Math.cos((51.5014 * Math.PI) / 180)), r, h, tone,
]);

const STONEHENGE_AVENUE: Array<{ from: number; until: number; widthM: number; lonLat: number[] }> = [
  { from: -2300, until: 400, widthM: 4, lonLat: [-1.825607, 51.179295, -1.819798, 51.182362] },
  { from: -2300, until: 400, widthM: 4, lonLat: [-1.825478, 51.179199, -1.819668, 51.182266] },
];
const STONEHENGE_BARROWS = [
  { title: 'Bell barrow 100 m east of Stonehenge', lat: 51.1786, lon: -1.82365 }, // Q17673274
  { title: 'Bowl barrow 230 m west of Stonehenge', lat: 51.1786, lon: -1.83063 }, // Q17673197
  { title: 'Bowl barrow 300 m WSW of Stonehenge', lat: 51.1779, lon: -1.83135 }, // Q17673316
  { title: 'Bowl barrow 650 m SSE of Stonehenge', lat: 51.173, lon: -1.82108 }, // Q17672522
];

// The MVP fleet — the same marquee sites the Workshop calibrated.
const PLACEMENTS: Placement[] = [
  // WHOLE SITES (the Captain, 10 Oct 2026): each great temple its own true-
  // metre model on its own patch of ground, from scripts/build-meso-site.mjs;
  // the rest of the site is a ground-hugging plan (public/data/siteplans).
  // Each site's recipe sets when it became the ruin (Tikal: abandoned c. AD 900).
  ...(MESO_TEMPLES as Array<{ model: string; title: string; lat: number; lon: number; builtYear: number; ruinYear?: number; buried?: [number, number] }>).map((t) => ({
    model: t.model, title: t.title, lat: t.lat, lon: t.lon, builtYear: t.builtYear, ruinYear: t.ruinYear ?? 900,
    ...(t.buried ? { buried: t.buried } : {}),
  })),
  // ruinYear: when the monument became the ruin we know — the casing goes
  // to Cairo's mosques, the earthquake fells the Colosseum's south ring,
  // the Venetian shell guts the Parthenon, the sarsens topple.
  // THE GIZA PYRAMIDS, one true-metre model each (the Captain, 15 Oct 2026), so
  // each stands on its OWN ground — the plateau falls ~45 m from Khafre down to
  // the Sphinx, and the old single 1 km plateau model (still exported as
  // giza*.glb for the 3D viewer) could only sit right at one point.
  // Centres: the OpenStreetMap footprints (ways 4420397 / 4420396 / 4420398 and
  // the queens' ways), which agree with Wikipedia's coordinates to ~10–40 m
  // and match the satellite photo they were traced from. Each rises in its own
  // king's reign (Wikipedia, conventional dates): Khufu c. 2589–2566 BCE,
  // Khafre c. 2558–2532, Menkaure c. 2532–2503. The casing was stripped for
  // Cairo after the 1303 earthquake; 1356 (Sultan Hasan's works) is the date
  // the stripped cores take over.
  ...GIZA_PYRAMIDS.map((g) => ({
    model: g.model, title: g.title, lat: g.lat, lon: g.lon, builtYear: g.built,
    // The queens' ruins are left to the photo's own surface model (it holds them
    // as they stand): a ruin model on top of that hill read as stacked beige
    // blocks by Khufu (the PR #12 review). The great three keep their ruins.
    ...(g.always ? { ruinYear: 1356 } : { endYear: 1356 }),
    ...(g.buildYears ? { buildYears: g.buildYears } : {}),
    ...(g.ring ? { baseRingM: g.ring } : {}),
    clipM: [g.clip, g.clip] as [number, number],
    ...(g.always ? { clipAlways: true } : {}),
    // The plateau's own sand as the photo shows it round the pyramids (sampled
    // on the globe, 19 Oct 2026), so the patch over today's pyramids, and the
    // cut floor under it, sink into the desert instead of reading as cream slabs.
    cover: { rgb: GIZA_SAND, at: [[g.lat, g.lon, g.cover] as [number, number, number]], until: 'built' as const },
  })),
  // The Great Sphinx stands as her OWN model at her true coordinates — SE of and
  // lower than the pyramids — so she clamps to her own (lower) ground and sits in
  // her hollow instead of floating at plateau height baked into the flat giza
  // model. Carved under Khafre, ~2500 BCE. (The plateau model no longer draws its
  // own Sphinx — see Monument3D 'giza'.)
  { model: 'sphinx', title: 'Great Sphinx of Giza', lat: 29.9753, lon: 31.1376, builtYear: -2500, baseRingM: SPHINX_RING_M,
    cover: { rgb: [214, 192, 148], at: [[29.97526, 31.13758, 50]], until: 'built' } },
  // REAL SCANS (24 Oct 2026), true metres with north = -Z baked in, so scale 1:
  // Göbekli Tepe's main excavation (enclosures A–D; photogrammetry by rmark,
  // CC BY 4.0) and Pumapunku's Plataforma Lítica (drone scan by NeoTec, CC BY
  // 4.0). Karahan Tepe and Gunung Padang keep the tpillars / megalith archetypes.
  // The excavation (under the shelter roof) is ~18 m N, ~4 m W of the site pin, read
  // off the satellite photo on the globe.
  { model: 'gobekli-scan', title: 'Göbekli Tepe', lat: 37.22322, lon: 38.92245, builtYear: -9500 },
  { model: 'pumapunku-scan', title: 'Pumapunku', lat: -16.56139, lon: -68.67944, builtYear: 550 },
  { model: 'amphitheatre', title: 'Colosseum', lat: 41.8902, lon: 12.4922, builtYear: 80, ruinYear: 1349, buildYears: 10 },
  { model: 'greek-temple', title: 'Parthenon', lat: 37.9715, lon: 23.7267, builtYear: -438, ruinYear: 1687 },
  // ruinYear 400 CE is an ESTIMATE, not a recorded date: the stones fell and
  // were taken over millennia, unrecorded until the falls of 1797 and 1900.
  // The last sourced use is late-4th-century Roman coins and pottery — still
  // a ceremonial site (2008 excavation). It was 1500 BCE (the end of building
  // work), which showed the ruin through the whole Bronze and Iron Ages.
  // STONEHENGE AS A WHOLE SITE OVER TIME (the Captain, 18 Oct 2026), true
  // metres — stonehengeSite.ts, staged by STAGE_TABLE['stonehenge-site'].
  { model: 'stonehenge-site', title: 'Stonehenge', lat: 51.1789, lon: -1.8262, builtYear: -1900, ruinYear: 400,
    cover: { rgb: [64, 91, 52], at: [[51.1789, -1.8262, 26]] } },
  // A few of the round barrows nearest the stones (Bronze Age, c. 2200–1500
  // BCE; here all from 1900 BCE). Positions: Wikidata / Historic England
  // scheduling records. Representative, not the whole cemetery.
  ...STONEHENGE_BARROWS.map((b) => ({ model: 'round-barrow', title: b.title, lat: b.lat, lon: b.lon, builtYear: -1900 })),
  { model: 'cathedral', title: 'Notre-Dame de Paris', lat: 48.853, lon: 2.3499, builtYear: 1345 },
  // The Paris trio — all of Paris standing together from 1989 onward.
  { model: 'eiffel', title: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, builtYear: 1889 },
  { model: 'arc-triomphe', title: 'Arc de Triomphe', lat: 48.8738, lon: 2.295, builtYear: 1836 },
  // The model includes Pei's glass pyramid, so it stands from the pyramid's
  // year — an 1800s Louvre without it would be the honest earlier form.
  { model: 'louvre', title: 'Louvre', lat: 48.8606, lon: 2.3376, builtYear: 1989 },
  // The whole palace through time (westminsterSite.ts): Westminster Hall from
  // 1097, the medieval palace, the 1834 fire, Barry & Pugin's rebuild. The photo
  // is today's palace, so it is covered until the Victoria Tower is done.
  { model: 'westminster-site', title: 'Palace of Westminster', lat: 51.4995, lon: -0.1248, builtYear: 1860,
    cover: { rgb: [98, 102, 84], at: [], poly: WESTMINSTER_COVER, until: 'built', flat: true } },
  // The whole palace through time (buckinghamSite.ts): Buckingham House 1703,
  // Nash, Blore's East Front, the Victoria Memorial and Webb's 1913 front. The
  // photo is today's palace, so it is covered to its own outline until 1913.
  { model: 'buckingham-site', title: 'Buckingham Palace', lat: 51.5014, lon: -0.1419, builtYear: 1913,
    cover: { rgb: [86, 98, 70], at: [], poly: BUCKINGHAM_COVER, polyRgb: BUCKINGHAM_POLY_RGB, polyAlpha: BUCKINGHAM_POLY_ALPHA,
      polyFrom: BUCKINGHAM_POLY_FROM, polyUntil: BUCKINGHAM_POLY_UNTIL, polyDrape: BUCKINGHAM_POLY_DRAPE,
      trees: BUCKINGHAM_TREES, treesUntil: PERIOD_GROUND_UNTIL, until: 'built', flat: true } },
  { model: 'london-eye', title: 'London Eye', lat: 51.5033, lon: -0.1196, builtYear: 2000 },
  // The London expansion.
  // Tower Bridge in true metres on its OSM plan (towerBridgeSite.ts): piers,
  // towers, bascules, walkways, suspension chains and shore towers, from 1894,
  // repainted 1977 and 2010. No ground patch: the river is the photo's own.
  { model: 'tower-bridge-site', title: 'Tower Bridge', lat: 51.5055, lon: -0.0754, builtYear: 1894 },
  // St Paul's in true metres (stPaulsSite.ts): Old St Paul's (1087, spire
  // 1221-1561, burned 1666), then Wren's cathedral on its OSM plan (1697, dome 1710).
  { model: 'st-pauls-site', title: "St Paul's Cathedral", lat: 51.5138, lon: -0.0984, builtYear: 1087 },
  // The Tower of London in true metres on its OSM plan (towerOfLondonSite.ts),
  // phased from William's timber fort (1067) to today.
  { model: 'tower-of-london-site', title: 'Tower of London', lat: 51.5081, lon: -0.0759, builtYear: 1067,
    cover: { rgb: [96, 106, 76], at: [], poly: [TOWER_OF_LONDON_COVER], until: 1240 } },
  { model: 'shard', title: 'The Shard', lat: 51.5045, lon: -0.0865, builtYear: 2012 },
  { model: 'gherkin', title: '30 St Mary Axe (The Gherkin)', lat: 51.5145, lon: -0.0803, builtYear: 2003 },
  { model: 'opera-house', title: 'Sydney Opera House', lat: -33.8568, lon: 151.2153, builtYear: 1973 },
  // Built for Pachacuti c.1450; abandoned by c.1572, as the Inca state fell to
  // the Spanish — the thatch went, the stone stayed: the ruin we know.
  // It carries its OWN ridge (DEM, terraced), so it is sunk into the real
  // terrain: its base is 2385 m and the globe's ground at the pin is 2439 m
  // (ArcGIS, sampled 2026-09-24) — 51 m down leaves its terraces ~3 m proud of
  // the real slope and lets its forest collar run into the real flanks.
  { model: 'machu-picchu', title: 'Machu Picchu', lat: -13.163, lon: -72.545, builtYear: 1450, ruinYear: 1572, sinkM: 51 },
  // THE TERRACOTTA ARMY, Pit 1 (the Captain, 8 Oct 2026). Shown painted and
  // complete, roof cut away, from c. 210 BCE; the pits were burned and caved
  // in by 206 BCE (traditionally blamed on Xiang Yu's rebels) and lay buried
  // until well-diggers found them in 1974 — from then on, the excavation as it
  // is today. Its pit floor is 5 m below its own rim, so it sinks 5 m.
  { model: 'terracotta-army', title: 'Terracotta Army', lat: 34.3847, lon: 109.2731, builtYear: -210, ruinYear: 1974, buried: [-206, 1974], sinkM: 5 },
  { model: 'liberty', title: 'Statue of Liberty', lat: 40.6892, lon: -74.0445, builtYear: 1886 },
  { model: 'leaning-tower', title: 'Leaning Tower of Pisa', lat: 43.723, lon: 10.3966, builtYear: 1372 },
  { model: 'aqueduct', title: 'Pont du Gard', lat: 43.9475, lon: 4.535, builtYear: 60 },
  // ERIDU. No buildYears window: this is not one building going up, it is
  // eighteen temple levels over 3,400 years, so its phases are listed by real
  // date in STAGE_TABLE (see lib/stageTable.ts) exactly as the Tower of London
  // is. builtYear is the LAST of them — Amar-Sin's ziggurat, c. 2050 BCE.
  { model: 'ziggurat', title: 'Eridu', lat: 30.8158, lon: 45.9958, builtYear: -2050 },
  // Built under Suryavarman II between about 1113 and 1150. Deliberately NO
  // ruinYear: unlike most of Angkor it was never abandoned to the forest — it
  // stayed in use as a Buddhist temple and is on Cambodia's flag today.
  { model: 'angkor', title: 'Angkor Wat', lat: 13.4125, lon: 103.8667, builtYear: 1150, buildYears: 37 },
  // PLATO'S ATLANTIS, IMAGINED — a flagged artistic reconstruction. It never
  // stands by default: the real Richat landform is the view. It shows only
  // while the visitor has the vision switched on in the Richat panel
  // (setAtlantisVision), whatever the year; 9600 BCE is Plato's date.
  { model: 'rings', title: 'Atlantis', lat: 21.124, lon: -11.396, builtYear: -9600 },
];

const entities: Array<{ entity: Cesium.Entity; p: Placement }> = [];

// Kept module-level so any site — not just the curated fleet — can be placed
// on the globe the moment the visitor asks to see it (`ensurePlacement`).
let theViewer: Cesium.Viewer | null = null;
let theManifest: Record<string, { footprint: number; kb?: number }> = {};
/** Draws frames while a shown model is still being built (lib/modelLoadWatch). */
let loadWatch: ModelLoadWatch | null = null;
const scratchSphere = new Cesium.BoundingSphere();
function modelState(id: string): LoadState {
  const v = theViewer;
  const entity = v && !v.isDestroyed() ? v.entities.getById(id) : undefined;
  if (!v || !entity) return 'failed';
  if (!entity.isShowing) return 'hidden';
  // Cesium's own readiness test (what viewer.zoomTo waits on) — present at
  // runtime but left out of its typings. BoundingSphereState: 0 DONE, 1 PENDING.
  const display = v.dataSourceDisplay as unknown as {
    getBoundingSphere(e: Cesium.Entity, allowPartial: boolean, result: Cesium.BoundingSphere): number;
  };
  const s = display.getBoundingSphere(entity, false, scratchSphere);
  return s === 0 ? 'done' : s === 1 ? 'pending' : 'failed';
}
/** The glb to load for a model: a heavy scan (the 509 KB Sphinx) swaps for
 * its small `-lite` build on phones and in lite mode — see lib/liteMode. */
function fileFor(model: string): string {
  return lightModelName(model, theManifest, preferSmallModels());
}
// Last visibility gate, so a just-placed model obeys it immediately.
let lastYearsBP = Number.NEGATIVE_INFINITY;

/**
 * ONLY LOAD WHAT COULD BE SEEN (roadmap 13, the freezes — 11 Oct 2026).
 * Every model already hides beyond REVEAL_DISTANCE, but a SHOWN entity is
 * still loaded and its shaders compiled wherever the camera is. So when Play
 * swept into the eras where monuments are born, dozens of model programs were
 * compiled in a burst — 58 of the 76 built during one traced play-through —
 * with the camera thousands of kilometres up. Now a model is shown only when
 * the camera is within reach of it (a margin past the reveal distance, so it
 * is ready by the time it is visible).
 */
const LOAD_DISTANCE = REVEAL_DISTANCE * 1.6;
const positionCache = new Map<Placement, Cesium.Cartesian3>();
function cameraNear(p: Placement): boolean {
  const cam = theViewer?.camera;
  if (!cam) return false;
  let pos = positionCache.get(p);
  if (!pos) {
    pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat);
    positionCache.set(p, pos);
  }
  return Cesium.Cartesian3.distance(cam.positionWC, pos) < LOAD_DISTANCE;
}
let lastShowSites = true;

// The Captain's hand-tuned placement trims, loaded from the review file and
// keyed per site — his eyeball is the calibration instrument.
let transforms: Record<string, ModelTransform> = {};

/**
 * THE BUMP (found 11 Oct 2026). The terrain is a surface model, so it holds
 * the great monuments THEMSELVES: at Khufu's centre it reads 197 m against
 * a 60 m plateau, and a model clamped there stood on the terrain's own
 * pyramid, floating ~140 m up with the photo's pyramids showing beneath it
 * (the Captain: "monuments seem to persist"). Surveyed: Giza +149 m, Pyramid
 * of the Sun +62, Moon +33, Nohoch Mul +14, Angkor Wat +13, La Venta +10.
 * So a monument stands on the ground AROUND it — the median of a ring at its
 * edge, sampled at full detail once the camera is near — whenever its centre
 * reads more than BUMP_M above that. Never raised, only lowered; a model that
 * carries its own landform (sinkM — Machu Picchu's ridge) keeps its clamp.
 * Absolute metres per entity id; null = no bump, the clamp is right.
 */
const BUMP_M = 5;
const baseGround = new Map<string, number | null>();
const grounding = new Set<string>();
/** The ring's median ground (m) per entity id — the floor laid in a clipM hole. */
const ringGround = new Map<string, number>();

/** CLIPPED TERRAIN (Placement.clipM): the hole cut in the surface model, and the
 * flat floor laid in it, per entity id — on until the monument stands complete. */
const clips = new Map<string, { poly: Cesium.ClippingPolygon; floor: Cesium.Entity; on: boolean; h: number; unbuilt: boolean }>();
/** The cut's flat floor. The floor polygon renders ~17% brighter than its
 * material (measured on the globe, 19 Oct 2026: 193 → 225), while the draped
 * sand cover renders true. So before the work starts the floor is laid at
 * 0.85 × the cover colour, which renders as the cover itself and vanishes into
 * it; once building it is 0.9 ×, a touch paler: the levelled pavement. */
export function floorRgb(p: Pick<Placement, 'cover'>, unbuilt: boolean): [number, number, number] {
  const rgb = p.cover?.rgb ?? [214, 192, 148];
  const k = unbuilt ? 0.85 : 0.9;
  return [Math.round(rgb[0] * k), Math.round(rgb[1] * k), Math.round(rgb[2] * k)];
}
const floorColour = (p: Placement, unbuilt: boolean): Cesium.Color => Cesium.Color.fromBytes(...floorRgb(p, unbuilt), 255);

function gateClip(entity: Cesium.Entity, p: Placement): void {
  const viewer = theViewer;
  const coll = viewer?.scene.globe.clippingPolygons;
  if (!viewer || viewer.isDestroyed() || !p.clipM || !coll) return;
  const id = entity.id;
  const modern = !(viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider);
  // The great pyramids are cut at EVERY date: the surface model's hill pokes
  // through their stripped ruins (Khafre's dark photo top). The queens only until
  // built — their floors left flat slabs by Khufu in 2026 (the PR #12 review).
  const curYear = yearsBPToYear(lastYearsBP);
  // Before the work starts (bornYear) the cut must stay — the terrain model
  // holds today's pyramids as sand-coloured hills — but its floor must not read
  // as a slab: at 5406 BCE the great three's darker floors showed as flat cream
  // squares where the pyramids would one day stand (the Captain, 19 Oct 2026).
  // So until then the floor wears exactly the sand cover's colour and merges into it.
  const { bornYear } = stageFor(p.model, p.builtYear, curYear);
  const unbuilt = curYear < bornYear;
  let want = modern && lastShowSites && (p.clipAlways || curYear < p.builtYear) && cameraNear(p);
  if (want && !ringGround.has(id)) {
    // The floor's height is the ring's ground: find it first (never a hole into the void).
    if (!grounding.has(id)) void findBase(entity, p);
    want = false;
  }
  let c = clips.get(id);
  const h = ringGround.get(id) ?? 0;
  if (want && (!c || c.h !== h)) {
    if (c) {
      if (c.on) coll.remove(c.poly);
      viewer.entities.remove(c.floor);
    }
    const [ew, ns] = p.clipM;
    const dLat = 1 / 111_320;
    const dLon = 1 / (111_320 * Math.cos((p.lat * Math.PI) / 180));
    const square = (ew2: number, ns2: number) => Cesium.Cartesian3.fromDegreesArray([
      p.lon - ew2 * dLon, p.lat - ns2 * dLat, p.lon + ew2 * dLon, p.lat - ns2 * dLat,
      p.lon + ew2 * dLon, p.lat + ns2 * dLat, p.lon - ew2 * dLon, p.lat + ns2 * dLat,
    ]);
    c = {
      poly: new Cesium.ClippingPolygon({ positions: square(ew / 2, ns / 2) }),
      floor: viewer.entities.add({
        show: false,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(square(ew / 2 + 3, ns / 2 + 3)),
          height: h,
          material: floorColour(p, unbuilt),
        },
      }),
      on: false,
      h,
      unbuilt,
    };
    clips.set(id, c);
  }
  if (c && c.unbuilt !== unbuilt && c.floor.polygon) {
    c.unbuilt = unbuilt;
    c.floor.polygon.material = new Cesium.ColorMaterialProperty(floorColour(p, unbuilt));
    viewer.scene.requestRender();
  }
  if (!c || c.on === want) return;
  if (want) coll.add(c.poly);
  else coll.remove(c.poly);
  c.floor.show = want;
  c.on = want;
  viewer.scene.requestRender();
}

/** The Giza causeways, draped on the terrain (GIZA_CAUSEWAYS). */
// (Also the Stonehenge Avenue's banks — any dated, terrain-draped line.)
const causeways: Array<{ entity: Cesium.Entity; from: number; until: number; at: Cesium.Cartesian3 }> = [];
function gateCauseways(): void {
  const cam = theViewer?.camera;
  if (!cam) return;
  const curYear = yearsBPToYear(lastYearsBP);
  for (const c of causeways) {
    const near = Cesium.Cartesian3.distance(cam.positionWC, c.at) < LOAD_DISTANCE;
    const on = lastShowSites && near && curYear >= c.from && curYear < c.until;
    if (c.entity.show !== on) c.entity.show = on;
  }
}

async function findBase(entity: Cesium.Entity, p: Placement): Promise<void> {
  const viewer = theViewer;
  if (!viewer || viewer.isDestroyed() || viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) return;
  const id = entity.id;
  grounding.add(id);
  try {
    const widthM = fitFor(p.title, p.model).widthM;
    // A landform-sized model (Atlantis, 2.5 km) carries its own ground; it
    // keeps its clamp unless given a ring of its own (Giza's baseRingM).
    if (p.baseRingM == null && widthM > 1500) {
      baseGround.set(id, null);
      return;
    }
    const R = p.baseRingM ?? widthM / 2 + 40;
    const dLat = 1 / 111_320;
    const dLon = 1 / (111_320 * Math.cos((p.lat * Math.PI) / 180));
    const cartos = [Cesium.Cartographic.fromDegrees(p.lon, p.lat)];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      cartos.push(Cesium.Cartographic.fromDegrees(p.lon + Math.cos(a) * R * dLon, p.lat + Math.sin(a) * R * dLat));
    }
    const terrain = viewer.terrainProvider;
    const sampled = await Cesium.sampleTerrainMostDetailed(terrain, cartos);
    if (viewer.isDestroyed() || viewer.terrainProvider !== terrain) return; // era changed meanwhile
    const ring = sampled.slice(1).map((c) => c.height).filter(Number.isFinite).sort((a, b) => a - b);
    const centre = sampled[0].height;
    const edge = ring.length ? ring[Math.floor(ring.length / 2)] : NaN;
    baseGround.set(id, Number.isFinite(centre) && Number.isFinite(edge) && centre - edge > BUMP_M ? edge : null);
    seat(entity, p);
    if (Number.isFinite(edge)) ringGround.set(id, edge);
    gateClip(entity, p);
  } catch {
    /* terrain unavailable — the clamp stands */
  } finally {
    grounding.delete(id);
  }
}

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
  const info = theManifest[fileFor(p.model)];
  if (!entity.model || !info?.footprint) return;
  // The imagined Atlantis is built at TRUE scale (1 unit = 10 m), so it takes
  // no maker trim: the saved ×21.6 was for the old 2.5 km stylised rings.
  const t = p.model === 'rings' ? {} : transforms[transformKey(p.model, p.lat, p.lon)] ?? {};
  const { widthM, facingDeg } = fitFor(p.title, p.model);
  const mPerDeg = 111_320;
  const lat = p.lat + (t.northM ?? 0) / mPerDeg;
  const lon = p.lon + (t.eastM ?? 0) / (mPerDeg * Math.cos((p.lat * Math.PI) / 180));
  const up = (t.upM ?? 0) - (p.sinkM ?? 0);
  const base = baseGround.get(entity.id);
  const position = Cesium.Cartesian3.fromDegrees(lon, lat, (base ?? 0) + up);
  entity.position = new Cesium.ConstantPositionProperty(position);
  const heading = Cesium.Math.toRadians(90 - facingDeg + GLOBE_HEADING_CAL + (t.headingDeg ?? 0));
  entity.orientation = new Cesium.ConstantProperty(
    Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(heading, 0, 0)),
  );
  entity.model.scale = new Cesium.ConstantProperty((widthM / info.footprint) * (t.scale ?? 1));
  entity.model.heightReference = new Cesium.ConstantProperty(
    base != null ? Cesium.HeightReference.NONE
      : up !== 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
  );
  theViewer?.scene.requestRender();
}

/** Live preview of a trim (maker's Adjust panel) — not persisted here. */
export function applyLiveTransform(model: string, lat: number, lon: number, t: ModelTransform): void {
  const found = entities.find(
    (e) => e.p.model === model && Math.abs(e.p.lat - lat) < 0.03 && Math.abs(e.p.lon - lon) < 0.03,
  );
  // Key by the PLACEMENT's own coords, not the caller's (event) coords —
  // seat() reads the key from p.lat/p.lon, and floating-point rounding can
  // make the two disagree in the 3rd decimal (Tower Bridge: 51.5055 → .505
  // but the event's 51.505556 → .506), which silently stranded the trim.
  const p = found ? found.p : { model, lat, lon };
  transforms[transformKey(p.model, p.lat, p.lon)] = t;
  if (found) seat(found.entity, found.p);
}

/** The review/local key for a monument's saved trim — always the
 * PLACEMENT's key when one is standing, so save and apply agree. */
export function placementKeyFor(model: string, lat: number, lon: number): string {
  const found = entities.find(
    (e) => e.p.model === model && Math.abs(e.p.lat - lat) < 0.03 && Math.abs(e.p.lon - lon) < 0.03,
  );
  const p = found ? found.p : { model, lat, lon };
  return transformKey(p.model, p.lat, p.lon);
}

/** Terrain provider changed (era crossed the paleo line): every clamped
 * model must re-seat, or it floats at the OLD ground's height. */
export function reseatAll(): void {
  baseGround.clear(); // a new terrain has new bumps — re-found as each comes near
  ringGround.clear();
  for (const { entity, p } of entities) seat(entity, p);
}

/** How far a flat cover sheet floats over the ground at its centre (m). */
export const FLAT_COVER_M = 0.4;
/** Ground patches over today's photo (Placement.cover), by monument entity id. */
const covers = new Map<string, Cesium.Entity[]>();
/** A cover ring's own [from, until) years, where it has one. */
const coverWindow = new Map<Cesium.Entity, [number | undefined, number | undefined]>();

function addPlacement(p: Placement): void {
  const viewer = theViewer;
  const info = theManifest[p.model];
  if (!viewer || !info?.footprint) return;
  // The Giza queens stand ~50 m apart — one more decimal keeps their ids apart.
  const dp = p.model.startsWith('giza-') ? 4 : 3;
  const id = `mon3d-${p.model}-${p.lat.toFixed(dp)}-${p.lon.toFixed(dp)}`;
  // THE LOAD RACE (found 8 Oct 2026). loadGlobeModels awaits the review file
  // between reading the manifest and adding the curated list, and a camera
  // that opens near a monument can ensurePlacement() a generic one in that
  // gap. The curated add then hit Cesium's duplicate-id DeveloperError, which
  // ABORTED the loop: every curated monument after it never stood at all.
  // The curated placement (with its ruin, burial and sink) replaces the
  // generic one; a generic one never replaces anything.
  const prior = entities.findIndex((e) => e.entity.id === id);
  if (prior >= 0) {
    if (p.generic || !entities[prior].p.generic) return;
    viewer.entities.remove(entities[prior].entity);
    entities.splice(prior, 1);
  }
  // …and a curated model clears any GENERIC stand-in within ~1 km, whatever
  // its archetype: a dive at load can place one before this list arrives.
  if (!p.generic) {
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.p.generic && curatedCovers(p, e.p)) {
        viewer.entities.remove(e.entity);
        entities.splice(i, 1);
      }
    }
  }
  const entity = viewer.entities.add({
    id,
    position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
    model: {
      uri: `./models/${fileFor(p.model)}.glb`,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, REVEAL_DISTANCE),
      // Monuments sleep at night: glTF models carry their own light, so
      // when the Weather & Sky dial darkens the real globe they would
      // otherwise glow against black ground ("raised into the heavens" —
      // the Captain, 2026-07-12). Dim them by local solar time whenever
      // real sun lighting is on.
      color: new Cesium.CallbackProperty(() => {
        // While the site builder is open the exported model turns GHOST —
        // translucent, so the Captain can trace the real satellite footprint
        // underneath instead of the model's own roof.
        const ghost = isBuilderActive() ? 0.25 : 1;
        const v = theViewer;
        if (!v || !v.scene.globe.enableLighting) return Cesium.Color.WHITE.withAlpha(ghost);
        const d = Cesium.JulianDate.toDate(v.clock.currentTime);
        const solar = (d.getUTCHours() + d.getUTCMinutes() / 60 + p.lon / 15 + 24) % 24;
        const day = Math.max(0, Math.min(1, (Math.cos(((solar - 12) / 12) * Math.PI) + 0.3) / 0.9));
        // An eclipse overhead darkens a monument in broad daylight — the same
        // dimmer, driven by the moon instead of the hour (queue item 9).
        const k = (0.12 + 0.88 * day) * eclipseLightFactor(p.lat, p.lon);
        return new Cesium.Color(k, k, k, ghost);
      }, false) as unknown as Cesium.Property,
    },
    show: false, // the timeline decides
  });
  entities.push({ entity, p });
  if (p.cover && !covers.has(id)) {
    // A solid patch plus two faint wider rings, so the edge fades into the
    // photo's texture instead of ending in a hard line.
    const colour = Cesium.Color.fromBytes(...p.cover.rgb, 255);
    const FEATHER: Array<[number, number]> = [[1, 1], [1.15, 0.45], [1.3, 0.25]];
    covers.set(id, [
      ...p.cover.at.flatMap(([lat, lon, r]) => FEATHER.map(([k, alpha]) => viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        show: false,
        ellipse: {
          semiMajorAxis: r * k,
          semiMinorAxis: r * k,
          material: colour.withAlpha(alpha),
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
      }))),
      ...(p.cover.poly ?? []).map((ring, i) => {
        const e = viewer.entities.add({
          show: false,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(ring.map(([lat, lon]) => Cesium.Cartesian3.fromDegrees(lon, lat))),
            material: (p.cover!.polyRgb?.[i] ? Cesium.Color.fromBytes(...p.cover!.polyRgb[i]!, 255) : colour)
              .withAlpha(p.cover!.polyAlpha?.[i] ?? 1),
            // Later rings lie a hair higher, so overlapping sheets (a road on
            // the lawn) draw in order instead of z-fighting.
            ...(p.cover!.flat && !p.cover!.polyDrape?.[i]
              ? { height: FLAT_COVER_M + 0.04 * i, heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND }
              : { classificationType: Cesium.ClassificationType.TERRAIN, zIndex: i }),
          },
        });
        const from = p.cover!.polyFrom?.[i], until = p.cover!.polyUntil?.[i];
        if (from != null || until != null) coverWindow.set(e, [from, until]);
        return e;
      }),
      // Period trees: a trunk and a rounded crown each, low-poly. Phones and
      // lite mode stand every other tree.
      ...(p.cover.trees ?? []).filter((_, i) => !preferSmallModels() || i % 2 === 0).flatMap(([lat, lon, r, h, tone = 1]) => {
        const trunk = viewer.entities.add({
          show: false,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, h * 0.2),
          cylinder: {
            length: h * 0.4,
            topRadius: 0.25 + h * 0.012,
            bottomRadius: 0.3 + h * 0.016,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            material: Cesium.Color.fromBytes(92, 84, 70, 255),
            slices: 6,
          },
        });
        const crown = viewer.entities.add({
          show: false,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, h * 0.66),
          ellipsoid: {
            radii: new Cesium.Cartesian3(r, r, h * 0.34),
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            material: Cesium.Color.fromBytes(Math.round(62 * tone), Math.round(80 * tone), Math.round(44 * tone), 255),
            slicePartitions: 8,
            stackPartitions: 5,
          },
        });
        if (p.cover!.treesUntil != null) for (const e of [trunk, crown]) coverWindow.set(e, [undefined, p.cover!.treesUntil]);
        return [trunk, crown];
      }),
    ]);
  }
  seat(entity, p);
  gate(entity, p);
}

/** Create the curated monument entities (once, after the viewer exists). */
export async function loadGlobeModels(viewer: Cesium.Viewer): Promise<void> {
  theViewer = viewer;
  loadWatch?.dispose();
  const log: ModelLoad[] = [];
  (window as unknown as { __chronosModelLog?: ModelLoad[] }).__chronosModelLog = log;
  loadWatch = createModelLoadWatch({
    stateOf: modelState,
    requestFrame: () => {
      if (!viewer.isDestroyed()) viewer.scene.requestRender();
    },
    now: () => performance.now(),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (h) => window.clearInterval(h),
    log,
  });
  // The manifest and the review file are fetched side by side, not one after
  // the other: no monument can start loading until both are in.
  const reviewing = loadReview().catch(() => ({}));
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
    const review = await reviewing;
    for (const [key, rec] of Object.entries(review)) {
      if (key.startsWith('place:') && rec.transform) transforms[key] = rec.transform;
    }
  } catch {
    /* trims are optional */
  }
  // …and this device's own local tweaks win on top (maker mode, no key).
  Object.assign(transforms, loadLocalTransforms());
  if (Cesium.ClippingPolygonCollection.isSupported(viewer.scene) && !viewer.scene.globe.clippingPolygons) {
    viewer.scene.globe.clippingPolygons = new Cesium.ClippingPolygonCollection();
  }
  const drapes = [
    ...GIZA_CAUSEWAYS.map((c) => ({ ...c, until: CAUSEWAY_UNTIL, rgb: [205, 190, 158], at: [31.1335, 29.976] })),
    // The Avenue's banks: fresh chalk, greying as the turf takes them.
    ...STONEHENGE_AVENUE.map((c) => ({ ...c, rgb: [176, 180, 140], at: [-1.8262, 51.1789] })),
  ];
  for (const c of drapes) {
    causeways.push({
      from: c.from,
      until: c.until,
      at: Cesium.Cartesian3.fromDegrees(c.at[0], c.at[1]),
      entity: viewer.entities.add({
        show: false,
        corridor: {
          positions: Cesium.Cartesian3.fromDegreesArray(c.lonLat),
          width: c.widthM,
          material: Cesium.Color.fromBytes(c.rgb[0], c.rgb[1], c.rgb[2], 255),
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
      }),
    });
  }
  for (const p of PLACEMENTS) {
    addPlacement(p);
    // A true-metre OSM site model replaces a hand-traced plan of the same site.
    if (p.model === 'tower-of-london-site') supplantSitePlans(p.lat, p.lon, p.builtYear);
  }
  // The camera moving brings models into (and out of) reach.
  viewer.camera.percentageChanged = 0.05;
  viewer.camera.changed.addEventListener(() => {
    for (const { entity, p } of entities) gate(entity, p);
    gateCauseways();
  });
  // Whole-site plans arriving later supplant any generic stand-in (gate()).
  window.addEventListener('chronos:siteplans-loaded', () => {
    for (const { entity, p } of entities) gate(entity, p);
  });
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
  // A CURATED model of the real site already stands here (a whole-site
  // temple — Uxmal's Magician — or any hand-placed monument within ~1 km):
  // a generic archetype beside it would only be wrong (a dark stepped
  // pyramid sat on Uxmal's pin, 11 Oct 2026). Dive to the real one instead.
  const curated = entities.find((e) => !e.p.generic && curatedCovers(e.p, t));
  if (curated) return curated.p.builtYear;
  // …nor beside a whole-site ground plan (Monte Albán is plan-only).
  if (sitePlanNear(t.lat, t.lon)) return t.builtYear ?? null;
  const builtYear = t.builtYear ?? -3000;
  addPlacement({ model: t.model, title: t.title, lat: t.lat, lon: t.lon, builtYear, generic: true });
  return builtYear;
}

/** The live Cesium viewer, for other on-globe stages (battles). */
export function getViewer(): Cesium.Viewer | null {
  return theViewer;
}

// Register the regular build-window monuments (giza, stonehenge, amphitheatre)
// into the shared STAGE_TABLE from their own builtYear/buildYears, so every
// additive-phase model — the hand-listed irregular ones (Tower of London) and
// these — resolves through the one stageFor() lookup in ./stageTable.
for (const s of PLACEMENTS) {
  if (!s.buildYears || STAGE_TABLE[s.model]) continue;
  STAGE_TABLE[s.model] = buildStages(s.builtYear, s.buildYears);
}

/** "Plato's Atlantis, imagined" switched on in the Richat panel. */
let atlantisVision = false;
/** Show (or hide) the imagined Atlantis on the Richat. */
export function setAtlantisVision(on: boolean): void {
  if (on === atlantisVision) return;
  atlantisVision = on;
  for (const { entity, p } of entities) if (p.model === 'rings') gate(entity, p);
  showEstuary(on);
  theViewer?.scene.requestRender();
}
/** The estuary ribbon (our invention, not Plato's) — built on first use. */
let estuary: Cesium.Entity[] = [];
function showEstuary(on: boolean): void {
  if (!theViewer) return;
  if (on && !estuary.length) {
    const sea = Cesium.Color.fromCssColorString('#2f6f9c');
    // Lite gets fewer quads; either way a few KB, draped on the real terrain.
    const segs = estuaryRibbon(budgetTier() === 'software' ? 5 : 10);
    estuary = segs.map((g) => theViewer!.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(g.ring.flat())),
        material: sea.withAlpha(g.alpha),
        classificationType: Cesium.ClassificationType.TERRAIN,
      },
    }));
  }
  for (const e of estuary) e.show = on;
}
export function isAtlantisVision(): boolean {
  return atlantisVision;
}

function gate(entity: Cesium.Entity, p: Placement): void {
  if (p.model === 'rings') {
    // The vision is a toggle, never the default — and never a timeline event.
    entity.show = atlantisVision && cameraNear(p);
    if (!entity.model) return;
    // Phones / no-GPU machines get the light build (same plan, same footprint).
    const lite = budgetTier() === 'software' && theManifest['rings-lite']?.footprint;
    const uri = `./models/${lite ? 'rings-lite' : 'rings'}.glb`;
    const current = (entity.model.uri as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());
    if (current !== uri) entity.model.uri = new Cesium.ConstantProperty(uri);
    if (entity.show) loadWatch?.watch(entity.id, uri);
    return;
  }
  const curYear = yearsBPToYear(lastYearsBP);
  const { suffix: staged, bornYear } = stageFor(p.model, p.builtYear, curYear);
  // Only ever point at a stage glb we actually exported; else fall back to base.
  let suffix = staged && theManifest[`${p.model}${staged}`]?.footprint ? staged : '';
  // The ruin we know overrides once its date arrives.
  if (p.ruinYear != null && curYear >= p.ruinYear && theManifest[`${p.model}-ruin`]?.footprint) {
    suffix = '-ruin';
  }

  const born = curYear >= bornYear;
  const gone = p.endYear != null && lastYearsBP < yearToYearsBP(p.endYear);
  const buried = p.buried != null && curYear >= p.buried[0] && curYear < p.buried[1];
  // A generic stand-in never shows beside a whole-site ground plan — even one
  // placed by a dive before the plans finished loading.
  const supplanted = !!p.generic && sitePlanNear(p.lat, p.lon);
  entity.show = lastShowSites && born && !gone && !buried && !supplanted && cameraNear(p);
  if (entity.show && !p.sinkM && !baseGround.has(entity.id) && !grounding.has(entity.id)) void findBase(entity, p);
  gateClip(entity, p);
  // The photo comes true at the ruin date (or, with no ruin, the build date).
  const patches = covers.get(entity.id);
  if (patches) {
    const trueFrom = typeof p.cover?.until === 'number'
      ? p.cover.until
      : p.cover?.until === 'built'
      ? p.builtYear
      : p.ruinYear != null && theManifest[`${p.model}-ruin`]?.footprint ? p.ruinYear : bornYear;
    const on = lastShowSites && !supplanted && cameraNear(p) && curYear < trueFrom;
    for (const c of patches) {
      const w = coverWindow.get(c);
      const show = on && (!w || ((w[0] == null || curYear >= w[0]) && (w[1] == null || curYear < w[1])));
      if (c.show !== show) c.show = show;
    }
  }

  if (!entity.model) return;
  const uri = `./models/${fileFor(p.model + suffix)}.glb`;
  const current = (entity.model.uri as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());
  if (current !== uri) entity.model.uri = new Cesium.ConstantProperty(uri);
  if (entity.show) loadWatch?.watch(entity.id, uri);
}

/** Timeline + layer gate — call whenever the year or the Sites toggle moves. */
export function updateGlobeModelVisibility(currentYearsBP: number, showSites: boolean): void {
  lastYearsBP = currentYearsBP;
  lastShowSites = showSites;
  for (const { entity, p } of entities) gate(entity, p);
  gateCauseways();
}
