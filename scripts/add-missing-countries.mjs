/**
 * add-missing-countries.mjs — the sovereign states the border maps never drew.
 *
 * WHY. Checked against every existing sovereign state, the modern maps had no
 * outline at all for ~23 of them. The basemap they derive from predates some
 * (South Sudan, 2011) and at its resolution simply dropped the smallest:
 * Singapore, Monaco, Timor-Leste, Bahrain, the Solomon Islands, Vanuatu and
 * most of the Pacific. A click on Singapore named nothing, and a search had
 * nowhere to fly.
 *
 * SOURCE. Natural Earth, 1:10m admin-0 countries — public domain — downloaded
 * with the Captain's permission on 24 Sept 2026 into .cache/ (git-ignored).
 * It is a BUILD input only; visitors never fetch it. Only the missing outlines
 * are copied into our own maps.
 *
 * NOT THE 1:50m FILE, and this was measured, not assumed: the 50m version
 * draws West Jerusalem — the Knesset — inside Palestine, and puts the Vatican
 * 1.5 km west of St Peter's. The 10m version gets Jerusalem right. It does NOT
 * get the Vatican right either: Natural Earth represents it at every scale as a
 * token square about 100 m across, north of the basilica. So the Vatican alone
 * comes from OpenStreetMap (relation 36989, ODbL, "© OpenStreetMap
 * contributors"), kept in scripts/data/vatican-osm-boundary.json.
 *
 * SIMPLIFIED IN PROPORTION. At full 10m detail the Solomon Islands alone is
 * 2,177 points. Each ring is thinned (Douglas–Peucker) to about a thirtieth of
 * its own size (between ~100 m and ~3 km), islets under ~5 km beyond each
 * country's 15 largest are dropped, and coordinates are kept only as precise as
 * the size needs — so a microstate keeps its shape and an archipelago does not
 * bloat a map every visitor downloads. Measured: the 2022 map goes from 64 KB
 * to under 80 KB compressed for all 23 countries.
 *
 * DATED LIKE EVERYTHING ELSE. A country is added only to the snapshots from
 * the year it existed: South Sudan to 2014 and 2022 (independent 2011), Kosovo
 * to 2010 onward (2008), Timor-Leste to 2010 onward (2002), the rest to every
 * map from 1994. Nothing is added before 1994 — the older maps come from a
 * different world and are not ours to redraw.
 *
 * CUT OUT OF THE PARENT, NOT LAID ON TOP. South Sudan sits inside the old
 * Sudan polygon, Kosovo inside Serbia, Palestine inside Israel, San Marino
 * and the Vatican inside Italy. Laid on top alone, a click would still find
 * "Sudan" first. So each new outline is also added to its parent as a HOLE
 * (the maps fill even-odd, so holes already work), and the new country is
 * appended after its parent so it draws over any sliver where two datasets'
 * coastlines disagree by a few km.
 *
 * CONTESTED. Kosovo and Palestine are drawn, as Natural Earth and most
 * atlases draw them — the Captain's choice — and named "Kosovo (disputed)" and
 * "Palestine (disputed)", so every dossier title says so.
 *
 * Idempotent: a country already in a map is skipped.
 *
 *   node scripts/add-missing-countries.mjs
 *   node scripts/add-missing-countries.mjs --check
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { interiorPoint, pointInRing } from './build-country-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'public', 'data', 'borders');
const NE = join(ROOT, '.cache', 'natural-earth', 'ne_10m_admin_0_countries.geojson');
const VATICAN = join(ROOT, 'scripts', 'data', 'vatican-osm-boundary.json');
const CHECK_ONLY = process.argv.includes('--check');
const MODERN_FROM = 1994;

/** Natural Earth ADM0_A3 code, our name, first year it existed as a state. */
export const MISSING = [
  ['SDS', 'South Sudan', 2011],
  ['KOS', 'Kosovo (disputed)', 2008],
  ['PSX', 'Palestine (disputed)', 1994],
  ['TLS', 'Timor-Leste', 2002],
  ['SGP', 'Singapore', 1965],
  ['MCO', 'Monaco', 1297],
  ['SMR', 'San Marino', 301],
  ['VAT', 'Vatican City', 1929],
  ['BHR', 'Bahrain', 1971],
  ['CPV', 'Cape Verde', 1975],
  ['COM', 'Comoros', 1975],
  ['MDV', 'Maldives', 1965],
  ['MUS', 'Mauritius', 1968],
  ['STP', 'São Tomé and Príncipe', 1975],
  ['SYC', 'Seychelles', 1976],
  ['FSM', 'Federated States of Micronesia', 1986],
  ['KIR', 'Kiribati', 1979],
  ['MHL', 'Marshall Islands', 1986],
  ['NRU', 'Nauru', 1968],
  ['PLW', 'Palau', 1994],
  ['SLB', 'Solomon Islands', 1978],
  ['TUV', 'Tuvalu', 1978],
  ['VUT', 'Vanuatu', 1980],
];

/** Douglas–Peucker on one ring, in degrees. Endpoints always kept. */
function simplify(pts, tol) {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Thin a ring in proportion to its own size, then round to ~10 m.
 *
 * A CLOSED ring starts and ends on the same point, so run straight through
 * Douglas–Peucker its baseline has zero length, every vertex looks infinitely
 * far from it, and nothing is removed — which is exactly what the first version
 * did, shipping the Solomon Islands at all 2,177 points. So the ring is split
 * at the vertex farthest from its start and each half is thinned on its own.
 */
export function thinRing(ring) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  const size = Math.max(e - w, n - s);
  const tol = Math.min(0.03, Math.max(0.001, size / 30));
  // Precision to match the size. The basemap these sit in is drawn to 0.1
  // degree (~10 km); storing an archipelago to 10 m is weight with no benefit.
  // Only a microstate needs the fine decimals, or the Vatican collapses.
  const dp = size < 0.05 ? 4 : size < 0.5 ? 3 : 2;
  const [x0, y0] = ring[0];
  let far = 0, farD = -1;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - x0, ring[i][1] - y0);
    if (d > farD) { farD = d; far = i; }
  }
  const thinned = far > 0
    ? [...simplify(ring.slice(0, far + 1), tol), ...simplify(ring.slice(far), tol).slice(1)]
    : ring;
  const out = thinned.map(([x, y]) => [+x.toFixed(dp), +y.toFixed(dp)]);
  return out.length >= 4 ? out : ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
}
const polysOf = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);

export function addToFrame(g, year, ne, vatican = null) {
  const log = [];
  const have = new Set(g.features.map((f) => f.properties?.name));
  for (const [code, name, since] of MISSING) {
    if (year < since || have.has(name)) continue;
    let polys;
    if (code === 'VAT' && vatican) {
      polys = [[thinRing(vatican.ring)]];
    } else {
      const src = ne.features.find((f) => f.properties.ADM0_A3 === code);
      if (!src) { log.push(`!! ${name}: not in Natural Earth`); continue; }
      // ISLETS. The Maldives is 176 rings, most under a kilometre, invisible at
      // any zoom where borders are drawn. Keep every island over ~5 km and the
      // 15 largest regardless; a click near a dropped islet still names the
      // country through the click tolerance in Globe.tsx.
      const span = (r) => {
        let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
        for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
        return Math.max(e - w, n - s);
      };
      const all = polysOf(src.geometry).sort((a, b) => span(b[0]) - span(a[0]));
      polys = all.filter((p, i) => i < 15 || span(p[0]) >= 0.05).map((p) => p.map(thinRing));
    }
    // Cut each piece out of whichever polygon it currently sits inside.
    const parents = new Set();
    for (const p of polys) {
      const [x, y] = interiorPoint(p[0]);
      for (const f of g.features) {
        if (f.properties?.name === name) continue;
        const target = polysOf(f.geometry).find(
          (q) => pointInRing(x, y, q[0]) && !q.slice(1).some((h) => pointInRing(x, y, h)),
        );
        if (target) {
          target.push(p[0]);
          parents.add(f.properties.name);
          break;
        }
      }
    }
    g.features.push({ type: 'Feature', properties: { name }, geometry: { type: 'MultiPolygon', coordinates: polys } });
    log.push(parents.size ? `${name} (cut out of ${[...parents].join(', ')})` : name);
  }
  return log;
}

async function main() {
  try {
    await access(NE);
  } catch {
    console.error(`Natural Earth not found at ${NE}. It is a build-time download:\n` +
      '  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson');
    process.exitCode = 1;
    return;
  }
  const ne = JSON.parse(await readFile(NE, 'utf8'));
  const vatican = JSON.parse(await readFile(VATICAN, 'utf8'));
  const manifest = JSON.parse(await readFile(join(DIR, 'manifest.json'), 'utf8'));
  for (const f of manifest.frames) {
    if (f.year < MODERN_FROM) continue;
    const file = join(DIR, f.file);
    const g = JSON.parse(await readFile(file, 'utf8'));
    const log = addToFrame(g, f.year, ne, vatican);
    if (!log.length) { console.log(`${f.year}: nothing to add`); continue; }
    console.log(`${f.year}: +${log.length}  ${log.join('; ')}`);
    if (!CHECK_ONLY) await writeFile(file, JSON.stringify(g));
  }
  if (CHECK_ONLY) console.log('(--check: nothing written)');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
