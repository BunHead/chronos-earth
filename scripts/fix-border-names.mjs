/**
 * fix-border-names.mjs — call modern countries by the names they have.
 *
 * WHY. Checking every existing sovereign state against the border maps, 33
 * seemed to be missing. Most were not missing at all; the snapshots — derived
 * from an older basemap — simply use old or formal names, so the countries were
 * drawn but could not be found by search, and a click named them wrongly:
 * Byelarus, Burma, Zaire, "Gambia, The", "Korea, Republic of", Trinidad.
 * Switzerland was the worst: it is in the 1994-2022 maps with NO NAME AT ALL,
 * so a click on Bern named nothing.
 *
 * EVERY RENAME IS DATED. A name is changed only in snapshots from the year the
 * country actually took it: Burma becomes Myanmar from 1989, so the 1800 and
 * 1945 maps keep Burma; Zaire becomes the DR Congo from 1997, so 1994 keeps
 * Zaire — but the 1945 and 1960 maps calling it "Zaire" were anachronisms, and
 * those become the Belgian Congo and Congo-Léopoldville. Swaziland is Eswatini
 * only in the 2022 map; Macedonia is North Macedonia only in 2022.
 *
 * "UNKNOWN" ISLANDS, 1994 ON. Before 1994, "Unknown" in these maps is a real
 * statement — no state held that land — and is left alone. In the modern maps
 * it is a heap of islands that belong to someone: Gotland, the Dodecanese, the
 * Hebrides, Orkney and Shetland, the Isle of Man, the Faroes, the Ryukyus, and
 * Antarctica. They are assigned from an explicit table, NOT by nearest
 * country: Rhodes is 18 km from Turkey and Greek, and "nearest" would get it
 * wrong. Anything the table does not cover is reported and left "Unknown".
 *
 * Idempotent. Re-running changes nothing.
 *
 *   node scripts/fix-border-names.mjs
 *   node scripts/fix-border-names.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'public', 'data', 'borders');
const CHECK_ONLY = process.argv.includes('--check');

/** [old name, new name, applies to snapshots from this year, up to this year]. */
export const RENAMES = [
  ['Byelarus', 'Belarus', 1991, Infinity],
  ['Burma', 'Myanmar', 1989, Infinity],
  ['Zaire', 'Democratic Republic of the Congo', 1997, Infinity],
  ['Zaire', 'Belgian Congo', -Infinity, 1959],
  ['Zaire', 'Congo-Léopoldville', 1960, 1970],
  ['Gambia, The', 'The Gambia', -Infinity, Infinity],
  ['Korea, Republic of', 'South Korea', -Infinity, Infinity],
  ["Korea, Democratic People's Republic of", 'North Korea', -Infinity, Infinity],
  ['Trinidad', 'Trinidad and Tobago', 1962, Infinity],
  ['Tanzania, United Republic of', 'Tanzania', 1964, Infinity],
  ['Tanzania, United Republic of', 'Tanganyika', -Infinity, 1963],
  ['Swaziland', 'Eswatini', 2018, Infinity],
  ['Macedonia', 'North Macedonia', 2019, Infinity],
  // Typos in the ancient China snapshots (the Captain asked after the Warring
  // States, 8 Oct 2026): 1000 BCE's "Zhoa" and 323 BCE's "Zhow states".
  ['Zhoa', 'Zhou', -Infinity, Infinity],
  ['Zhow states', 'Zhou states', -Infinity, Infinity],
  // Hong Kong was drawn as its own polygon from 1650 with a name and no owner,
  // so the 1997 handover never showed. British from 1841 (Hong Kong Island,
  // ceded by the Treaty of Nanking, 1842; Kowloon 1860; the New Territories
  // leased 1898 — the maps are too coarse to split the three), then part of
  // China as a Special Administrative Region from 1 July 1997. Before 1841 it
  // is simply part of the Chinese state around it (see SURROUNDED below).
  ['Hong Kong', 'Hong Kong (UK)', 1841, 1996],
  ['Hong Kong', 'Hong Kong (China)', 1997, Infinity],
  ['Hong Kong (UK)', 'Hong Kong (China)', 1997, Infinity],
];

/**
 * Before these years the place was part of the state around it, not a polity
 * of its own: [name, year it became separate, a point just over its border
 * that lies in the surrounding state]. The polygon takes that state's name.
 */
export const SURROUNDED = [['Hong Kong', 1841, 114.1, 22.65]];

/**
 * Macau is too small for the basemap, so no snapshot drew it. Portuguese from
 * the 1557 settlement (formal sovereignty by the 1887 treaty) until it passed
 * to China on 20 December 1999. Outline hand-drawn at the maps' own coarseness:
 * the peninsula, and Taipa with Coloane.
 */
export const MACAU = {
  from: 1557,
  // Like Hong Kong's 1997, the year of the handover shows how it ended.
  china: 1999,
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [[[113.53, 22.22], [113.56, 22.22], [113.56, 22.18], [113.53, 22.18], [113.53, 22.22]]],
      [[[113.53, 22.17], [113.6, 22.17], [113.6, 22.11], [113.53, 22.11], [113.53, 22.17]]],
    ],
  },
};
export const macauName = (year) => (year >= MACAU.china ? 'Macau (China)' : 'Macau (Portugal)');

/** Island groups labelled "Unknown" in the 1994+ maps: [name, s, w, n, e]. */
export const ISLANDS = [
  ['Antarctica', -91, -180, -60, 180],
  ['Faroe Islands', 61.3, -7.9, 62.5, -6.1],
  ['Isle of Man', 54.0, -4.9, 54.5, -4.2],
  ['United Kingdom', 55.0, -8.0, 61.0, -0.5],
  ['United Kingdom', 53.1, -4.8, 53.5, -4.0], // Anglesey
  ['Taiwan', 21.8, 119.9, 25.4, 122.1], // the whole island is "Unknown" in the 1994 map
  ['Sweden', 56.8, 17.9, 58.1, 19.6],
  ['Greece', 35.8, 26.0, 37.6, 28.4],
  ['Japan', 23.9, 122.8, 33.2, 132.0],
];
const MODERN_FROM = 1994;

const vertexMean = (ring) => {
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return [x / ring.length, y / ring.length];
};
function pointInRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polysOf = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);

export function fixFrame(g, year) {
  const log = [];
  // 1. dated renames
  for (const f of g.features) {
    const name = f.properties?.name ?? '';
    for (const [from, to, since, until] of RENAMES) {
      if (name === from && year >= since && year <= until) {
        f.properties.name = to;
        log.push(`${from} -> ${to}`);
        break;
      }
    }
  }
  // 1b. places that were part of the state around them before they split off
  for (const [place, since, lon, lat] of SURROUNDED) {
    if (year >= since) continue;
    const f = g.features.find((x) => x.properties?.name === place);
    const around = g.features.find(
      (x) => x !== f && x.properties?.name && polysOf(x.geometry).some((p) => pointInRing(lon, lat, p[0])),
    );
    if (f && around) {
      f.properties.name = around.properties.name;
      log.push(`${place} -> ${around.properties.name}`);
    }
  }
  // 1c. Macau, drawn on top (last) so no neighbour hides it
  if (year >= MACAU.from) {
    const want = macauName(year);
    const f = g.features.find((x) => (x.properties?.name ?? '').startsWith('Macau'));
    if (!f) {
      g.features.push({ type: 'Feature', properties: { name: want }, geometry: MACAU.geometry });
      log.push(`added ${want}`);
    } else if (f.properties.name !== want) {
      log.push(`${f.properties.name} -> ${want}`);
      f.properties.name = want;
    }
  }
  if (year < MODERN_FROM) return { g, log, left: 0 };
  // 2. the unnamed Switzerland — identified by containing Bern, not by position in the file
  for (const f of g.features) {
    if ((f.properties?.name ?? '') !== '') continue;
    if (polysOf(f.geometry).some((p) => pointInRing(7.45, 46.95, p[0]))) {
      f.properties.name = 'Switzerland';
      log.push('(unnamed) -> Switzerland');
    }
  }
  // 3. "Unknown" islands: split into one feature per polygon, name each from the table
  const out = [];
  let left = 0;
  for (const f of g.features) {
    if (f.properties?.name !== 'Unknown') { out.push(f); continue; }
    const byName = new Map();
    for (const poly of polysOf(f.geometry)) {
      const [lon, lat] = vertexMean(poly[0]);
      const hit = ISLANDS.find(([, s, w, n, e]) => lat >= s && lat <= n && lon >= w && lon <= e);
      const name = hit ? hit[0] : 'Unknown';
      if (!hit) left++;
      (byName.get(name) ?? byName.set(name, []).get(name)).push(poly);
    }
    for (const [name, polys] of byName) {
      out.push({ type: 'Feature', properties: { name }, geometry: { type: 'MultiPolygon', coordinates: polys } });
      if (name !== 'Unknown') log.push(`Unknown islands -> ${name} (${polys.length})`);
    }
  }
  g.features = out;
  return { g, log, left };
}

async function main() {
  const manifest = JSON.parse(await readFile(join(DIR, 'manifest.json'), 'utf8'));
  for (const f of manifest.frames) {
    const file = join(DIR, f.file);
    const g = JSON.parse(await readFile(file, 'utf8'));
    const { log, left } = fixFrame(g, f.year);
    if (!log.length) continue;
    const counts = log.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
    console.log(`${String(f.year).padStart(6)}: ${[...counts].map(([l, n]) => (n > 1 ? `${l} x${n}` : l)).join('; ')}` +
      (left ? `  [${left} island polygon(s) not in the table, left "Unknown"]` : ''));
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
