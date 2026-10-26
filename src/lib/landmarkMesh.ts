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

export type LandmarkModel = 'temple-of-heaven' | 'trajans-column' | 'pompeys-pillar' | 'great-wall' | 'forbidden-city';
export const LANDMARK_MODELS: readonly LandmarkModel[] = [
  'temple-of-heaven', 'trajans-column', 'pompeys-pillar', 'great-wall', 'forbidden-city',
];

/**
 * Dated stage files beside the base .glb (`{model}{suffix}.glb`), each in the
 * base model's own frame so the globe scales them alike. The years they stand
 * are in lib/stageTable.ts (the Great Wall) and lib/globeModels.ts (the
 * Forbidden City's 1406-1420 build window).
 */
export const LANDMARK_STAGES: Partial<Record<LandmarkModel, readonly string[]>> = {
  'great-wall': ['-b30', '-b60', '-ruin'],
  'forbidden-city': ['-b30', '-b60', '-b90'],
};

/** Documented heights (m), ground to top, as built here — the tests hold the models to these. */
export const LANDMARK_HEIGHT_M: Record<LandmarkModel, number> = {
  'temple-of-heaven': 38,
  'trajans-column': 35.07,
  'pompeys-pillar': 26.85,
  // Not a documented figure: the wall is 7.8 m on its ridge, and the ridge's
  // rise (55 m) is representative — see greatWall(). On a survey, the top of
  // the summit tower (13.8 m) above the highest crest.
  'great-wall': GREAT_WALL_PROFILE.path ? greatWallTop() : 68.8,
  'forbidden-city': 37.95, // the Meridian Gate (the Hall of Supreme Harmony is 35.05 m)
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

import { GREAT_WALL_PROFILE, type GreatWallProfile } from '../data/greatWallProfile.ts';

type V3 = [number, number, number];

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

  /** A flat quad a-b-c-d (a triangle if two corners meet), its front turned away from `ref`. */
  quad(a: V3, b: V3, c: V3, d: V3, hex: string, ref: V3): void {
    const col = lin(hex);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const m = [0, 1, 2].map((k) => (a[k] + b[k] + c[k] + d[k]) / 4);
    const out = nx * (m[0] - ref[0]) + ny * (m[1] - ref[1]) + nz * (m[2] - ref[2]) >= 0;
    const pts = out ? [a, b, c, d] : [a, d, c, b];
    if (!out) { nx = -nx; ny = -ny; nz = -nz; }
    const base = this.p.length / 3;
    for (const q of pts) {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(nx, ny, nz);
      this.c.push(...col);
    }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** A convex six-sided solid: four bottom corners in order round, then the four above them. */
  hex8(v: V3[], hex: string, topHex = hex): void {
    const ref: V3 = [0, 1, 2].map((k) => v.reduce((t, q) => t + q[k], 0) / 8) as V3;
    this.quad(v[0], v[1], v[2], v[3], hex, ref);
    this.quad(v[4], v[5], v[6], v[7], topHex, ref);
    for (let k = 0; k < 4; k++) this.quad(v[k], v[(k + 1) % 4], v[4 + ((k + 1) % 4)], v[4 + k], hex, ref);
  }

  /**
   * A box turned to run along (ux, uz) in plan: `len` along it, `thick` across,
   * from y0 to y1, centred on (x, z).
   */
  obox(x: number, z: number, ux: number, uz: number, len: number, thick: number, y0: number, y1: number, hex: string): void {
    const ax = (ux * len) / 2, az = (uz * len) / 2, sx = (-uz * thick) / 2, sz = (ux * thick) / 2;
    const ring: Array<[number, number]> = [[x - ax - sx, z - az - sz], [x + ax - sx, z + az - sz], [x + ax + sx, z + az + sz], [x - ax + sx, z - az + sz]];
    this.hex8([...ring.map(([px, pz]): V3 => [px, y0, pz]), ...ring.map(([px, pz]): V3 => [px, y1, pz])], hex);
  }

  /**
   * A Chinese hip roof (or one eave of a double roof) as a stack of rectangles
   * [half-width E-W, half-depth N-S, y] from the eave up, centred on (x, z):
   * each pair is one band of four faces, alternating tile colours so the glaze
   * reads as courses. Shallow at the eave and steep above it, so it sweeps.
   * `lift` (m) turns the eave's corners up, rising toward each corner along
   * the cubic of the distance from the eave's mid-point.
   */
  roof(x: number, z: number, levels: Array<[number, number, number]>, hex: string, alt: string, lift = 0): void {
    const ref: V3 = [x, levels[0][2] - 60, z];
    const corners = ([w, d, y]: [number, number, number]): V3[] => [[x - w, y, z - d], [x + w, y, z - d], [x + w, y, z + d], [x - w, y, z + d]];
    const N = 8;
    for (let k = 0; k < levels.length - 1; k++) {
      if (k === 0 && lift > 0) {
        const lo = corners(levels[0]), hi = corners(levels[1]);
        for (let e = 0; e < 4; e++) {
          const a = lo[e], bb = lo[(e + 1) % 4], ha = hi[e], hb = hi[(e + 1) % 4];
          // outward across this edge, in plan
          const ox = Math.sign((a[0] + bb[0]) / 2 - x), oz = Math.sign((a[2] + bb[2]) / 2 - z);
          const at = (u: number): [V3, V3] => {
            const t = Math.pow(Math.abs(2 * u - 1), 3);
            const l: V3 = [a[0] + (bb[0] - a[0]) * u + ox * t * lift * 0.6, a[1] + t * lift, a[2] + (bb[2] - a[2]) * u + oz * t * lift * 0.6];
            return [l, [ha[0] + (hb[0] - ha[0]) * u, ha[1], ha[2] + (hb[2] - ha[2]) * u]];
          };
          for (let i = 0; i < N; i++) {
            const [l0, h0] = at(i / N), [l1, h1] = at((i + 1) / N);
            this.quad(l0, l1, h1, h0, hex, ref);
          }
        }
        continue;
      }
      const lo = corners(levels[k]), hi = corners(levels[k + 1]);
      for (let e = 0; e < 4; e++) this.quad(lo[e], lo[(e + 1) % 4], hi[(e + 1) % 4], hi[e], k % 2 ? alt : hex, ref);
    }
    const top = corners(levels[levels.length - 1]);
    this.quad(top[0], top[1], top[2], top[3], alt, ref);
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
const ROOF_BLUE = '#1f3c78'; // deep cobalt glazed tiles
const ROOF_RIB = '#1a3363'; // the darker tile courses
const LATTICE = '#7c2a1e'; // the lattice doors and windows between the columns
const LATTICE_GILT = '#b8913a';
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
  // The hall (rebuilt 1889-96 to the Ming design): a ring of red columns with
  // lattice doors between, under three deep-blue glazed roofs that sweep up
  // at the eaves, the lowest 32.7 m across, to the gilded finial at 38 m.
  const Y0 = 5.6;
  b.lathe([[0, Y0], [15.2, Y0], [15.2, Y0 + 0.45], [14.6, Y0 + 0.45], [14.6, Y0 + 0.9], [0, Y0 + 0.9]], MARBLE, SEG); // the hall's own plinth
  const tiers: Array<{ wallR: number; wall0: number; wall1: number; eaveR: number; eaveY: number; topR: number; topY: number; cols: number }> = [
    { wallR: 12.5, wall0: Y0 + 0.9, wall1: 15.6, eaveR: 16.35, eaveY: 14.4, topR: 11.0, topY: 18.0, cols: 24 },
    { wallR: 10.4, wall0: 18.0, wall1: 21.7, eaveR: 13.7, eaveY: 20.9, topR: 8.8, topY: 24.3, cols: 16 },
    { wallR: 8.4, wall0: 24.3, wall1: 27.5, eaveR: 11.3, eaveY: 26.8, topR: 0.9, topY: 35.6, cols: 12 },
  ];
  for (const t of tiers) {
    // the drum: lattice doors, a gilt lintel band, and the red columns proud of it
    b.lathe([[t.wallR - 0.4, t.wall0], [t.wallR - 0.4, t.wall1 - 1.6]], LATTICE, SEG);
    b.lathe([[t.wallR - 0.4, t.wall1 - 1.6], [t.wallR - 0.4, t.wall1 - 1.1]], LATTICE_GILT, SEG);
    b.lathe([[t.wallR - 0.4, t.wall1 - 1.1], [t.wallR - 0.4, t.wall1]], HALL_RED, SEG);
    const colH = t.wall1 - 1.1 - t.wall0;
    for (let k = 0; k < t.cols; k++) {
      const a = (k / t.cols) * Math.PI * 2;
      b.box(Math.cos(a) * t.wallR, t.wall0 + colH / 2, Math.sin(a) * t.wallR, 0.75, colH, 0.75, HALL_RED);
    }
    // painted brackets under the eave
    b.lathe([[t.wallR, t.eaveY - 1.3], [t.eaveR - 0.6, t.eaveY - 0.35]], EAVE_PAINT, SEG);
    // the roof: a concave sweep, steep near the top and lifting at the eave,
    // in alternating tile courses so the glaze reads as rows of tiles
    const N = 8;
    const prof: Array<[number, number]> = [[t.eaveR - 0.6, t.eaveY - 0.35], [t.eaveR, t.eaveY + 0.15]];
    for (let k = 1; k <= N; k++) {
      const f = k / N;
      const r = t.eaveR + (t.topR - t.eaveR) * f;
      const y = t.eaveY + 0.15 + (t.topY - t.eaveY - 0.15) * Math.pow(f, 1.7); // concave
      prof.push([r, y]);
    }
    for (let k = 0; k < prof.length - 1; k++) b.lathe([prof[k], prof[k + 1]], k % 2 ? ROOF_RIB : ROOF_BLUE, SEG);
    if (t.topR > 1) {
      b.lathe([[t.topR, t.topY], [t.topR - 0.3, t.topY + 0.25], [0, t.topY + 0.25]], ROOF_RIB, SEG);
    }
  }
  // The gilded finial: a ring, a ball and a point.
  b.lathe([[0.95, 35.6], [1.35, 35.9], [1.35, 36.2], [0.7, 36.3], [1.05, 36.8], [0.95, 37.2], [0.45, 37.5], [0.12, 38], [0, 38]], GILT, 16);
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

/** A small deterministic hash in [0, 1), so the ruin crumbles the same way every build. */
function rnd(k: number): number {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const WALL_BRICK = '#948e83'; // Ming grey brick on dressed granite courses
const WALL_WALK = '#a8a294';
const WALL_MERLON = '#8b857a';
const WALL_WINDOW = '#5a5048';
const RAMMED_EARTH = '#a88a62';
const RUBBLE = '#8c8172';
const RIDGE = '#66723f'; // scrub and pine on the ridge
const RIDGE_ROCK = '#857c62';
const RUIN_GREEN = '#6f7a48';

/**
 * The Great Wall at Badaling, north-west of Beijing: a representative Ming
 * section (built 1505), about 740 m of wall climbing a ridge to two peaks,
 * with three brick watchtowers. The wall is 7.8 m tall, 6.5 m wide at its
 * foot and 5.8 m on top, with crenellated battlements on the outer (north-west)
 * side and a low parapet on the inner. It carries its own ridge (55 m at the
 * high peak): the real hills at Badaling are steeper and the real line winds
 * more — this is a representative section, not a survey of one.
 *
 * Stages (lib/stageTable.ts):
 *  -b30   555, Northern Qi: a rammed-earth wall along the pass, with beacon mounds
 *  -b60   1368 onward, early Ming (Xu Da fortifies Juyong Pass): rubble-faced wall, solid beacon towers
 *  ''     1505, the brick and stone wall with watchtowers (and again from 1957, restored)
 *  -ruin  Qing, unmaintained: battlements fallen, towers roofless, scrub on the walk
 * The earlier walls at this pass are known from texts and traces; their line
 * here is taken to be the Ming one, which is a simplification.
 */
/**
 * The wall's line in plan and its crest height along it, from the surveyed
 * profile when there is one (lib/data/greatWallProfile.ts), else the
 * representative ridge. `s` is metres along the wall; x east, z south, y up.
 * With a survey the real terrain carries the wall, so no ridge is drawn and
 * heights are relative to 1.5 m below its lowest ground (its buried footing);
 * `sinkM` is how far below the pin's ground that lies.
 */
function wallLine(profile: GreatWallProfile): {
  L: number; plan: (s: number) => [number, number]; crest: (s: number) => number; surveyed: boolean; sinkM: number | null;
} {
  if (profile.path && profile.path.length > 1 && profile.pin) {
    const { lat: lat0, lon: lon0, elevM } = profile.pin;
    const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180), kz = 111_320;
    const pts = profile.path.map(([la, lo, e]) => [(lo - lon0) * kx, -(la - lat0) * kz, e]);
    const base = Math.min(...pts.map((p) => p[2])) - 1.5;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    const lerp = (s: number, k: number) => {
      const t = Math.min(L, Math.max(0, s));
      let i = 1;
      while (i < cum.length - 1 && cum[i] < t) i++;
      const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return pts[i - 1][k] + (pts[i][k] - pts[i - 1][k]) * f;
    };
    return { L, plan: (s) => [lerp(s, 0), lerp(s, 1)], crest: (s) => lerp(s, 2) - base, surveyed: true, sinkM: elevM - base };
  }
  const L = 740;
  // The ridge's crest height along the wall: up to a peak, a saddle, a higher peak, down.
  const CTRL: Array<[number, number]> = [[0, 0], [60, 6], [200, 37], [255, 40], [390, 22], [520, 51], [575, 55], [690, 12], [740, 0]];
  const crest = (s: number): number => {
    for (let k = 0; k < CTRL.length - 1; k++) {
      const [s0, h0] = CTRL[k], [s1, h1] = CTRL[k + 1];
      if (s <= s1) return h0 + (h1 - h0) * (1 - Math.cos(((s - s0) / (s1 - s0)) * Math.PI)) / 2;
    }
    return 0;
  };
  // Plan: running SW → NE (bearing ~50°), winding gently. x east, z south.
  const ROT = (40 * Math.PI) / 180;
  const plan = (s: number): [number, number] => {
    const u = s - L / 2, w = 26 * Math.sin((s / L) * Math.PI * 2.6);
    return [u * Math.cos(ROT) + w * Math.sin(ROT), -u * Math.sin(ROT) + w * Math.cos(ROT)];
  };
  return { L, plan, crest, surveyed: false, sinkM: null };
}

function greatWallTop(): number {
  const { L, crest } = wallLine(GREAT_WALL_PROFILE);
  let top = 0;
  for (let s = 0; s <= L; s += 1) top = Math.max(top, crest(s));
  return top + 13.8;
}

/** Metres to sink the wall below the pin's ground on the globe: set only once it is surveyed. */
export const GREAT_WALL_SINK_M = wallLine(GREAT_WALL_PROFILE).sinkM;

/** Where the towers stand: the representative ones, or on a survey the three
 * highest crests at least 150 m apart (where Badaling's towers stand, on the
 * summits — their surveyed positions are not used). */
function towerSites(L: number, crest: (s: number) => number, surveyed: boolean): number[] {
  if (!surveyed) return [40, 255, 575];
  const cand: Array<[number, number]> = [];
  for (let s = 20; s <= L - 20; s += 5) {
    const h = crest(s);
    if (h >= crest(s - 15) && h >= crest(s + 15)) cand.push([s, h]);
  }
  const out: number[] = [];
  for (const [s] of cand.sort((a, c) => c[1] - a[1])) if (out.length < 3 && out.every((t) => Math.abs(t - s) >= 150)) out.push(s);
  return out.sort((a, c) => a - c);
}

function greatWall(stage: string, profile: GreatWallProfile = GREAT_WALL_PROFILE): LandmarkMesh {
  const b = new Builder();
  const { L, plan, crest, surveyed } = wallLine(profile);
  const dir = (s: number): [number, number] => {
    const [x0, z0] = plan(s - 1), [x1, z1] = plan(s + 1);
    const l = Math.hypot(x1 - x0, z1 - z0);
    return [(x1 - x0) / l, (z1 - z0) / l];
  };

  // The ridge: a strip of ground either side of the crest, falling to y = 0
  // (only on the representative ridge — a surveyed wall stands on the real one).
  const OFF = [-80, -45, -20, -7, 0, 7, 20, 45, 80];
  const fall = (o: number) => Math.pow(Math.max(0, 1 - Math.abs(o) / 80), 1.4);
  const STEP = 10;
  const grid: V3[][] = [];
  for (let s = 0; s <= L && !surveyed; s += STEP) {
    const [x, z] = plan(s), [ux, uz] = dir(s), h = crest(s);
    grid.push(OFF.map((o): V3 => [x - uz * o, Math.abs(o) < 8 ? h : h * fall(o), z + ux * o]));
  }
  for (let r = 0; r < grid.length - 1; r++) {
    for (let c = 0; c < OFF.length - 1; c++) {
      const a = grid[r][c], d = grid[r][c + 1], ref: V3 = [(a[0] + d[0]) / 2, -200, (a[2] + d[2]) / 2];
      b.quad(a, grid[r + 1][c], grid[r + 1][c + 1], d, rnd(r * 17 + c) < 0.14 ? RIDGE_ROCK : RIDGE, ref);
    }
  }

  // The wall, segment by segment along the crest.
  const SEG = 8;
  const towersAt = stage === '-b30' ? [] : towerSites(L, crest, surveyed);
  const inTower = (s: number) => towersAt.some((t) => Math.abs(s - t) < 6);
  const spec = stage === '-b30'
    ? { h: 4.5, wb: 6, wt: 2.6, hex: RAMMED_EARTH, walk: RAMMED_EARTH }
    : stage === '-b60'
    ? { h: 5.5, wb: 6, wt: 4.6, hex: RUBBLE, walk: RUBBLE }
    : { h: 6.1, wb: 6.5, wt: 5.8, hex: WALL_BRICK, walk: WALL_WALK };
  // On a survey the lowest segment end need not fall on a sample, so the
  // footing is carried down by the difference to stand exactly on y = 0.
  let foot = 0;
  if (surveyed) {
    foot = Infinity;
    for (let s = 0; s < L; s += SEG) foot = Math.min(foot, crest(s), crest(Math.min(L, s + SEG + 0.3)));
    foot -= 1.5;
  }
  for (let s = 0, k = 0; s < L; s += SEG, k++) {
    const s1 = Math.min(L, s + SEG + 0.3);
    const [x0, z0] = plan(s), [x1, z1] = plan(s1), g0 = crest(s), g1 = crest(s1);
    const [ux0, uz0] = dir(s), [ux1, uz1] = dir(s1);
    // The ruin: the walk worn down unevenly, a breach here and there.
    const drop = stage === '-ruin' ? (rnd(k) < 0.12 ? 3.2 : rnd(k + 99) * 1.2) : 0;
    const h = spec.h - drop;
    const at = (x: number, z: number, ux: number, uz: number, w: number, y: number, side: number): V3 => [x - uz * side * w / 2, y, z + ux * side * w / 2];
    const lo0 = Math.max(0, g0 - 1.5 - foot), lo1 = Math.max(0, g1 - 1.5 - foot);
    b.hex8([
      at(x0, z0, ux0, uz0, spec.wb, lo0, -1), at(x1, z1, ux1, uz1, spec.wb, lo1, -1),
      at(x1, z1, ux1, uz1, spec.wb, lo1, 1), at(x0, z0, ux0, uz0, spec.wb, lo0, 1),
      at(x0, z0, ux0, uz0, spec.wt, g0 + h, -1), at(x1, z1, ux1, uz1, spec.wt, g1 + h, -1),
      at(x1, z1, ux1, uz1, spec.wt, g1 + h, 1), at(x0, z0, ux0, uz0, spec.wt, g0 + h, 1),
    ], spec.hex, stage === '-ruin' && rnd(k + 7) < 0.4 ? RUIN_GREEN : spec.walk);
    if (stage === '-b30') continue;
    // Steep stretches of the Ming walk are stepped, not ramped: treads about
    // 0.3 m high (on the gentler ones, a plain ramp).
    if (stage !== '-b60' && Math.abs(g1 - g0) / (s1 - s) > 0.15) {
      const n = Math.max(2, Math.round(Math.abs(g1 - g0) / 0.3)), ds = (s1 - s) / n;
      for (let q = 0; q < n; q++) {
        const sa = s + q * ds, sb = sa + ds, [qx, qz] = plan((sa + sb) / 2), [qux, quz] = dir((sa + sb) / 2);
        const wa = crest(sa) + h, wb = crest(sb) + h;
        b.obox(qx, qz, qux, quz, ds + 0.02, spec.wt - 1.2, Math.min(wa, wb) - 0.05, Math.max(wa, wb), spec.walk);
      }
    }
    const mid = s + SEG / 2, [ux, uz] = dir(mid);
    if (inTower(mid)) continue;
    // A parapet strip along this segment, following the slope: `side` +1 the
    // inner (south-east) face, its 0.5 m thickness set in from the wall's edge.
    const parapet = (side: number, rise: number, hex: string) => {
      const o0 = spec.wt / 2, o1 = spec.wt / 2 - 0.5;
      const p = (x: number, z: number, ux: number, uz: number, o: number, y: number): V3 => [x - uz * side * o, y, z + ux * side * o];
      b.hex8([
        p(x0, z0, ux0, uz0, o0, g0 + h - 0.1), p(x1, z1, ux1, uz1, o0, g1 + h - 0.1), p(x1, z1, ux1, uz1, o1, g1 + h - 0.1), p(x0, z0, ux0, uz0, o1, g0 + h - 0.1),
        p(x0, z0, ux0, uz0, o0, g0 + h + rise), p(x1, z1, ux1, uz1, o0, g1 + h + rise), p(x1, z1, ux1, uz1, o1, g1 + h + rise), p(x0, z0, ux0, uz0, o1, g0 + h + rise),
      ], hex);
    };
    if (stage === '-b60') {
      // a low parapet both sides
      for (const side of [-1, 1]) parapet(side, 0.8, RUBBLE);
      continue;
    }
    // Inner (south-east) parapet, 1 m; mostly fallen in the ruin.
    if (stage !== '-ruin' || rnd(k + 31) < 0.3) {
      parapet(1, 1.0, WALL_MERLON);
    }
    // Outer battlements: three merlons per segment, 1.7 m, with crenels between.
    for (let m = 0; m < 3; m++) {
      if (stage === '-ruin' && rnd(k * 3 + m + 500) < 0.6) continue;
      const sm = s + (m + 0.5) * (SEG / 3), [px, pz] = plan(sm), gp = crest(sm) + h;
      b.obox(px + uz * (spec.wt / 2 - 0.28), pz - ux * (spec.wt / 2 - 0.28), ux, uz, 1.6, 0.56, gp - 0.1, gp + 1.7, WALL_MERLON);
    }
  }

  // Towers: the Ming wall's brick watchtowers (two storeys, arched windows,
  // a crenellated roof); the early Ming ones solid beacon towers. The Northern
  // Qi wall gets earthen beacon mounds on its two peaks.
  if (stage === '-b30') {
    for (const t of towerSites(L, crest, surveyed).slice(-2)) {
      const [x, z] = plan(t), g = crest(t), [ux, uz] = dir(t);
      const ring = (w: number, y: number): V3[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]): V3 => [x + (ux * a - uz * c) * w / 2, y, z + (uz * a + ux * c) * w / 2]);
      b.hex8([...ring(9, Math.max(0, g - 1.5)), ...ring(5, g + 7)], RAMMED_EARTH);
    }
  }
  for (const [ti, t] of towersAt.entries()) {
    const [x, z] = plan(t), g = crest(t), [ux, uz] = dir(t), lo = Math.max(0, g - 1.5);
    if (stage === '-b60') {
      b.obox(x, z, ux, uz, 8, 8, lo, g + 9, RUBBLE);
      continue;
    }
    // The ruin: the upper storey gone, one tower half fallen.
    const bodyTop = stage === '-ruin' ? g + (ti === 1 ? 7.5 : 10.5) : g + 12.5;
    b.obox(x, z, ux, uz, 11, 10.5, lo, bodyTop, WALL_BRICK);
    // A dressed stone footing, a band between the storeys.
    b.obox(x, z, ux, uz, 11.3, 10.8, lo, g + 2.2, '#a19a8c');
    if (bodyTop > g + 7.4) b.obox(x, z, ux, uz, 11.3, 10.8, g + 6.8, g + 7.4, WALL_WALK);
    // Arched windows, three a side along the wall and two at the ends.
    for (const [fu, fv, n, span] of [[0, 1, 3, 11], [0, -1, 3, 11], [1, 0, 2, 10.5], [-1, 0, 2, 10.5]] as const) {
      for (let w = 0; w < n; w++) {
        const off = (w - (n - 1) / 2) * (span / (n + 0.4));
        const depth = fu ? 5.55 : 5.3;
        const cx = x + ux * (fu * depth + (fv ? off : 0)) - uz * (fv * depth + (fu ? off : 0));
        const cz = z + uz * (fu * depth + (fv ? off : 0)) + ux * (fv * depth + (fu ? off : 0));
        const y0 = g + 8.2;
        if (y0 + 2.6 > bodyTop) continue;
        b.obox(cx, cz, fu ? -uz : ux, fu ? ux : uz, 1.3, 0.2, y0, y0 + 2.6, WALL_WINDOW);
      }
    }
    if (stage === '-ruin') continue;
    // Crenellated roof parapet: merlons round the top.
    for (let m = 0; m < 16; m++) {
      const e = m >> 2, f = ((m & 3) - 1.5) * 2.6;
      const [a, c] = [[f, -5.2], [5.5, f], [-f, 5.2], [-5.5, -f]][e];
      const along = e % 2 === 0;
      b.obox(x + ux * a - uz * c, z + uz * a + ux * c, along ? ux : -uz, along ? uz : ux, 1.5, 0.5, g + 12.4, g + 13.8, WALL_MERLON);
    }
    // the little guard-room on the roof of the highest tower
    if (ti === 2) b.obox(x, z, ux, uz, 4, 4, g + 12.4, g + 13.6, WALL_BRICK);
  }
  return b.done();
}

const FC_RED = '#9b3326'; // the vermilion plastered walls
const FC_COLUMN = '#a3301f';
const FC_YELLOW = '#d6a42c'; // imperial yellow glazed tiles
const FC_YELLOW_COURSE = '#bf8f26';
const FC_BRACKET = '#2f6b62'; // blue-green painted dougong under the eaves
const FC_BRACKET_BLUE = '#3a5a8a';
const FC_LATTICE = '#7c2a1e';
const FC_DOOR = '#5a463a';
const FC_MARBLE = '#e6e2d6';
const FC_MARBLE_SHADE = '#d2cdbf';
const FC_BRICK = '#8e8a82'; // the platform's brick before it is plastered red
const FC_TIMBER = '#a07850'; // bare timber, before the lacquer
const FC_BOARDS = '#8a6a48'; // roof boarding before the tiles go on

/**
 * The Forbidden City, Beijing (1406-1420), at a simplified level: the Meridian
 * Gate (Wumen) — the U-shaped red platform with its double-eaved gate tower
 * and four corner pavilions — and, 330 m north on the axis, the Hall of
 * Supreme Harmony (Taihedian) on its three-tier white marble terrace. Between
 * them, the Gate of Supreme Harmony (z = +178) and the Inner Golden Water
 * River with its five bridges; and north of the hall, on the same terrace,
 * the Halls of Central Harmony (z = -60) and Preserving Harmony (z = -112).
 * The side halls and gates round the courtyards are left out, and only short stretches of the palace wall either side of
 * the gate are drawn. The hall is at the origin (the pin); the gate's tower at z = +330.
 *
 * Sizes: hall 64 × 37 m, 26.92 m above its terrace and 35.05 m in all; the
 * terrace 8.13 m in three tiers; the Meridian Gate 37.95 m; the palace wall
 * 7.9 m tall, 8.62 m at its foot and 6.66 m on top. The Meridian Gate's plan
 * (126 m across, wings ~92 m long) and the roof profiles are read off plans and
 * photographs and are approximate, as are the two rear halls' sizes and
 * spacing. The terrace is drawn as a plain rectangle (the real one is waisted).
 *
 * Today's buildings are later rebuilds to the Ming plan (the hall 1695-97,
 * the gate 1647 and 1801); they are shown throughout.
 *
 * Stages (the 1406-1420 build window, lib/globeModels.ts):
 *  -b30  terraces, the gate's brick platform and the walls rising
 *  -b60  the timber frames standing, unpainted
 *  -b90  walls plastered and painted, roofs boarded, lower eaves tiled
 */
function forbiddenCity(stage: string): LandmarkMesh {
  const b = new Builder();
  const s30 = stage === '-b30', s60 = stage === '-b60', s90 = stage === '-b90';
  const framed = !s30, walled = !s30 && !s60;
  const upperTiles = !s30 && !s60 && !s90;
  const red = s30 ? FC_BRICK : FC_RED;

  // A double-eaved hall: plinth top y0; body (w × d) to y1; lower eave; upper
  // storey; upper hip roof. `up` lists the upper roof's levels, `low` the lower eave's.
  const hall = (z: number, y0: number, w: number, d: number, y1: number,
    low: Array<[number, number, number]>, up2: [number, number, number], up: Array<[number, number, number]>,
    ridge: [number, number, number], chiwenTop: number, bays: number) => {
    if (s30) return;
    // the timber frame: columns on the bay lines, front and back
    const colH = y1 - y0;
    for (let k = 0; k <= bays; k++) {
      const x = -w / 2 + (k / bays) * w;
      for (const side of [-1, 1]) b.box(x, y0 + colH / 2, z + side * (d / 2 + 0.6), 0.95, colH, 0.95, walled ? FC_COLUMN : FC_TIMBER);
    }
    for (const side of [-1, 1]) b.box(side * (w / 2 + 0.6), y0 + colH / 2, z, 0.95, colH, 0.95, walled ? FC_COLUMN : FC_TIMBER);
    if (!walled) {
      // tie beams across the top of the frame
      b.box(0, y1 - 0.4, z, w + 2, 0.8, d + 2, FC_TIMBER);
      b.box(0, up2[1] - 0.4, z, up2[0] * 2, 0.8, up2[2] * 2, FC_TIMBER);
      return;
    }
    b.box(0, (y0 + y1) / 2, z, w, y1 - y0, d, FC_RED);
    // lattice doors across the front, a gilt-studded band above
    b.box(0, y0 + (y1 - y0) * 0.38, z + d / 2 + 0.05, w - 2, (y1 - y0) * 0.72, 0.2, FC_LATTICE);
    // painted brackets under the lower eave
    b.box(0, y1 + 0.5, z, w + 2.4, 1.0, d + 2.4, FC_BRACKET);
    b.roof(0, z, low.map(([a, c, y]) => [a, c, y]), FC_YELLOW, FC_YELLOW_COURSE, 1.4);
    // the upper storey (a clerestory under the second eave)
    const [uw, uy, ud] = up2;
    b.box(0, (low[low.length - 1][2] + uy) / 2, z, uw * 2, uy - low[low.length - 1][2], ud * 2, FC_RED);
    b.box(0, uy - 0.5, z, uw * 2 + 1.6, 1.0, ud * 2 + 1.6, FC_BRACKET_BLUE);
    if (!upperTiles) {
      b.roof(0, z, up, FC_BOARDS, FC_BOARDS, 1.4);
      return;
    }
    b.roof(0, z, up, FC_YELLOW, FC_YELLOW_COURSE, 1.6);
    // the main ridge and its two dragon-headed ends (chiwen)
    const [rl, ry0, ry1] = ridge;
    b.box(0, (ry0 + ry1) / 2, z, rl, ry1 - ry0, 1.1, FC_YELLOW_COURSE);
    for (const side of [-1, 1]) b.box(side * (rl / 2 - 0.4), (ry0 + chiwenTop) / 2, z, 1.2, chiwenTop - ry0, 2.0, FC_YELLOW_COURSE);
  };

  // —— The three great halls on their terrace (the Hall of Supreme Harmony at the origin) ——
  // One three-tier white marble terrace, 8.13 m, carries all three: it runs
  // from the stairs south of Taihedian to the carved ramp north of Baohedian.
  // Drawn as a plain rectangle (the real one is waisted, like the character 工).
  const TS = 58, TN = -150, TZ = (TS + TN) / 2, TD = TS - TN;
  const TIERS: Array<[number, number, number, number]> = [[130, TD, 0, 2.71], [118, TD - 12, 2.71, 5.42], [106, TD - 24, 5.42, 8.13]];
  for (const [w, d, y0, y1] of TIERS) {
    b.box(0, (y0 + y1) / 2, TZ, w, y1 - y0, d, FC_MARBLE);
    if (s30) continue;
    // the carved balustrade round each tier's edge
    for (const side of [-1, 1]) {
      b.box(0, y1 + 0.55, TZ + side * (d / 2 - 0.3), w - 0.6, 1.1, 0.35, FC_MARBLE_SHADE);
      b.box(side * (w / 2 - 0.3), y1 + 0.55, TZ, 0.35, 1.1, d - 0.6, FC_MARBLE_SHADE);
    }
  }
  // three flights up the south face and three down the north (the middle ones the carved dragon pavements)
  for (const dir of [1, -1]) {
    const edge = dir > 0 ? TS : TN;
    for (const x of [-14, 0, 14]) {
      for (let k = 0; k < 9; k++) {
        const h = 8.13 * (1 - k / 9), zz = edge + dir * (14 - (k + 0.5) * (14 / 9) + 0.01);
        b.box(x, h / 2, zz, x === 0 ? 8 : 7, h, 14 / 9, x === 0 ? FC_MARBLE_SHADE : FC_MARBLE);
      }
    }
  }
  b.box(0, 8.13 + 0.45, 0, 66, 0.9, 39, FC_MARBLE); // Taihedian's own plinth
  hall(0, 9.03, 60, 33, 19.0,
    [[35.5, 21.5, 19.4], [33.6, 19.6, 20.4], [30.5, 16.5, 22.6]],
    [28.5, 25.4, 14.5],
    [[33.5, 19.5, 25.1], [31.6, 17.6, 26.1], [28.2, 14.2, 28.2], [24.8, 10.6, 30.2], [21.6, 6.8, 31.9], [18.8, 3.0, 33.3], [17, 0.5, 34.0]],
    [33, 34.0, 34.5], 35.05, 10);

  // The Hall of Central Harmony (Zhonghedian): a small square hall, 5 bays a
  // side, under a single pyramidal roof with a gilt finial (~27 m in all).
  const ZZ = -60, ZY = 9.03;
  b.box(0, 8.13 + 0.45, ZZ, 28, 0.9, 28, FC_MARBLE);
  if (framed) {
    for (let i = 0; i <= 5; i++) {
      for (const side of [-1, 1]) {
        const t = -12 + (i / 5) * 24;
        b.box(t, ZY + 3.75, ZZ + side * 12.6, 0.8, 7.5, 0.8, walled ? FC_COLUMN : FC_TIMBER);
        b.box(side * 12.6, ZY + 3.75, ZZ + t, 0.8, 7.5, 0.8, walled ? FC_COLUMN : FC_TIMBER);
      }
    }
    if (walled) {
      b.box(0, ZY + 3.75, ZZ, 23, 7.5, 23, FC_LATTICE);
      b.box(0, ZY + 8.0, ZZ, 26, 1.0, 26, FC_BRACKET);
      const tiled = upperTiles || s90;
      b.roof(0, ZZ, [[16, 16, ZY + 8.3], [15, 15, ZY + 9.1], [12.5, 12.5, ZY + 11.2], [9.5, 9.5, ZY + 13.4], [6.2, 6.2, ZY + 15.4], [2.8, 2.8, ZY + 17.0], [0.6, 0.6, ZY + 17.6]],
        tiled ? FC_YELLOW : FC_BOARDS, tiled ? FC_YELLOW_COURSE : FC_BOARDS, 1.0);
      if (upperTiles) b.lathe([[0.6, ZY + 17.6], [0.9, ZY + 17.9], [0.95, ZY + 18.6], [0.5, ZY + 19.2], [0.15, ZY + 19.7], [0, ZY + 19.7]].map(([r, y]) => [r, y]) as Array<[number, number]>, GILT, 12);
    } else {
      b.box(0, ZY + 7.2, ZZ, 26, 0.6, 26, FC_TIMBER);
    }
  }

  // The Hall of Preserving Harmony (Baohedian): 9 bays, double-eaved, ~29.5 m
  // in all. Its roof is drawn hipped (the real one is a hip-and-gable).
  const BZ = -112, BY = 9.03, BH = 5.63; // Taihemen's proportions, raised onto the terrace
  b.box(0, 8.13 + 0.45, BZ, 52, 0.9, 27, FC_MARBLE);
  hall(BZ, BY, 46, 20, 12.0 + BH,
    [[27, 14, 12.4 + BH], [25.5, 12.5, 13.3 + BH], [23.5, 10.5, 15.2 + BH]],
    [22, 17.6 + BH, 9],
    [[26, 13, 17.4 + BH], [24.5, 11.5, 18.3 + BH], [21.5, 8.6, 19.9 + BH], [18.6, 5.6, 21.4 + BH], [16.2, 2.4, 22.6 + BH], [15, 0.4, 23.1 + BH]],
    [29, 23.1 + BH, 23.5 + BH], 23.8 + BH, 9);

  // —— The Meridian Gate, 330 m south ——
  const GZ = 330, PH = 12; // the platform: 12 m of red wall
  const platform = (x: number, z: number, w: number, d: number) => {
    const h = s30 ? PH * 0.6 : PH;
    b.box(x, h / 2, z, w, h, d, red);
    b.box(x, 0.6, z, w + 0.4, 1.2, d + 0.4, FC_MARBLE_SHADE); // a stone footing course
    if (!s30) b.box(x, PH + 0.5, z, w, 1.0, d, FC_MARBLE_SHADE); // a stone coping
  };
  platform(0, GZ, 126, 36);
  for (const side of [-1, 1]) platform(side * 50, GZ + 18 + 46, 26, 92);
  if (!s30) {
    // the three gate passages on the south face, and one in each wing's inner face
    for (const [x, w] of [[0, 6], [-13, 4.6], [13, 4.6]] as const) b.box(x, 4.4, GZ + 18.05, w, 8.8, 0.2, FC_DOOR);
    for (const side of [-1, 1]) b.box(side * 36.95, 3.8, GZ + 30, 0.2, 7.6, 4.2, FC_DOOR);
  }
  const Y = PH + 1;
  b.box(0, Y + 0.4, GZ, 64, 0.8, 30, FC_MARBLE); // the gate tower's plinth
  const gate = (z: number) => hall(z, Y + 0.8, 58, 23, 22.0,
    [[34, 17, 21.8], [32, 15, 22.8], [29.5, 12.5, 24.8]],
    [27.5, 27.4, 10.5],
    [[33, 16, 27.2], [31, 14, 28.2], [27.5, 10.5, 30.4], [24, 7, 32.6], [21, 3.6, 34.8], [19, 0.5, 36.0]],
    [36, 36.0, 37.0], 37.95, 9);
  gate(GZ);

  // —— The Gate of Supreme Harmony (Taihemen), 178 m south of the hall ——
  // A double-eaved gate hall, 9 bays, about 23.8 m tall, on a 3.4 m marble
  // platform with three flights of steps north and south. Its roof is
  // drawn hipped (the real one is a hip-and-gable, xieshan).
  const TM = 178;
  b.box(0, 1.7, TM, 64, 3.4, 34, FC_MARBLE);
  if (!s30) for (const side of [-1, 1]) b.box(0, 3.4 + 0.5, TM + side * 16.7, 63, 1.0, 0.35, FC_MARBLE_SHADE);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const h = 3.4 * (1 - k / 4);
      b.box(0, h / 2, TM + side * (17 + (k + 0.5) * 1.5), 16, h, 1.5, FC_MARBLE_SHADE);
    }
  }
  hall(TM, 3.4, 46, 20, 12.0,
    [[27, 14, 12.4], [25.5, 12.5, 13.3], [23.5, 10.5, 15.2]],
    [22, 17.6, 9],
    [[26, 13, 17.4], [24.5, 11.5, 18.3], [21.5, 8.6, 19.9], [18.6, 5.6, 21.4], [16.2, 2.4, 22.6], [15, 0.4, 23.1]],
    [29, 23.1, 23.5], 23.8, 9);

  // —— The Inner Golden Water River, between the Meridian Gate and Taihemen ——
  // A marble-banked channel bowed toward the north, crossed by five bridges
  // on the axis (the middle one the emperor's). Drawn at ground level.
  const river = (x: number) => 262 - 26 * (1 - (x / 95) ** 2);
  const RW = 10;
  for (let i = 0; i < 16; i++) {
    const x0 = -95 + (i / 16) * 190, x1 = -95 + ((i + 1) / 16) * 190;
    const z0 = river(x0), z1 = river(x1);
    const ref: V3 = [(x0 + x1) / 2, -50, (z0 + z1) / 2];
    b.quad([x0, 0.05, z0 - RW / 2], [x1, 0.05, z1 - RW / 2], [x1, 0.05, z1 + RW / 2], [x0, 0.05, z0 + RW / 2], '#4f6f6a', ref);
    if (s30) continue;
    for (const side of [-1, 1]) {
      const za = z0 + side * (RW / 2 + 0.3), zb = z1 + side * (RW / 2 + 0.3);
      b.hex8([[x0, 0, za - 0.3], [x1, 0, zb - 0.3], [x1, 0, zb + 0.3], [x0, 0, za + 0.3],
        [x0, 1.1, za - 0.3], [x1, 1.1, zb - 0.3], [x1, 1.1, zb + 0.3], [x0, 1.1, za + 0.3]], FC_MARBLE_SHADE, FC_MARBLE);
    }
  }
  if (!s30) {
    for (const x of [-26, -13, 0, 13, 26]) {
      const zc = river(x), w = x === 0 ? 7 : 5.5;
      b.box(x, 0.8, zc, w, 1.6, RW + 5, FC_MARBLE);
      for (const side of [-1, 1]) b.box(x + side * (w / 2 - 0.2), 2.1, zc, 0.35, 1.0, RW + 5, FC_MARBLE_SHADE);
    }
  }
  // Four square pavilions at the wings' corners, joined by covered galleries.
  if (framed) {
    for (const side of [-1, 1]) {
      for (const z of [GZ + 26, GZ + 102]) {
        const x = side * 50;
        b.box(x, Y + 0.4, z, 17, 0.8, 17, FC_MARBLE);
        b.box(x, Y + 0.8 + 3.2, z, 13, 6.4, 13, walled ? FC_RED : FC_TIMBER);
        if (walled) b.box(x, Y + 7.7, z, 14.6, 1.0, 14.6, FC_BRACKET);
        if (walled) b.roof(x, z, [[10, 10, Y + 7.6], [9, 9, Y + 8.4], [7, 7, Y + 10.0], [4.6, 4.6, Y + 11.6], [1.5, 1.5, Y + 13.0], [0.4, 0.4, Y + 13.4]], upperTiles || s90 ? FC_YELLOW : FC_BOARDS, upperTiles || s90 ? FC_YELLOW_COURSE : FC_BOARDS, 0.9);
      }
      // the gallery along the wing between them
      const x = side * 50, z0 = GZ + 34.5, z1 = GZ + 93.5, gz = (z0 + z1) / 2, gl = z1 - z0;
      b.box(x, Y + 2.8, gz, 8, 5.6, gl, walled ? FC_RED : FC_TIMBER);
      if (walled) {
        const roofHex = upperTiles || s90 ? FC_YELLOW : FC_BOARDS;
        b.quad([x - 5.5, Y + 5.4, z0], [x - 5.5, Y + 5.4, z1], [x, Y + 8.4, z1], [x, Y + 8.4, z0], roofHex, [x, Y - 50, gz]);
        b.quad([x + 5.5, Y + 5.4, z0], [x + 5.5, Y + 5.4, z1], [x, Y + 8.4, z1], [x, Y + 8.4, z0], roofHex, [x, Y - 50, gz]);
      }
    }
  }
  // The palace wall either side of the gate: 7.9 m, battered, under a yellow-tiled coping.
  const WH = s30 ? 4 : 7.9;
  for (const side of [-1, 1]) {
    const x0 = side * 63, x1 = side * 150;
    const ring = (half: number, y: number): V3[] => [[x0, y, GZ - half], [x1, y, GZ - half], [x1, y, GZ + half], [x0, y, GZ + half]];
    b.hex8([...ring(4.31, 0), ...ring(3.33, WH)], red);
    if (walled) {
      const ref: V3 = [(x0 + x1) / 2, -50, GZ];
      for (const s of [-1, 1]) b.quad([x0, WH, GZ + s * 3.9], [x1, WH, GZ + s * 3.9], [x1, WH + 1.3, GZ], [x0, WH + 1.3, GZ], FC_YELLOW, ref);
    }
  }
  return b.done();
}

export function landmarkMesh(model: LandmarkModel, stage = '', profile?: GreatWallProfile): LandmarkMesh {
  if (model === 'great-wall') return greatWall(stage, profile);
  if (model === 'forbidden-city') return forbiddenCity(stage);
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
  'great-wall':
    '3D Great Wall at Badaling: a representation based on best known evidence — a representative Ming section ' +
    '(1505) with brick watchtowers, 7.8 m tall and 5.8 m wide on top, on a simplified ridge. The real line winds ' +
    'more and climbs more steeply; the earlier rammed-earth (Northern Qi, 555) and early Ming walls are shown on the same line.',
  'forbidden-city':
    '3D Forbidden City: a representation based on best known evidence, simplified — the Meridian Gate (37.95 m) and ' +
    'the Hall of Supreme Harmony (35.05 m) on its marble terrace, 330 m apart on the axis, with the Gate of Supreme ' +
    'Harmony and the Golden Water River between, and the Halls of Central and Preserving Harmony behind it on the same terrace. ' +
    'The side halls and courtyards are not modelled; the buildings ' +
    'shown are later rebuilds to the Ming design.',
};

export function landmarkNote(monument: { model: string } | null | undefined): string | null {
  return monument && isLandmarkModel(monument.model) ? LANDMARK_NOTE[monument.model] : null;
}
