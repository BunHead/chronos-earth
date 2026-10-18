/**
 * precursorMesh.ts — honest 3D for three precursor-hypothesis sites (17 Oct 2026).
 *
 * Spencer's rules: a model only where it is honest for the site; no model is
 * better than a wrong one; small files. None of these is a building:
 *
 *  - 'ravne-tunnels'   the CLAIMED Ravne tunnels by Visočica hill, Bosnia: a few
 *                      narrow passages, all BELOW ground. No pyramid — the hill
 *                      is natural; the satellite ground shows it as it is.
 *  - 'bimini-beachrock' the Bimini Road: a 0.8 km J-shaped line of flat
 *                      limestone (beachrock) slabs on the SEABED, ~5.5 m down.
 *  - 'yonaguni-rock'   the Yonaguni formation: natural stepped sandstone under
 *                      the sea, top ~5 m below the surface, base ~25 m down.
 *
 * Units are TRUE METRES (y up; y = 0 is the ground or the sea surface; x east,
 * z south — facing 0 on the globe), so every vertex of every model has y < 0.
 * Pure numbers, no three.js: the in-app viewer (Monument3D) and the .glb
 * generator (scripts/build-precursor-models.mjs) both draw from it.
 * Deterministic — no Math.random.
 */

export type PrecursorModel = 'ravne-tunnels' | 'bimini-beachrock' | 'yonaguni-rock';
export const PRECURSOR_MODELS: readonly PrecursorModel[] = ['ravne-tunnels', 'bimini-beachrock', 'yonaguni-rock'];

export interface PrecursorMesh {
  positions: Float32Array; // xyz
  normals: Float32Array; // xyz
  colors: Float32Array; // linear rgb, 0..1
  indices: Uint32Array;
}

/** Underwater (sea surface at y = 0) or underground (terrain at y = 0). */
export const PRECURSOR_SETTING: Record<PrecursorModel, 'sea' | 'ground'> = {
  'ravne-tunnels': 'ground',
  'bimini-beachrock': 'sea',
  'yonaguni-rock': 'sea',
};

/** Deterministic hash noise in [0, 1). */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
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

/** Collects flat-shaded boxes into one indexed mesh. */
class Builder {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  i: number[] = [];

  /**
   * A box centred at (x, y, z), size w (x) × h (y) × d (z), turned yaw radians
   * about y and tipped `tilt` radians about its own x axis. `jit` (0..1)
   * darkens/lightens it a touch so neighbours never read as one plastic slab.
   */
  box(x: number, y: number, z: number, w: number, h: number, d: number, hex: string, yaw = 0, tilt = 0, jit = 0): void {
    const col = lin(hex).map((v) => Math.min(1, v * (1 + jit)));
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    // Local → world: tilt about x, then yaw about y.
    const tf = (lx: number, ly: number, lz: number): [number, number, number] => {
      const ty = ly * ct - lz * st, tz = ly * st + lz * ct;
      return [lx * cy + tz * sy, ty, -lx * sy + tz * cy];
    };
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
      const nw = tf(...nrm);
      for (const [a, b, cc] of corners) {
        const [wx, wy, wz] = tf((a * w) / 2, (b * h) / 2, (cc * d) / 2);
        this.p.push(x + wx, y + wy, z + wz);
        this.n.push(...nw);
        this.c.push(...col);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  done(): PrecursorMesh {
    return {
      positions: Float32Array.from(this.p),
      normals: Float32Array.from(this.n),
      colors: Float32Array.from(this.c),
      indices: Uint32Array.from(this.i),
    };
  }
}

/**
 * The claimed Ravne tunnels: four narrow passages (~1.6 m wide, ~2 m high)
 * wandering out from a small chamber, their roofs 6–14 m below the ground.
 * Earth and gravel colours. Kept within ~100 m of the pin so the whole network
 * stays under the hill's slopes where the globe seats it.
 */
function ravneTunnels(): PrecursorMesh {
  const b = new Builder();
  const SEG = 4; // metres per passage segment
  const W = 1.6, H = 2.0;
  const COLS = ['#8a7356', '#7d684d', '#937c5e'];
  // [start bearing (rad, from +x), length m, roof depth at start, at end, wander]
  const PASSAGES: Array<[number, number, number, number, number]> = [
    [0.35, 96, -7, -12, 0.9],
    [2.2, 72, -7, -10, 1.3],
    [3.9, 84, -8, -14, 0.7],
    [5.1, 48, -7, -9, 1.6],
  ];
  // The chamber the passages meet in.
  b.box(0, -7 - 1.6, 0, 6, 3.2, 5, '#8a7356');
  PASSAGES.forEach(([a0, len, d0, d1, wander], k) => {
    let x = Math.cos(a0) * 3, z = Math.sin(a0) * 3, a = a0;
    const n = Math.round(len / SEG);
    for (let s = 0; s < n; s++) {
      a += (hash(k, s) - 0.5) * 0.35 * wander;
      const nx = x + Math.cos(a) * SEG, nz = z + Math.sin(a) * SEG;
      const roof = d0 + (d1 - d0) * (s / n);
      const mx = (x + nx) / 2, mz = (z + nz) / 2;
      // Box long axis along local x: yaw so it points from (x,z) to (nx,nz).
      b.box(mx, roof - H / 2, mz, SEG + 0.3, H, W, COLS[(s + k) % 3], -a, 0, (hash(s, k) - 0.5) * 0.12);
      x = nx; z = nz;
    }
    // A narrower side branch off the longer passages.
    if (len > 70) {
      let bx = Math.cos(a0) * len * 0.5, bz = Math.sin(a0) * len * 0.5, ba = a0 + 1.2;
      for (let s = 0; s < 6; s++) {
        ba += (hash(k + 9, s) - 0.5) * 0.4;
        const nx = bx + Math.cos(ba) * SEG, nz = bz + Math.sin(ba) * SEG;
        b.box((bx + nx) / 2, (d0 + d1) / 2 - 0.9, (bz + nz) / 2, SEG + 0.3, 1.6, 1.2, '#7d684d', -ba);
        bx = nx; bz = nz;
      }
    }
  });
  return b.done();
}

/** The Bimini Road's J: a gentle NE–SW line, hooking round at its SW end. */
function biminiPath(t: number): { x: number; z: number; dir: number } {
  // Straight run NE → SW for the first 75%, then the hook (~0.2 km) curving
  // towards the south-east. Total length ~0.8 km.
  const L = 600, R = 70; // straight length, hook radius
  const sw = Math.atan2(1, -1); // bearing of SW in (x east, z south)
  const ux = Math.cos(sw), uz = Math.sin(sw);
  const s = t * (L + R * Math.PI * 0.9);
  if (s <= L) {
    const g = 0.00006 * ((s - L / 2) ** 2 - (L / 2) ** 2); // a slight bow along the run
    return { x: -ux * L / 2 + ux * s - uz * g, z: -uz * L / 2 + uz * s + ux * g, dir: sw };
  }
  const phi = (s - L) / R; // turning left (towards SE)
  const cx = ux * L / 2 + uz * R, cz = uz * L / 2 - ux * R;
  const a = sw - phi;
  return { x: cx - Math.sin(a) * R, z: cz + Math.cos(a) * R, dir: a };
}

/**
 * The Bimini Road: a single line of flat, roughly rectangular slabs (most
 * 2–4 m across, ~0.6 m thick) in two or three rough rows, lying on a sandy
 * seabed at 5.5 m. Pale limestone and shell-hash colours, a little uneven —
 * cracked beachrock, not laid masonry.
 */
function biminiBeachrock(): PrecursorMesh {
  const b = new Builder();
  const SEABED = -5.5;
  const COLS = ['#b9ab8c', '#a89a7c', '#c4b796', '#9f9275'];
  const N = 230;
  for (let i = 0; i < N; i++) {
    const { x, z, dir } = biminiPath(i / (N - 1));
    const nx = -Math.sin(dir), nz = Math.cos(dir);
    const rows = hash(i, 1) < 0.35 ? 3 : 2;
    for (let r = 0; r < rows; r++) {
      const off = (r - (rows - 1) / 2) * 3.4 + (hash(i, r + 3) - 0.5) * 0.8;
      const w = 2.2 + hash(i, r + 7) * 1.6, d = 2.0 + hash(i, r + 11) * 1.4;
      const th = 0.45 + hash(i, r + 13) * 0.25;
      const tip = (hash(i, r + 17) - 0.5) * 0.08; // slabs lie a little askew
      b.box(x + nx * off, SEABED + th / 2 - 0.05, z + nz * off, w, th, d,
        COLS[(i + r) % 4], -dir + (hash(i, r + 19) - 0.5) * 0.35, tip, (hash(i, r + 23) - 0.5) * 0.15);
    }
  }
  // A strip of sandy seabed under the line, so the depth reads in the viewer.
  const SEGS = 40;
  for (let k = 0; k < SEGS; k++) {
    const p = biminiPath((k + 0.5) / SEGS);
    b.box(p.x, SEABED - 0.5, p.z, 24, 0.9, 30, '#cdbf9c', -p.dir, 0, (hash(k, 29) - 0.5) * 0.06);
  }
  return b.done();
}

/**
 * Yonaguni: a natural sandstone mass, still joined to the bedrock, that splits
 * along flat bedding planes and straight vertical joints — so it steps down in
 * broad, uneven terraces from ~5 m below the surface to the seabed at ~25 m.
 * Built as columns on a 4 m grid whose tops snap to ~2 m "beds", with the
 * terrace edges wandering (no straight building lines) and a rough seabed.
 */
function yonaguniRock(): PrecursorMesh {
  const b = new Builder();
  const TOP = -5, BASE = -25, CELL = 4;
  const NX = 40, NZ = 18; // 160 m × 72 m
  const COLS = ['#8e7a62', '#9a866b', '#82705a', '#a08c70'];
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const x = (i - NX / 2 + 0.5) * CELL, z = (j - NZ / 2 + 0.5) * CELL;
      // A long ridge, highest towards its east end, falling away to the south
      // in big steps and more steeply to the north.
      const along = 1 - Math.abs(x - 22) / 90;
      const across = z >= 0 ? 1 - z / 40 : 1 + z / 22;
      const wob = (hash(Math.floor(i / 2), Math.floor(j / 2)) - 0.5) * 0.25 + (hash(i, j) - 0.5) * 0.08;
      const f = Math.max(0, Math.min(1, along * across + wob));
      if (f <= 0.02) continue;
      // Snap to bedding planes ~2 m apart (the "steps"), never above TOP.
      const raw = BASE + f * (TOP - BASE);
      const bed = 2 + (hash(j, 5) - 0.5) * 0.6;
      const top = Math.min(TOP, BASE + Math.round((raw - BASE) / bed) * bed);
      const h = top - (BASE - 1);
      if (h < 0.8) continue;
      b.box(x, BASE - 1 + h / 2, z, CELL, h, CELL, COLS[(i * 7 + j * 3) % 4], 0, 0, (hash(i + 31, j) - 0.5) * 0.14);
    }
  }
  // The seabed round it: coarse sand and fallen blocks.
  for (let k = 0; k < 36; k++) {
    const x = (hash(k, 41) - 0.5) * 200, z = (hash(k, 43) - 0.5) * 110;
    const s = 1.5 + hash(k, 47) * 3;
    b.box(x, BASE + s / 4, z, s, s / 2, s * 0.8, '#7f6c56', hash(k, 53) * 3, (hash(k, 59) - 0.5) * 0.4);
  }
  b.box(0, BASE - 0.5, 0, 220, 1, 120, '#b7a684');
  return b.done();
}

export function precursorMesh(model: PrecursorModel): PrecursorMesh {
  if (model === 'ravne-tunnels') return ravneTunnels();
  if (model === 'bimini-beachrock') return biminiBeachrock();
  return yonaguniRock();
}

export function isPrecursorModel(model: string): model is PrecursorModel {
  return (PRECURSOR_MODELS as readonly string[]).includes(model);
}

/** Highest and lowest y, and the widest horizontal span, of a mesh (metres). */
export function meshBounds(m: PrecursorMesh): { minY: number; maxY: number; span: number } {
  let minY = Infinity, maxY = -Infinity;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const [x, y, z] = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { minY, maxY, span: Math.max(x1 - x0, z1 - z0) };
}
