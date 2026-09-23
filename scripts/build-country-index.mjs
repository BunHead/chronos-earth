/**
 * build-country-index.mjs — make every country on the map searchable.
 *
 * WHY. The Captain typed "Barbados" and got nothing. Search knew events,
 * battles, sites, eras, creatures and videos, and not one country — even though
 * every border snapshot NAMES every country it draws. The names were on the
 * globe and nowhere a search box could reach.
 *
 * WHAT IT WRITES. public/data/borders/countries.json, one row per distinct
 * polity name across all the snapshots:
 *
 *   name   as the snapshot spells it
 *   years  the snapshot years it appears in — so a result can say "on the map
 *          1880–1914" and the app can jump the timeline to a year it exists
 *   lat/lon  a point GUARANTEED to be inside its largest polygon, taken from
 *          the most recent snapshot that has it. Not the centroid: the centroid
 *          of a crescent (Chile, Croatia, the Philippines' largest island) can
 *          land in the sea, and a dossier opened in the sea names nothing.
 *   span   the size of that polygon in degrees, so the camera can frame a
 *          continent and an island differently
 *
 * Small: ~1,700 names, 25 KB gzipped, fetched only when the search box is
 * first focused, alongside the main search index.
 *
 *   node scripts/build-country-index.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'public', 'data', 'borders');

const ringArea = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a / 2);
};

export function pointInRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A point inside the ring. Try the vertex mean first; if that falls outside,
 * cast horizontal lines at several latitudes and take the middle of the widest
 * interior run found. Cheap, deterministic, and always inside.
 */
export function interiorPoint(r) {
  let sx = 0, sy = 0;
  for (const [x, y] of r) { sx += x; sy += y; }
  const mean = [sx / r.length, sy / r.length];
  if (pointInRing(mean[0], mean[1], r)) return mean;
  let s = Infinity, n = -Infinity;
  for (const [, y] of r) { if (y < s) s = y; if (y > n) n = y; }
  let best = null;
  let bestW = -1;
  for (let k = 1; k < 16; k++) {
    const y = s + ((n - s) * k) / 16;
    const xs = [];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      if (w > bestW) { bestW = w; best = [(xs[i] + xs[i + 1]) / 2, y]; }
    }
  }
  return best ?? r[0];
}

async function main() {
  const manifest = JSON.parse(await readFile(join(DIR, 'manifest.json'), 'utf8'));
  const frames = [...manifest.frames].sort((a, b) => a.year - b.year);
  const byName = new Map();
  for (const f of frames) {
    const g = JSON.parse(await readFile(join(DIR, f.file), 'utf8'));
    // ONE COUNTRY CAN BE SEVERAL FEATURES in a snapshot, all with the same
    // name. Taking whichever came last put the United States on Long Island.
    // So the largest ring is chosen across ALL of a name's features in the
    // frame first, and only then written to the row.
    const bestInFrame = new Map();
    for (const feat of g.features ?? []) {
      const name = String(feat.properties?.name ?? feat.properties?.NAME ?? '').trim();
      if (!name || !feat.geometry) continue;
      const polys = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
      let ring = null;
      let area = 0;
      for (const p of polys) {
        const a = p?.[0] ? ringArea(p[0]) : 0;
        if (a > area) { area = a; ring = p[0]; }
      }
      if (!ring) continue;
      const cur = bestInFrame.get(name);
      if (!cur || area > cur.area) bestInFrame.set(name, { ring, area });
    }
    for (const [name, { ring }] of bestInFrame) {
      const row = byName.get(name) ?? { name, years: [] };
      if (!row.years.includes(f.year)) row.years.push(f.year);
      // Later snapshots overwrite: the point comes from the most recent map.
      const [lon, lat] = interiorPoint(ring);
      let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
      for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
      Object.assign(row, { lat: +lat.toFixed(2), lon: +lon.toFixed(2), span: +Math.max(e - w, n - s).toFixed(2) });
      byName.set(name, row);
    }
  }
  const rows = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const out = {
    v: 1,
    latestFrame: frames[frames.length - 1].year,
    frames: frames.map((f) => f.year),
    name: rows.map((r) => r.name),
    years: rows.map((r) => r.years),
    lat: rows.map((r) => r.lat),
    lon: rows.map((r) => r.lon),
    span: rows.map((r) => r.span),
  };
  const file = join(DIR, 'countries.json');
  await writeFile(file, JSON.stringify(out));
  console.log(`${rows.length} countries across ${frames.length} snapshots -> ${file.split(/[\\/]/).slice(-3).join('/')}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
