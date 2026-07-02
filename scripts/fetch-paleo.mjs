/**
 * fetch-paleo.mjs
 * ----------------
 * Downloads continental-drift reconstruction frames from the GPlates Web
 * Service (https://gws.gplates.org) and saves SIMPLIFIED GeoJSON snapshots into
 * public/data/paleo/. Running this once bundles the data, so the live app never
 * depends on the remote service being online (a "graceful fallback").
 *
 * Usage:  node scripts/fetch-paleo.mjs
 *
 * Data source / credit: GPlates Web Service, EarthByte group, University of
 * Sydney. Rotation model: MERDITH2021. See the app's About page for citation.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'paleo');

const MODEL = 'MERDITH2021';
const STEP = 10; // millions of years between frames
const MAX_MA = 250;
const DECIMATE = 4; // keep every Nth point along each coastline
const PRECISION = 1; // decimal places of lon/lat to keep (~11 km)

function round(n) {
  const f = 10 ** PRECISION;
  return Math.round(n * f) / f;
}

/** Decimate + round one GeoJSON FeatureCollection into a compact MultiPolygon set. */
function simplify(fc) {
  const out = { type: 'FeatureCollection', features: [] };
  for (const feature of fc.features ?? []) {
    const g = feature.geometry;
    if (!g) continue;
    const polys =
      g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
    if (!polys) continue;

    const newPolys = [];
    for (const poly of polys) {
      const newRings = [];
      for (const ring of poly) {
        const pts = [];
        for (let i = 0; i < ring.length; i++) {
          if (i % DECIMATE !== 0 && i !== ring.length - 1) continue;
          pts.push([round(ring[i][0]), round(ring[i][1])]);
        }
        // Remove consecutive duplicate points.
        const dd = [];
        for (const p of pts) {
          const last = dd[dd.length - 1];
          if (!last || last[0] !== p[0] || last[1] !== p[1]) dd.push(p);
        }
        if (dd.length >= 4) {
          const a = dd[0];
          const b = dd[dd.length - 1];
          if (a[0] !== b[0] || a[1] !== b[1]) dd.push(a); // close the ring
          newRings.push(dd);
        }
      }
      if (newRings.length) newPolys.push(newRings);
    }
    if (newPolys.length) {
      out.features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiPolygon', coordinates: newPolys },
      });
    }
  }
  return out;
}

async function fetchFrame(timeMa) {
  const url = `https://gws.gplates.org/reconstruct/coastlines/?time=${timeMa}&model=${MODEL}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${timeMa} Ma`);
  const fc = await res.json();
  return simplify(fc);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const frames = [];
  for (let t = 0; t <= MAX_MA; t += STEP) frames.push(t);

  const manifest = [];
  for (const t of frames) {
    process.stdout.write(`Fetching ${t} Ma ... `);
    try {
      const simplified = await fetchFrame(t);
      const file = `coastlines-${t}.geojson`;
      const json = JSON.stringify(simplified);
      await writeFile(join(OUT_DIR, file), json);
      manifest.push({ timeMa: t, file });
      console.log(`ok (${(json.length / 1024).toFixed(0)} KB, ${simplified.features.length} polys)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  await writeFile(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ model: MODEL, stepMa: STEP, maxMa: MAX_MA, frames: manifest }, null, 2),
  );
  console.log(`\nDone. ${manifest.length}/${frames.length} frames saved to public/data/paleo/`);
}

main();
