/**
 * mesoTemple.ts — a Maya temple-pyramid built to its real measurements.
 *
 * The specs come from src/data/meso-temples.json, written by
 * scripts/build-meso-site.mjs from each temple's OpenStreetMap outline (width,
 * depth, orientation) and its sources (height, number of stepped levels, the
 * side its stair faces, its date). Authored in TRUE METRES with the stair on
 * the FRONT (+Z), so the fit table can place it at scale 1 and turn it to face
 * its real stair bearing (facingDeg = 180 − bearing).
 *
 * THE FORM — the Petén style of Tikal: a steep body of stepped levels, a
 * single broad stairway climbing the front, a small shrine on the summit and a
 * tall ROOF COMB standing on the shrine's rear. Proportions: body ~64% of the
 * height, shrine ~14%, comb ~22% (Temple V: seven 4 m levels, a 12.5 m comb,
 * 57 m in all — Wikipedia). A RADIAL pyramid (Mundo Perdido) has stairs on all
 * four sides and a flat summit platform, no comb.
 *
 * PHASES. Intact: stucco painted red, as Classic Maya temples were. Ruined
 * (after the city was abandoned, ~AD 900): bare grey limestone, the comb and
 * shrine still standing — as Tikal's temples stand today.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MesoTemple {
  site: string;
  model: string;
  title: string;
  lat: number;
  lon: number;
  widthM: number;
  depthM: number;
  stairBearing: number;
  heightM: number;
  levels: number;
  radial: boolean;
  /** A radial pyramid crowned by a temple (El Castillo: 24 m body + 6 m temple). */
  templeM?: number;
  /** The OSM outline was traced around the stairs (El Castillo), not the body. */
  stairsInOutline?: boolean;
  /** How far up the two SIDE stairs of a radial pyramid climb (1 = to the top;
   * Mundo Perdido's reach the 8th of 10 levels = 0.8). */
  sideStairsTo?: number;
  builtYear: number;
  note?: string;
}

type Part = 'body' | 'stair' | 'shrine' | 'comb' | 'door';

export function buildMesoTemple(spec: MesoTemple, ruined: boolean): THREE.Group {
  const group = new THREE.Group();
  const parts: Record<Part, THREE.BufferGeometry[]> = { body: [], stair: [], shrine: [], comb: [], door: [] };
  const box = (p: Part, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts[p].push(g.toNonIndexed());
  };

  const W = spec.widthM;
  const D = spec.depthM;
  const H = spec.heightM;
  const radial = spec.radial;
  const crowned = radial && (spec.templeM ?? 0) > 0;
  const bodyH = crowned ? H - (spec.templeM ?? 0) : radial ? H : H * 0.64;
  const shrineH = crowned ? (spec.templeM ?? 0) : radial ? 0 : H * 0.14;
  const combH = radial ? 0 : H * 0.22;
  // The stair projects from the front; the body is what lies behind it.
  const proj = radial ? 0 : Math.min(D * 0.2, 14);
  // A radial body is the outline minus its proud stairs when the mapper
  // traced around them; otherwise the outline IS the body.
  const inset = radial && spec.stairsInOutline ? 8 : 0;
  const bodyD = D - proj - inset;
  const bodyW = W - inset;
  const zc = -proj / 2; // body centre, pushed back so the stair fits in the outline
  const n = Math.max(1, spec.levels);
  const lh = bodyH / n;
  // Steep Petén profile: the summit is ~38% of the base (radial: ~30%).
  const topK = radial ? 0.3 : 0.38;
  const levelDims: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const k = 1 - (1 - topK) * (i / Math.max(1, n - 1));
    const w = bodyW * k;
    const d = bodyD * k;
    levelDims.push([w, d]);
    // Each level a slightly battered block with a moulding lip above it.
    box('body', w, lh * 0.86, d, 0, i * lh + lh * 0.43, zc);
    box('body', w * 0.985, lh * 0.14, d * 0.985, 0, i * lh + lh * 0.93, zc);
  }
  const [topW, topD] = levelDims[n - 1];

  // --- stairways
  const stairRun = (dir: 0 | 1 | 2 | 3, reachH: number, widthFrac: number) => {
    // dir 0 = front (+Z), 1 = right (+X), 2 = back (−Z), 3 = left (−X)
    const steps = Math.max(12, Math.round(reachH / 0.9));
    // A radial pyramid's stairs have no projecting front to sit in, so they
    // stand ~4 m proud of the levels — or the stepped body swallows them.
    const proud = radial ? 4 : 0;
    const outward = (dir === 0 || dir === 2 ? (bodyD / 2 + (dir === 0 ? proj : 0)) : bodyW / 2) + proud;
    const inward = (dir === 0 || dir === 2 ? topD : topW) / 2;
    const span = (dir === 0 || dir === 2 ? bodyW : bodyD) * widthFrac;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const y = t0 * reachH;
      // Each step is a slab from the stair's slope line back into the body.
      const r = outward - (outward - inward) * (y / bodyH);
      const depth = Math.max(0.6, r - inward * 0.5);
      const cy = y + reachH / steps / 2;
      const h = reachH / steps;
      const mid = r - depth / 2;
      if (dir === 0) box('stair', span, h, depth, 0, cy, zc + mid + (proj / 2) * 0);
      if (dir === 2) box('stair', span, h, depth, 0, cy, zc - mid);
      if (dir === 1) box('stair', depth, h, span, mid, cy, zc);
      if (dir === 3) box('stair', depth, h, span, -mid, cy, zc);
    }
  };
  if (radial) {
    // Front and back stairs to the top; the side pair as far as recorded
    // (El Castillo: all the way; Mundo Perdido: the 8th of 10 levels).
    const side = spec.sideStairsTo ?? 1;
    stairRun(0, bodyH, 0.22);
    stairRun(2, bodyH, 0.22);
    stairRun(1, bodyH * side, 0.2);
    stairRun(3, bodyH * side, 0.2);
  } else {
    stairRun(0, bodyH, 0.3);
  }

  // --- a crowned radial pyramid: a square temple on the summit, no comb
  if (crowned) {
    const sw = topW * 0.7;
    const sd = topD * 0.7;
    box('shrine', sw, shrineH, sd, 0, bodyH + shrineH / 2, zc);
    for (const [dx, dz, w, d] of [[0, sd / 2, sw * 0.3, 0.3], [0, -sd / 2, sw * 0.3, 0.3], [sw / 2, 0, 0.3, sd * 0.3], [-sw / 2, 0, 0.3, sd * 0.3]] as const) {
      box('door', w, shrineH * 0.55, d, dx + Math.sign(dx) * 0.1, bodyH + shrineH * 0.3, zc + dz + Math.sign(dz) * 0.1);
    }
  }
  // --- the summit shrine and roof comb (Petén temples)
  if (!radial) {
    const sw = topW * 0.78;
    const sd = topD * 0.62;
    const sz = zc - topD * 0.08;
    box('shrine', sw, shrineH, sd, 0, bodyH + shrineH / 2, sz);
    box('door', sw * 0.22, shrineH * 0.55, 0.3, 0, bodyH + shrineH * 0.3, sz + sd / 2 + 0.1);
    // The comb stands on the shrine's rear wall, narrowing as it rises.
    const cz = sz - sd / 2 + sd * 0.16;
    box('comb', sw * 0.82, combH * 0.55, sd * 0.3, 0, bodyH + shrineH + combH * 0.275, cz);
    box('comb', sw * 0.62, combH * 0.45, sd * 0.24, 0, bodyH + shrineH + combH * 0.775, cz);
  }

  const flat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, flatShading: true });
  const mats: Record<Part, THREE.Material> = ruined
    ? { body: flat('#b8ae99'), stair: flat('#c7beab'), shrine: flat('#b3a994'), comb: flat('#a9a08c'), door: flat('#1e1b17') }
    : { body: flat('#a9533a'), stair: flat('#b8664a'), shrine: flat('#c9a27c'), comb: flat('#b04a33'), door: flat('#1e1b17') };
  for (const k of Object.keys(parts) as Part[]) {
    if (!parts[k].length) continue;
    const merged = mergeGeometries(parts[k], false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mats[k]);
    m.name = `meso-${k}`;
    group.add(m);
  }
  if (ruined) group.userData.selfRuined = true;
  return group;
}
