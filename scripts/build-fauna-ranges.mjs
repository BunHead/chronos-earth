/**
 * build-fauna-ranges.mjs — each animal's FOSSIL RANGE, drawn like a border.
 *
 * WHY. "Show their territories like country borders" (the Captain, 11 Oct
 * 2026). Nobody knows a dinosaur's territory; what is known is everywhere its
 * fossils have been found. So this draws that, and calls it that: the area
 * around every dated find of the genus, moved to where those places were in
 * the animal's own time.
 *
 * HOW, per animal:
 *   1. Every Paleobiology Database occurrence of the genus (paleobiodb.org,
 *      CC BY 4.0) whose age overlaps the animal's window (±10 My) — Palaeozoic
 *      animals keep only Palaeozoic rocks, as in add-dinosaurs.mjs.
 *   2. Each find reconstructed to the animal's mid-age with the PALEOMAP plate
 *      model (GPlates web service) — the same model as the drawn relief maps.
 *   3. Finds within ~12° of each other form one area; each area is the convex
 *      hull of the finds with a ~1.5° margin around them (a single find is a
 *      small disc). Finds far apart stay separate areas — no area is drawn
 *      across an ocean the animal never crossed on the evidence.
 *
 * Output: public/data/fauna-ranges.json  { id: [[[lon,lat],…], …] }
 *
 *   node scripts/build-fauna-ranges.mjs [--only trex,triceratops]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAUNA = join(__dirname, '..', 'public', 'data', 'fauna.json');
const OUT = join(__dirname, '..', 'public', 'data', 'fauna-ranges.json');
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i > 0 ? new Set(process.argv[i + 1].split(',')) : null;
})();
const MARGIN = 1.5; // degrees around each find
const LINK = 12; // finds closer than this (degrees) share an area

/** The genus the animal was placed by (its Wikipedia title's first word). */
const genusOf = (a) => String(a.wiki ?? a.name).replace(/_/g, ' ').split(/[ (]/)[0];

async function getJson(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(1500 * 2 ** a);
  }
  return null;
}

/** Reconstruct many points at once (the service takes a list). */
async function reconstruct(points, ma) {
  const out = [];
  for (let i = 0; i < points.length; i += 60) {
    const chunk = points.slice(i, i + 60);
    const q = chunk.map(([lo, la]) => `${lo},${la}`).join(',');
    const j = await getJson(`https://gws.gplates.org/reconstruct/reconstruct_points/?points=${q}&time=${Math.round(ma)}&model=PALEOMAP`);
    const coords = j?.coordinates ?? [];
    chunk.forEach((_, k) => {
      const c = coords[k];
      out.push(c && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90 ? c : null);
    });
    await sleep(150);
  }
  return out;
}

const dist = (a, b) => {
  const dl = Math.abs(a[0] - b[0]);
  return Math.hypot(Math.min(dl, 360 - dl) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180)), a[1] - b[1]);
};

/** Single-linkage clusters. */
function clusters(pts) {
  const groups = [];
  const seen = new Set();
  for (let i = 0; i < pts.length; i++) {
    if (seen.has(i)) continue;
    const g = [i];
    seen.add(i);
    for (let q = 0; q < g.length; q++) {
      for (let j = 0; j < pts.length; j++) {
        if (!seen.has(j) && dist(pts[g[q]], pts[j]) < LINK) { seen.add(j); g.push(j); }
      }
    }
    groups.push(g.map((k) => pts[k]));
  }
  return groups;
}

/** Convex hull (monotone chain) of [lon,lat] points. */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = [];
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The area for one cluster: hull of a small disc around every find. */
function area(group) {
  const ring = [];
  for (const [lo, la] of group) {
    const k = 1 / Math.max(0.2, Math.cos((la * Math.PI) / 180));
    for (let s = 0; s < 12; s++) {
      const t = (s / 12) * Math.PI * 2;
      ring.push([lo + Math.cos(t) * MARGIN * k, Math.max(-89.5, Math.min(89.5, la + Math.sin(t) * MARGIN))]);
    }
  }
  const h = hull(ring).map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]);
  return h.length >= 3 ? h : null;
}

const fauna = JSON.parse(await readFile(FAUNA, 'utf8')).fauna;
let out = {};
try { out = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
for (const a of fauna) {
  if (only && !only.has(a.id)) continue;
  if (a.fromMa == null || a.fromMa < 1) continue; // recent animals: modern maps, no drift needed — skipped for now
  const genus = genusOf(a);
  const j = await getJson(`https://paleobiodb.org/data1.2/occs/list.json?base_name=${encodeURIComponent(genus)}&show=coords&vocab=pbdb&limit=all`);
  if (!j) { console.log(`  ${a.name}: PBDB did not answer`); continue; }
  const palaeozoic = a.fromMa > 251.9;
  const lo = a.toMa - 10, hi = a.fromMa + 10;
  const finds = (j.records ?? [])
    .filter((o) => Number.isFinite(+o.lat) && Number.isFinite(+o.lng) && +o.max_ma > 0)
    .filter((o) => +o.max_ma >= lo && +o.min_ma <= hi)
    .filter((o) => !palaeozoic || +o.max_ma >= 251.9)
    .map((o) => [+(+o.lng).toFixed(2), +(+o.lat).toFixed(2)]);
  const uniq = [...new Map(finds.map((p) => [p.join(','), p])).values()];
  if (!uniq.length) { console.log(`  ${a.name}: no finds in its window`); continue; }
  const mid = (a.fromMa + a.toMa) / 2;
  const placed = (await reconstruct(uniq, mid)).filter(Boolean);
  const areas = clusters(placed).map(area).filter(Boolean);
  out[a.id] = areas;
  console.log(`  ${a.name.padEnd(24)} ${uniq.length} find sites → ${areas.length} area(s) at ${mid.toFixed(0)} Ma`);
  await sleep(300);
}
await writeFile(OUT, JSON.stringify({
  _comment: 'Fossil ranges: the area around every dated find of each genus (PBDB, CC BY 4.0), reconstructed with PALEOMAP to the animal\'s mid-age. Where fossils are known — not a territory. scripts/build-fauna-ranges.mjs',
  ...Object.fromEntries(Object.entries(out).filter(([k]) => k !== '_comment')),
}));
console.log(`${Object.keys(out).filter((k) => k !== '_comment').length} animals with ranges`);
