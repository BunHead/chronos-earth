// Chronos Earth — sizing & orienting every monument on real ground.
//
// The Stonehenge fix taught us a monument needs three real-world facts to sit
// right on the satellite: its real SIZE (so it doesn't dwarf the imagery), the
// ZOOM that frames it, and which way it FACES. This turns that hand-work into a
// table + a formula so every archetype sizes and orients itself. Marquee sites
// get exact figures; the long tail falls back to a sensible per-archetype guess
// until the harvest can fetch real dimensions from Wikidata.

export interface MonumentFit {
  /** Real-world footprint width in metres. */
  widthM: number;
  /** Compass bearing the model's front (local +Z) should face, degrees from N. */
  facingDeg: number;
}

// Specific, well-known monuments — real footprint (m) and facing where known.
// `match` is a lowercase substring of the title (first hit wins).
const KNOWN: Array<{ match: string; widthM: number; facingDeg?: number }> = [
  { match: 'giza', widthM: 230 },
  { match: 'great pyramid', widthM: 230 },
  { match: 'pyramid of the sun', widthM: 220 },
  { match: 'teotihuac', widthM: 220 },
  { match: 'sphinx', widthM: 73, facingDeg: 90 }, // the Sphinx faces due east
  { match: 'colosseum', widthM: 190 },
  { match: 'parthenon', widthM: 70, facingDeg: 90 }, // Greek temples face east
  { match: 'notre-dame', widthM: 130, facingDeg: 90 },
  { match: 'notre dame', widthM: 130, facingDeg: 90 },
  { match: 'hagia sophia', widthM: 82 },
  { match: 'pantheon', widthM: 44 },
  { match: 'taj mahal', widthM: 95 },
  { match: 'angkor wat', widthM: 200, facingDeg: 270 }, // Angkor Wat faces west
  { match: 'borobudur', widthM: 123 },
  { match: 'chich', widthM: 55 },
  { match: 'kukulc', widthM: 55 },
  { match: 'tikal', widthM: 55 },
  { match: 'machu picchu', widthM: 200 },
  { match: 'petra', widthM: 40 },
  { match: 'karnak', widthM: 200 },
  { match: 'abu simbel', widthM: 38, facingDeg: 90 }, // the great temple faces east
  { match: 'nottingham castle', widthM: 85, facingDeg: 200 }, // on its crag above the city
];

// Per-archetype fallback: a typical real footprint (m) and a default facing.
const BY_MODEL: Record<string, MonumentFit> = {
  tpillars: { widthM: 30, facingDeg: 0 },
  stonehenge: { widthM: 110, facingDeg: 0 },
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
  'leaning-tower': { widthM: 20, facingDeg: 0 },
  impact: { widthM: 120, facingDeg: 0 },
  megalith: { widthM: 45, facingDeg: 0 },
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
const OCCUPANCY = 0.32;
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
