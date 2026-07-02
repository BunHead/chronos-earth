/**
 * fetch-borders.mjs
 * ------------------
 * Downloads historical political-border snapshots from the open
 * `historical-basemaps` dataset (by André Ourednik, ODbL licensed) and saves
 * SIMPLIFIED GeoJSON into public/data/borders/. Like the paleo frames, this
 * bundles the data so the live app never depends on GitHub being reachable.
 *
 * Usage:  node scripts/fetch-borders.mjs
 *
 * Data source / credit: https://github.com/aourednik/historical-basemaps
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'borders');
const RAW = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';

// A curated subset spanning all of recorded history (denser where borders are
// well documented). Each entry maps a filename to a signed year (negative=BCE).
const SNAPSHOTS = [
  ['world_bc10000.geojson', -10000],
  ['world_bc5000.geojson', -5000],
  ['world_bc3000.geojson', -3000],
  ['world_bc2000.geojson', -2000],
  ['world_bc1000.geojson', -1000],
  ['world_bc500.geojson', -500],
  ['world_bc323.geojson', -323],
  ['world_bc200.geojson', -200],
  ['world_bc1.geojson', -1],
  ['world_200.geojson', 200],
  ['world_400.geojson', 400],
  ['world_500.geojson', 500],
  ['world_700.geojson', 700],
  ['world_1000.geojson', 1000],
  ['world_1200.geojson', 1200],
  ['world_1279.geojson', 1279],
  ['world_1400.geojson', 1400],
  ['world_1500.geojson', 1500],
  ['world_1600.geojson', 1600],
  ['world_1650.geojson', 1650],
  ['world_1715.geojson', 1715],
  ['world_1783.geojson', 1783],
  ['world_1800.geojson', 1800],
  ['world_1815.geojson', 1815],
  ['world_1880.geojson', 1880],
  ['world_1900.geojson', 1900],
  ['world_1914.geojson', 1914],
  ['world_1920.geojson', 1920],
  ['world_1938.geojson', 1938],
  ['world_1945.geojson', 1945],
  ['world_1960.geojson', 1960],
  ['world_1994.geojson', 1994],
  ['world_2010.geojson', 2010],
];

const DECIMATE = 2;
const PRECISION = 1;

function round(n) {
  const f = 10 ** PRECISION;
  return Math.round(n * f) / f;
}

function simplifyRing(ring) {
  const pts = [];
  for (let i = 0; i < ring.length; i++) {
    if (i % DECIMATE !== 0 && i !== ring.length - 1) continue;
    pts.push([round(ring[i][0]), round(ring[i][1])]);
  }
  const dd = [];
  for (const p of pts) {
    const last = dd[dd.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) dd.push(p);
  }
  if (dd.length < 4) return null;
  const a = dd[0];
  const b = dd[dd.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) dd.push(a);
  return dd;
}

function simplifyGeometry(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
  if (!polys) return null;
  const out = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      const s = simplifyRing(ring);
      if (s) rings.push(s);
    }
    if (rings.length) out.push(rings);
  }
  return out.length ? { type: 'MultiPolygon', coordinates: out } : null;
}

/** Pull a human-readable polity name from the dataset's varied property keys. */
function nameOf(props) {
  if (!props) return 'Unknown';
  return props.NAME ?? props.name ?? props.SUBJECTO ?? props.ABBREVN ?? 'Unknown';
}

async function fetchSnapshot(file) {
  const res = await fetch(`${RAW}/${file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const fc = await res.json();
  const out = { type: 'FeatureCollection', features: [] };
  for (const f of fc.features ?? []) {
    const geom = simplifyGeometry(f.geometry);
    if (!geom) continue;
    out.features.push({ type: 'Feature', properties: { name: nameOf(f.properties) }, geometry: geom });
  }
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = [];
  for (const [file, year] of SNAPSHOTS) {
    process.stdout.write(`Fetching ${file} (${year}) ... `);
    try {
      const simplified = await fetchSnapshot(file);
      const outFile = `borders_${year}.geojson`;
      const json = JSON.stringify(simplified);
      await writeFile(join(OUT_DIR, outFile), json);
      manifest.push({ year, file: outFile });
      console.log(`ok (${(json.length / 1024).toFixed(0)} KB, ${simplified.features.length} polities)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
  manifest.sort((a, b) => a.year - b.year);
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ frames: manifest }, null, 2));
  console.log(`\nDone. ${manifest.length}/${SNAPSHOTS.length} snapshots saved to public/data/borders/`);
}

main();
