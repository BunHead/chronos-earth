// Chronos Earth — sizing & orienting every monument on real ground.
//
// The Stonehenge fix taught us a monument needs three real-world facts to sit
// right on the satellite: its real SIZE (so it doesn't dwarf the imagery), the
// ZOOM that frames it, and which way it FACES. This turns that hand-work into a
// table + a formula so every archetype sizes and orients itself. Marquee sites
// get exact figures; the long tail falls back to a sensible per-archetype guess
// until the harvest can fetch real dimensions from Wikidata.

import MESO_TEMPLES from '../data/meso-temples.json';

export interface MonumentFit {
  /** Real-world footprint width in metres. */
  widthM: number;
  /** Compass bearing the model's front (local +Z) should face, degrees from N. */
  facingDeg: number;
}

// Specific, well-known monuments — real footprint (m) and facing where known.
// `match` is a lowercase substring of the title (first hit wins).
const KNOWN: Array<{ match: string; widthM: number; facingDeg?: number }> = [
  // The Giza pyramids, each its own true-metre model (Monument3D buildGizaPart):
  // widths are the real bases (Wikipedia; Verner 2007). Before 'giza' — first hit wins.
  { match: 'pyramid of khufu', widthM: 230.33, facingDeg: 0 },
  { match: 'pyramid of khafre', widthM: 215.25, facingDeg: 0 },
  { match: 'pyramid of menkaure', widthM: 104.6, facingDeg: 0 },
  { match: 'pyramid g1-a', widthM: 49.5, facingDeg: 0 },
  { match: 'pyramid g1-b', widthM: 49.5, facingDeg: 0 },
  { match: 'pyramid g1-c', widthM: 46.25, facingDeg: 0 },
  { match: 'pyramid g3-a', widthM: 44, facingDeg: 0 },
  { match: 'pyramid g3-b', widthM: 31, facingDeg: 0 },
  { match: 'pyramid g3-c', widthM: 31, facingDeg: 0 },
  { match: 'giza pyramids', widthM: 1000 }, // whole plateau: Menkaure west edge → Sphinx east edge
  // 'sphinx' MUST precede 'giza': first-hit-wins, and "Great Sphinx of Giza"
  // contains "giza" — without this it sized as the 230 m pyramid base, not the
  // 73 m lion (the Captain's "grew up" behemoth).
  { match: 'sphinx', widthM: 73, facingDeg: 90 }, // the Sphinx faces due east
  { match: 'giza', widthM: 230 },
  { match: 'great pyramid', widthM: 230 },
  { match: 'pyramid of the sun', widthM: 220 },
  { match: 'teotihuac', widthM: 220 },
  { match: 'colosseum', widthM: 190 },
  { match: 'parthenon', widthM: 70, facingDeg: 0 }, // long axis E–W on the Acropolis; model long axis=local X, so θ=0 lays it E–W (facing 90 wrongly ran it N–S)
  { match: 'notre-dame', widthM: 130, facingDeg: 242.5 }, // Captain's globe eyeball 2026-07-12: 30° clockwise from 270 overshot by 2–3°, eased back
  { match: 'notre dame', widthM: 130, facingDeg: 242.5 }, // Captain's globe eyeball 2026-07-12: matches the hyphenated entry above
  // The Paris trio. Bearings READ off geo calibration plan-renders 2026-07-12:
  // the Eiffel Tower's faces look NW to the Trocadéro, piers at the cardinal
  // corners (B≈315 → θ=180−315≡225 — confirmed against the Champ-de-Mars axis);
  // the Arc's front faces SE down the Champs-Élysées (B≈115 → θ=65, long axis
  // 25/205 matches the real footprint); the Louvre's court opens west to the
  // Tuileries with the wings dipping ~7° south of east along the Seine
  // (opening B≈277.5 → θ=262.5 — plain 270 sat visibly untilted on the imagery).
  { match: 'eiffel', widthM: 125, facingDeg: 225 },
  { match: 'arc de triomphe', widthM: 45, facingDeg: 65 },
  { match: 'arc-triomphe', widthM: 45, facingDeg: 65 },
  { match: 'louvre', widthM: 300, facingDeg: 262.5 },
  { match: 'hagia sophia', widthM: 82 },
  { match: 'pantheon', widthM: 44 },
  { match: 'taj mahal', widthM: 95 },
  { match: 'angkor wat', widthM: 200, facingDeg: 270 }, // Angkor Wat faces west
  { match: 'borobudur', widthM: 123 },
  // Eridu's ziggurat platform is about 61 m × 46 m; the model carries the tell
  // it stands on as well, so the fit is set to the mound, not the brickwork.
  // Amar-Sin's stair faced north-east → θ = 180 − 45 = 135, so facingDeg 45.
  { match: 'eridu', widthM: 95, facingDeg: 45 },
  { match: 'ziggurat', widthM: 85, facingDeg: 45 },
  { match: 'chich', widthM: 55 },
  { match: 'kukulc', widthM: 55 },
  { match: 'tikal', widthM: 55 },
  // Machu Picchu is authored in TRUE site metres around its pin (x east, z
  // south; OSM footprints + DEM), so its facing is 0 and its width is simply
  // the model's own span: the citadel, its terraces and the forested fall
  // around them run 560 m north–south.
  { match: 'machu picchu', widthM: 560, facingDeg: 0 },
  { match: 'petra', widthM: 40 },
  { match: 'karnak', widthM: 200 },
  { match: 'abu simbel', widthM: 38, facingDeg: 90 }, // the great temple faces east
  { match: 'nottingham castle', widthM: 85, facingDeg: 200 }, // on its crag above the city
  { match: 'richat', widthM: 12000 }, // ~40 km across — 'Visit' frames the real landform (Plato's city is a toggle)
  // London expansion — real footprints (m); facings READ off geo plan-renders
  // on the real satellite imagery 2026-07-12 (world −Z = north, +X = east).
  { match: 'tower bridge', widthM: 260, facingDeg: 90 }, // span crosses the Thames ~N–S
  { match: "st paul", widthM: 75, facingDeg: 245 }, // west front to the WSW, nave ENE–WSW
  { match: "st. paul", widthM: 75, facingDeg: 245 },
  { match: 'tower of london', widthM: 36, facingDeg: 20 }, // the White Tower, slightly off-cardinal
  { match: 'white tower', widthM: 36, facingDeg: 20 },
  { match: 'the shard', widthM: 55 }, // rotationally near-symmetric — facing immaterial
  { match: '30 st mary axe', widthM: 50 },
  { match: 'gherkin', widthM: 50 },
  // Sydney Opera House on Bennelong Point (southern hemisphere). Facing READ off
  // the geo plan-render on the real footprint 2026-07-12: the sails open to the
  // harbour (~NNE) so the Monumental Steps / front (+Z) face the land ~SSW.
  { match: 'sydney opera', widthM: 185, facingDeg: 205 },
  { match: 'opera house', widthM: 185, facingDeg: 205 },
];

// Per-archetype fallback: a typical real footprint (m) and a default facing.
const BY_MODEL: Record<string, MonumentFit> = {
  tpillars: { widthM: 30, facingDeg: 0 },
  stonehenge: { widthM: 110, facingDeg: 0 },
  // Authored in true metres (stonehengeSite.ts), so widthM = the exported
  // footprint and the site stands at scale 1; north-aligned like Giza.
  'stonehenge-site': { widthM: 124.3, facingDeg: 0 },
  'round-barrow': { widthM: 24, facingDeg: 0 },
  pyramid: { widthM: 200, facingDeg: 0 },
  'stepped-pyramid': { widthM: 120, facingDeg: 0 },
  sphinx: { widthM: 73, facingDeg: 90 },
  circle: { widthM: 40, facingDeg: 0 },
  settlement: { widthM: 90, facingDeg: 0 },
  castle: { widthM: 120, facingDeg: 0 },
  mansion: { widthM: 65, facingDeg: 0 },
  cathedral: { widthM: 110, facingDeg: 90 },
  'greek-temple': { widthM: 65, facingDeg: 90 },
  'temple-tower': { widthM: 60, facingDeg: 0 },
  aqueduct: { widthM: 200, facingDeg: 0 },
  pagoda: { widthM: 30, facingDeg: 0 },
  lighthouse: { widthM: 25, facingDeg: 0 },
  'leaning-tower': { widthM: 21, facingDeg: 0 }, // widest axis N–S: 18.8 m base steps plus the ~3.9 m southward lean of the top; facing 0 keeps the authored +Z lean pointing south
  amphitheatre: { widthM: 150, facingDeg: 0 },
  impact: { widthM: 120, facingDeg: 0 },
  // Built in TRUE METRES (lib/precursorMesh.ts), so the width is the model's
  // own span — scale ×1 — and facing 0 keeps its x east, z south.
  'ravne-tunnels': { widthM: 144.164, facingDeg: 0 },
  'bimini-beachrock': { widthM: 570.995, facingDeg: 0 },
  'yonaguni-rock': { widthM: 220, facingDeg: 0 },
  megalith: { widthM: 45, facingDeg: 0 },
  // Plato's Atlantis, imagined (components/atlantisCity.ts): TRUE scale — the
  // exported footprint is 2491.1 units of 10 m. facingDeg −90 turns the
  // canal (local +Z) to bearing 270°: due west, toward the Atlantic.
  rings: { widthM: 24911, facingDeg: -90 },
  // Seven Wonders of the Ancient World — real footprints (m) of what stood.
  'hanging-gardens': { widthM: 120, facingDeg: 0 },
  'zeus-statue': { widthM: 40, facingDeg: 0 },
  'artemis-temple': { widthM: 115, facingDeg: 0 },
  mausoleum: { widthM: 40, facingDeg: 0 },
  colossus: { widthM: 18, facingDeg: 0 },
  pharos: { widthM: 50, facingDeg: 0 },
  giza: { widthM: 1000, facingDeg: 0 }, // the whole plateau scene
  'giza-khufu': { widthM: 230.33, facingDeg: 0 },
  'giza-khafre': { widthM: 215.25, facingDeg: 0 },
  'giza-menkaure': { widthM: 104.6, facingDeg: 0 },
  'giza-queen': { widthM: 49.5, facingDeg: 0 },
  'giza-queen-step': { widthM: 31, facingDeg: 0 },
  // London landmarks — real footprints (m). Facing numbers were READ off
  // calibration plan-renders on real satellite terrain (world −Z = imagery
  // north, +X = imagery east — confirmed at Westminster), not guessed.
  buckingham: { widthM: 108, facingDeg: 90 }, // East Front faces the Victoria Memorial (east)
  westminster: { widthM: 265, facingDeg: 90 },
  // True metres on the OSM plan, north-aligned (westminsterSite.ts): scale 1.
  'westminster-site': { widthM: 302.0, facingDeg: 0 }, // long axis along the Thames, Elizabeth Tower at the north end
  'london-eye': { widthM: 130, facingDeg: 270 }, // wheel parallel to the river, A-frame on the east (land) side
  'tower-bridge': { widthM: 260, facingDeg: 90 }, // deck spans the Thames ~N–S
  'st-pauls': { widthM: 75, facingDeg: 245 }, // west front to the WSW
  'tower-of-london': { widthM: 170, facingDeg: 20 }, // the whole moated fortress (~170 m); keeps the White Tower ~36 m
  shard: { widthM: 55, facingDeg: 0 }, // rotationally symmetric
  gherkin: { widthM: 50, facingDeg: 0 },
  // The Paris trio — same bearings as their KNOWN rows above.
  eiffel: { widthM: 125, facingDeg: 225 },
  'arc-triomphe': { widthM: 45, facingDeg: 65 },
  louvre: { widthM: 300, facingDeg: 262.5 },
  // Liberty Island: Fort Wood's star is ~100 m across; she faces ~SE (bearing
  // ~135°, toward ships entering the harbour) → θ = 180 − 135 = 45.
  liberty: { widthM: 100, facingDeg: 45 },
  'machu-picchu': { widthM: 560, facingDeg: 0 }, // authored north-up in true metres
  'terracotta-army': { widthM: 266, facingDeg: 0 }, // Pit 1 (230 m) + its rim, authored north-up in true metres
  'opera-house': { widthM: 185, facingDeg: 205 }, // sails open to the harbour NNE; steps/front face the land SSW
  // Whole-site temples (src/data/meso-temples.json): authored in true metres
  // with the stair at +Z, so width = their own footprint and θ = 180 − bearing.
  ...Object.fromEntries(
    (MESO_TEMPLES as Array<{ model: string; widthM: number; depthM: number; stairBearing: number; radial?: boolean; stairsInOutline?: boolean }>).map((t) => [
      t.model,
      // A radial pyramid's stairs stand 4 m proud on every side (mesoTemple.ts),
      // so its exported footprint is 8 m wider than the measured body.
      { widthM: Math.max(t.widthM, t.depthM) + (t.radial && !t.stairsInOutline ? 8 : 0), facingDeg: (180 - t.stairBearing + 360) % 360 },
    ]),
  ),
};

const DEFAULT: MonumentFit = { widthM: 80, facingDeg: 0 };

/** Real size + facing for a monument, by name first, then archetype. */
export function fitFor(title: string, model: string): MonumentFit {
  const t = String(title).toLowerCase();
  for (const k of KNOWN) {
    if (t.includes(k.match)) {
      const base = BY_MODEL[model] ?? DEFAULT;
      return { widthM: k.widthM, facingDeg: k.facingDeg ?? base.facingDeg };
    }
  }
  return BY_MODEL[model] ?? DEFAULT;
}

const EARTH_M = 40_075_016.686; // equatorial circumference
/** Fraction of the ground view the monument should occupy — leaves context and
 * keeps the fixed camera framing it well for every archetype. */
const OCCUPANCY = 0.24;
/** The ground disc is CircleGeometry(40) → 80 units across, textured by a 3×3
 * satellite tile patch. */
const GROUND_UNITS = 80;
const TILE_PATCH = 3;

/**
 * Given a model's measured footprint (in scene units) and its real width, pick
 * the satellite zoom that frames it and the scale that makes it real-sized.
 * The result: every monument occupies ~OCCUPANCY of the view, at true scale on
 * imagery zoomed to match — so a 33 m ring and a 230 m pyramid both sit right.
 */
export function computeFit(footprintUnits: number, widthM: number, latDeg: number): { scale: number; zoom: number } {
  const cos = Math.max(0.05, Math.cos((latDeg * Math.PI) / 180));
  const targetGroundM = widthM / OCCUPANCY; // the 3-tile patch should span ~this
  const tileMeters = (z: number) => (EARTH_M / 2 ** z) * cos;
  let zoom = Math.round(Math.log2((EARTH_M * cos * TILE_PATCH) / targetGroundM));
  zoom = Math.min(19, Math.max(14, zoom));
  const metersPerUnit = (TILE_PATCH * tileMeters(zoom)) / GROUND_UNITS;
  const scale = widthM / (Math.max(0.001, footprintUnits) * metersPerUnit);
  return { scale, zoom };
}
