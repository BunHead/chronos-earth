/**
 * craterMesh.ts — a REAL impact crater as one heightfield (16 Oct 2026).
 *
 * The old crater was a torus on a flat disc: a dark "donut" sitting ON the
 * ground. A real crater is dug INTO it. This builds the ground itself, as a
 * polar grid, in the model's own units (y up, y = 0 is the surrounding ground):
 *
 *  - a bowl whose floor is BELOW ground (y < 0);
 *  - a raised, slightly irregular rim just ABOVE ground (uplifted, overturned
 *    rock: about 4% of the diameter on fresh craters);
 *  - an ejecta blanket that thins out to y = 0 at the disc edge, with faint
 *    bright rays on a fresh crater;
 *  - SIMPLE craters (Barringer / Meteor Crater, ~1 km) are a plain parabolic
 *    bowl, about 1/5 as deep as wide; COMPLEX ones (Chicxulub, Hiawatha) are
 *    shallower, with a flat floor, slumped terraced walls and a central peak.
 *
 * Pure numbers, no three.js: the in-app viewer (Monument3D) and the .glb
 * generator (scripts/build-impact-crater.mjs) both draw from it, so the globe
 * and the viewer always show the same crater. Deterministic — no Math.random.
 */

/** The disc's outer radius (model units): the crater's rim sits at RIM_R. */
export const CRATER_OUTER = 8.5;
export const CRATER_RIM_R = 4.6;

export type CraterKind = 'simple' | 'complex' | 'flat';

export interface CraterOpts {
  kind: CraterKind;
  /** Fresh (sharp, deep, bright rays) or settled (worn, shallower, part-infilled). */
  fresh: boolean;
  /** Darken the centre — ground zero scorched just before the strike. */
  scorch?: boolean;
}

export interface CraterMesh {
  positions: Float32Array; // xyz
  normals: Float32Array; // xyz
  colors: Float32Array; // linear rgb, 0..1
  indices: Uint16Array;
}

// Grid resolution: ~3.6k vertices — well under 200 KB as a .glb.
const NR = 44;
const NS = 80;

/** Deterministic hash noise in [0, 1). */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise on the plane, roughly [-1, 1]. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** sRGB hex → linear rgb (glTF vertex colours are linear). */
function lin(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

// Earthy rock and dust — never black.
const COL = {
  ground: lin('#9a8b70'),
  ejecta: lin('#b4a487'),
  ray: lin('#d2c4a6'),
  wall: lin('#7f6e57'),
  floor: lin('#6f6150'),
  peak: lin('#8c7b62'),
  scorch: lin('#5a4a3a'),
};

// Bright ejecta rays: fixed angles and widths (a fresh crater's signature).
const RAYS = Array.from({ length: 13 }, (_, k) => ({
  a: (k / 13) * Math.PI * 2 + (hash(k, 3) - 0.5) * 0.4,
  w: 0.05 + hash(k, 7) * 0.06,
  reach: 0.5 + hash(k, 11) * 0.5,
}));

/** Height of the ground at polar (r, θ) — y = 0 is the surrounding terrain. */
export function craterHeight(r: number, th: number, o: CraterOpts): number {
  if (o.kind === 'flat') return 0;
  const D = CRATER_RIM_R * 2;
  const complex = o.kind === 'complex';
  // Irregular rim line and crest height — no real crater is a perfect circle.
  const R = CRATER_RIM_R * (1 + 0.035 * Math.sin(3 * th + 1.3) + 0.02 * Math.sin(5 * th + 0.4) + 0.012 * Math.sin(9 * th + 2.1));
  const rimH = D * (o.fresh ? 0.04 : 0.025) * (1 + 0.22 * Math.sin(4 * th + 0.7) + 0.14 * Math.sin(7 * th + 2.0));
  // Depth below ground: simple bowls ~1/5 D fresh; complex ones much shallower.
  const depth = D * (complex ? (o.fresh ? 0.1 : 0.07) : o.fresh ? 0.19 : 0.13);
  const u = r / R;
  const x = r * Math.cos(th), z = r * Math.sin(th);
  let h: number;
  if (u <= 1) {
    if (!complex) {
      // Simple bowl: parabolic, steepest at the rim. Settled ones part-infilled.
      h = -depth + (depth + rimH) * Math.pow(u, 2.2);
      if (!o.fresh) h = Math.max(h, -depth * 0.85);
    } else {
      const uf = 0.48; // flat floor out to about half the rim radius
      if (u <= uf) {
        h = -depth;
      } else {
        // Slumped walls: three terraces, softened.
        const s = (u - uf) / (1 - uf);
        const steps = o.fresh ? 3 : 2;
        const xs = s * steps;
        const st = (Math.floor(xs) + smooth(0.25, 0.75, xs - Math.floor(xs))) / steps;
        const sm = (o.fresh ? 0.55 : 0.3) * st + (o.fresh ? 0.45 : 0.7) * s;
        h = -depth + (depth + rimH) * Math.pow(sm, 1.4);
      }
      // Central peak: rebound of the floor, well below the rim.
      const pr = u / 0.17;
      h += depth * (o.fresh ? 0.75 : 0.5) * Math.exp(-pr * pr) * (1 + 0.15 * noise(x * 3, z * 3));
    }
  } else {
    // Ejecta blanket: thickest at the rim, thinning outwards, gone at the edge.
    const d = u - 1;
    h = rimH * Math.exp(-d * (o.fresh ? 3.4 : 4.2));
    h += rimH * 0.18 * noise(x * 1.6, z * 1.6) * Math.exp(-d * 2); // hummocky
  }
  // Rough surface everywhere, fading to a dead-flat seam with the terrain.
  h += 0.035 * noise(x * 2.3 + 7, z * 2.3 + 3);
  return h * (1 - smooth(0.82, 1, r / CRATER_OUTER));
}

function colourAt(r: number, th: number, slope: number, o: CraterOpts): number[] {
  const x = r * Math.cos(th), z = r * Math.sin(th);
  let c: number[] = COL.ground;
  if (o.kind !== 'flat') {
    const u = r / CRATER_RIM_R;
    if (u < 1.02) {
      // Inside the bowl: floor → wall rock, peak catching its own tone.
      c = mix(COL.floor, COL.wall, smooth(0.35, 0.9, u));
      if (o.kind === 'complex') c = mix(c, COL.peak, Math.exp(-((u / 0.17) ** 2)));
    } else {
      // Ejecta: light dust near the rim, fading to the plain ground.
      const d = u - 1;
      c = mix(COL.ejecta, COL.ground, smooth(0, 0.85, d));
      let ray = 0;
      for (const k of RAYS) {
        let da = Math.abs(th - k.a) % (Math.PI * 2);
        if (da > Math.PI) da = Math.PI * 2 - da;
        ray = Math.max(ray, Math.exp(-((da / k.w) ** 2)) * Math.exp(-d / k.reach));
      }
      c = mix(c, COL.ray, ray * (o.fresh ? 0.75 : 0.25));
    }
    // Steep walls show darker bare rock; settled craters weather paler.
    c = c.map((v) => v * (1 - Math.min(0.25, slope * 0.22)));
    if (!o.fresh) c = mix(c, COL.ground, 0.25);
  }
  if (o.scorch) c = mix(c, COL.scorch, (1 - smooth(1.2, 4.2, r)) * 0.8);
  const j = 1 + 0.06 * noise(x * 4.1, z * 4.1);
  return c.map((v) => Math.min(1, v * j));
}

/** Build the crater (or a flat ground disc) as an indexed triangle mesh. */
export function craterMesh(o: CraterOpts): CraterMesh {
  const nv = 1 + NR * NS;
  const pos = new Float32Array(nv * 3);
  const rad: number[] = [0];
  const ang: number[] = [0];
  pos[1] = craterHeight(0, 0, o);
  for (let i = 1; i <= NR; i++) {
    const r = CRATER_OUTER * (i / NR);
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const v = 1 + (i - 1) * NS + j;
      pos[v * 3] = r * Math.cos(th);
      pos[v * 3 + 1] = craterHeight(r, th, o);
      pos[v * 3 + 2] = r * Math.sin(th);
      rad.push(r);
      ang.push(th);
    }
  }
  const idx: number[] = [];
  // Wound counter-clockwise seen from above (+y), so faces point up.
  for (let j = 0; j < NS; j++) idx.push(0, 1 + ((j + 1) % NS), 1 + j);
  for (let i = 1; i < NR; i++) {
    for (let j = 0; j < NS; j++) {
      const a = 1 + (i - 1) * NS + j, b = 1 + (i - 1) * NS + ((j + 1) % NS);
      const c = a + NS, d = b + NS;
      idx.push(a, b, c, b, d, c);
    }
  }
  // Smooth normals from the faces.
  const nrm = new Float32Array(nv * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nrm[v + k] += n[k];
  }
  const col = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) nrm[v * 3 + k] /= l;
    const slope = Math.sqrt(Math.max(0, 1 - nrm[v * 3 + 1] ** 2)) / Math.max(0.2, nrm[v * 3 + 1]);
    const c = colourAt(rad[v], ang[v], slope, o);
    col.set(c, v * 3);
  }
  return { positions: pos, normals: nrm, colors: col, indices: Uint16Array.from(idx) };
}
