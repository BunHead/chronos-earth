/**
 * landmarkMesh.ts — 3D monuments batch 2 (18 Oct 2026): three landmarks whose
 * shape is well documented, built procedurally in TRUE METRES.
 *
 * Spencer's rules: only where the shape is well documented; no model is better
 * than a wrong one; small files. Each is a representation based on best known
 * evidence — the info panel says so (LANDMARK_NOTE).
 *
 *  - 'temple-of-heaven'  Hall of Prayer for Good Harvests, Temple of Heaven,
 *                        Beijing (1420; rebuilt 1890 after the 1889 fire).
 *                        Round hall with three blue-tiled eaves and a gilded
 *                        finial, ~32.7 m across, on the three-tier white
 *                        marble Altar of Prayer for Grain (5.6 m high; tiers
 *                        91 / 80 / 68 m across). Top of finial 38 m above the
 *                        ground. Sources give 38 m both with and without the
 *                        terrace; we take it to the ground (the lower figure).
 *                        https://en.wikipedia.org/wiki/Hall_of_Prayer_for_Good_Harvests
 *  - 'trajans-column'    Trajan's Column, Rome (AD 113). Carrara marble: the
 *                        column proper 29.78 m on a 5.29 m pedestal, 35.07 m in
 *                        all; shaft 3.7 m across. The bronze St Peter (1587)
 *                        on top is LEFT OFF — its size is not well documented.
 *                        https://en.wikipedia.org/wiki/Trajan%27s_Column ·
 *                        https://www.wikidata.org/wiki/Q192784
 *  - 'pompeys-pillar'    Pompey's Pillar, Alexandria (AD 298–302). One red
 *                        Aswan granite shaft 20.46 m tall, 2.71 m across at
 *                        its foot, with a Corinthian capital on a pedestal:
 *                        26.85 m in all.
 *                        https://en.wikipedia.org/wiki/Pompey%27s_Pillar_(column)
 *
 * Proportions not in those sources (eave heights, the pedestals' widths, the
 * capitals) are read off photographs and drawings and are approximate.
 *
 * Units: y up, y = 0 the ground; x east, z south (facing 0 on the globe). All
 * three are symmetric about y, so facing does not matter. Pure numbers, no
 * three.js: the in-app viewer (Monument3D) and the .glb generator
 * (scripts/build-landmark-models.mjs) both draw from it. Deterministic.
 */

export type LandmarkModel = 'temple-of-heaven' | 'trajans-column' | 'pompeys-pillar';
export const LANDMARK_MODELS: readonly LandmarkModel[] = ['temple-of-heaven', 'trajans-column', 'pompeys-pillar'];

/** Documented heights (m), ground to top, as built here — the tests hold the models to these. */
export const LANDMARK_HEIGHT_M: Record<LandmarkModel, number> = {
  'temple-of-heaven': 38,
  'trajans-column': 35.07,
  'pompeys-pillar': 26.85,
};

export interface LandmarkMesh {
  positions: Float32Array; // xyz
  normals: Float32Array; // xyz
  colors: Float32Array; // linear rgb, 0..1
  indices: Uint32Array;
}

/** sRGB hex → linear rgb (glTF vertex colours are linear). */
function lin(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}

class Builder {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  i: number[] = [];

  /**
   * A solid of revolution about the y axis. `profile` runs [radius, y] from the
   * bottom up; each pair of points is one flat-shaded band (so a ledge or an
   * eave stays crisp). A radius of 0 closes the end.
   */
  lathe(profile: Array<[number, number]>, hex: string, seg = 32): void {
    const col = lin(hex);
    for (let k = 0; k < profile.length - 1; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
      // Outward normal of the band, in its (r, y) plane.
      const dr = r1 - r0, dy = y1 - y0, len = Math.hypot(dr, dy) || 1;
      const nr = dy / len, ny = -dr / len;
      const base = this.p.length / 3;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        this.p.push(r0 * ca, y0, r0 * sa, r1 * ca, y1, r1 * sa);
        this.n.push(nr * ca, ny, nr * sa, nr * ca, ny, nr * sa);
        this.c.push(...col, ...col);
      }
      for (let s = 0; s < seg; s++) {
        const a = base + s * 2;
        this.i.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
  }

  /** An axis-aligned box centred at (x, y, z), size w × h × d. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, hex: string): void {
    const col = lin(hex);
    const faces: Array<[[number, number, number], Array<[number, number, number]>]> = [
      [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
      [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
      [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
      [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
      [[0, 0, 1], [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]],
      [[0, 0, -1], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
    ];
    for (const [nrm, corners] of faces) {
      const base = this.p.length / 3;
      for (const [a, b, cc] of corners) {
        this.p.push(x + (a * w) / 2, y + (b * h) / 2, z + (cc * d) / 2);
        this.n.push(...nrm);
        this.c.push(...col);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  done(): LandmarkMesh {
    return {
      positions: Float32Array.from(this.p),
      normals: Float32Array.from(this.n),
      colors: Float32Array.from(this.c),
      indices: Uint32Array.from(this.i),
    };
  }
}

const MARBLE = '#e9e5da';
const MARBLE_SHADE = '#d6d1c4';
const HALL_RED = '#9e2f22';
const ROOF_BLUE = '#2d5aa0';
const EAVE_PAINT = '#2f6b62'; // the blue-green painted brackets under each eave
const GILT = '#c9a23a';

/** The Hall of Prayer for Good Harvests on its three-tier marble altar. */
function templeOfHeaven(): LandmarkMesh {
  const b = new Builder();
  const SEG = 48;
  // The Altar of Prayer for Grain: three round tiers, 91 / 80 / 68 m across,
  // 5.6 m high in all, each ringed by a white marble balustrade.
  const TIERS: Array<[number, number, number]> = [
    [45.5, 0, 1.9],
    [40, 1.9, 3.75],
    [34, 3.75, 5.6],
  ];
  for (const [r, y0, y1] of TIERS) {
    b.lathe([[0, y0], [r, y0], [r, y1], [0, y1]], MARBLE, SEG);
    // Balustrade: a thin ring 1 m tall just inside the edge.
    b.lathe([[r - 0.1, y1], [r - 0.1, y1 + 1], [r - 0.5, y1 + 1], [r - 0.5, y1]], MARBLE_SHADE, SEG);
  }
  // The flights of steps up the altar on its four sides (the grand approach
  // is from the south), as plain ramps of stair-coloured marble.
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const len = 12, w = 9, mid = 34 + len / 2 - 1;
    for (let s = 0; s < 6; s++) {
      const h = 5.6 * (1 - s / 6);
      const off = mid - len / 2 + (s + 0.5) * (len / 6);
      b.box(dx * off, h / 2, dz * off, dx ? len / 6 : w, h, dz ? len / 6 : w, MARBLE_SHADE);
    }
  }
  // The hall: red columns and lattice walls under three blue-tiled eaves,
  // the lowest 32.7 m across, rising to the gilded finial at 38 m.
  const Y0 = 5.6;
  b.lathe([[0, Y0], [14.5, Y0], [14.5, Y0 + 0.9], [0, Y0 + 0.9]], MARBLE, SEG); // the hall's own marble plinth
  const tiers: Array<{ wallR: number; wall0: number; wall1: number; eaveR: number; eaveY: number; topR: number; topY: number }> = [
    { wallR: 12.5, wall0: Y0 + 0.9, wall1: 15.5, eaveR: 16.35, eaveY: 14.6, topR: 11.2, topY: 18.0 },
    { wallR: 10.6, wall0: 18.0, wall1: 21.6, eaveR: 13.6, eaveY: 21.0, topR: 9.0, topY: 24.2 },
    { wallR: 8.6, wall0: 24.2, wall1: 27.4, eaveR: 11.2, eaveY: 26.9, topR: 0.9, topY: 35.6 },
  ];
  for (const t of tiers) {
    b.lathe([[t.wallR, t.wall0], [t.wallR, t.wall1]], HALL_RED, SEG);
    // Painted bracket band under the eave, then the tiled roof sweeping up.
    b.lathe([[t.wallR, t.eaveY - 1.2], [t.eaveR - 0.4, t.eaveY - 0.3]], EAVE_PAINT, SEG);
    b.lathe([[t.eaveR - 0.4, t.eaveY - 0.3], [t.eaveR, t.eaveY], [t.topR, t.topY]], ROOF_BLUE, SEG);
    if (t.topR > 1) b.lathe([[t.topR, t.topY], [0, t.topY]], ROOF_BLUE, SEG);
  }
  // The gilded finial.
  b.lathe([[0.9, 35.6], [1.3, 36.2], [1.0, 36.9], [0.5, 37.4], [0.15, 38], [0, 38]], GILT, 16);
  return b.done();
}

const COLUMN_MARBLE = '#ddd6c8';

/** Trajan's Column: pedestal, torus base, tapering shaft, Doric capital. */
function trajansColumn(): LandmarkMesh {
  const b = new Builder();
  const SEG = 36;
  // The pedestal (5.29 m), about 5.5 m square, with a plinth and a cornice.
  b.box(0, 0.25, 0, 6.2, 0.5, 6.2, COLUMN_MARBLE);
  b.box(0, 2.7, 0, 5.5, 4.4, 5.5, COLUMN_MARBLE);
  b.box(0, 5.04, 0, 6.0, 0.5, 6.0, '#d2cbbc');
  // The column proper, 29.78 m: a laurel torus base, the frieze-wound shaft
  // (3.7 m across at its foot, narrowing a little), the capital and abacus.
  const P = 5.29;
  b.lathe([[0, P], [2.4, P], [2.5, P + 0.6], [2.25, P + 1.4], [1.85, P + 1.6]], COLUMN_MARBLE, SEG);
  b.lathe([[1.85, P + 1.6], [1.8, P + 10], [1.72, P + 18], [1.6, P + 26.2]], COLUMN_MARBLE, SEG);
  b.lathe([[1.6, P + 26.2], [1.75, P + 26.5], [2.15, P + 27.4]], '#d2cbbc', SEG);
  b.box(0, P + 27.9, 0, 4.3, 1.0, 4.3, COLUMN_MARBLE);
  // The small drum on top that now carries St Peter (statue not modelled).
  b.lathe([[0, P + 28.4], [1.3, P + 28.4], [1.3, P + 29.78], [0, P + 29.78]], '#d2cbbc', 24);
  return b.done();
}

const GRANITE = '#b47766';
const GRANITE_DARK = '#9a6556';

/** Pompey's Pillar: pedestal, base, the red granite shaft, Corinthian capital. */
function pompeysPillar(): LandmarkMesh {
  const b = new Builder();
  const SEG = 32;
  // The pedestal, about 3 m tall and 4.5 m square, on its stone footing.
  b.box(0, 0.3, 0, 5.4, 0.6, 5.4, '#a99a86');
  b.box(0, 1.8, 0, 4.5, 2.4, 4.5, GRANITE_DARK);
  // Attic base under the shaft.
  const B = 3.0;
  b.lathe([[0, B], [1.75, B], [1.75, B + 0.3], [1.55, B + 0.5], [1.36, B + 0.6]], GRANITE, SEG);
  // The monolithic shaft: 20.46 m, 2.71 m across at its foot, ~2.3 m at its top.
  const S0 = B + 0.6, S1 = S0 + 20.46;
  b.lathe([[1.355, S0], [1.33, S0 + 8], [1.25, S0 + 15], [1.15, S1]], GRANITE, SEG);
  // The Corinthian capital (a flared bell) and its square abacus: 26.85 m in all.
  b.lathe([[1.15, S1], [1.3, S1 + 0.8], [1.6, S1 + 1.5], [1.85, S1 + 1.9]], GRANITE_DARK, SEG);
  b.box(0, (S1 + 1.9 + 26.85) / 2, 0, 3.9, 26.85 - (S1 + 1.9), 3.9, GRANITE_DARK);
  return b.done();
}

export function landmarkMesh(model: LandmarkModel): LandmarkMesh {
  if (model === 'temple-of-heaven') return templeOfHeaven();
  if (model === 'trajans-column') return trajansColumn();
  return pompeysPillar();
}

export function isLandmarkModel(model: string): model is LandmarkModel {
  return (LANDMARK_MODELS as readonly string[]).includes(model);
}

/** Lowest and highest y, and the widest horizontal span (m). */
export function landmarkBounds(m: LandmarkMesh): { minY: number; maxY: number; span: number } {
  let minY = Infinity, maxY = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2];
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { minY, maxY, span: Math.max(x1 - x0, z1 - z0) };
}

/** The info-panel note: each is a representation, and says so. */
export const LANDMARK_NOTE: Record<LandmarkModel, string> = {
  'temple-of-heaven':
    '3D Hall of Prayer for Good Harvests: a representation based on best known evidence (about 38 m tall and ' +
    '32.7 m across, on a three-tier white marble terrace 5.6 m high). Eave heights are approximate.',
  'trajans-column':
    "3D Trajan's Column: a representation based on best known evidence (35.07 m with its pedestal; shaft 3.7 m " +
    'across). The spiral frieze and the statue of St Peter on top are not modelled.',
  'pompeys-pillar':
    "3D Pompey's Pillar: a representation based on best known evidence (26.85 m in all; one red granite shaft " +
    '20.46 m tall, 2.71 m across at its foot). Pedestal and capital proportions are approximate.',
};

export function landmarkNote(monument: { model: string } | null | undefined): string | null {
  return monument && isLandmarkModel(monument.model) ? LANDMARK_NOTE[monument.model] : null;
}
