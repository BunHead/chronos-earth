/**
 * fetch-great-wall-profile.mjs — the Badaling wall's real line and heights.
 *
 * WHY. The Great Wall model (src/lib/landmarkMesh.ts) ships on a
 * representative ridge: built without network access, it had no survey to
 * stand on. This fetches one, so the wall follows the real crest and its
 * footing meets the globe's real hills instead of a ridge of its own:
 *
 *  1. the wall's line — the OpenStreetMap way(s) mapped as the wall nearest
 *     the pin (barrier=city_wall / historic=citywalls, or named 长城 / Great
 *     Wall), stitched end to end and cut to WINDOW m centred on the pin;
 *  2. the ground under it every STEP m, and under the pin, from a 30 m DEM
 *     (OpenTopoData SRTM 30 m; Open-Meteo's Copernicus 90 m if that fails).
 *
 * Output: src/data/greatWallProfile.ts (committed, so the model rebuilds
 * without the network and a later OSM edit cannot silently move the wall).
 * Then: node scripts/build-landmark-models.mjs, and set monumentFit.ts's
 * 'great-wall' widthM to the footprint it prints.
 *
 * The DEM is not the globe's own terrain (ArcGIS World Elevation), and 30 m
 * cells smooth a knife-edge crest by a few metres, so the wall may sit a
 * little into or above the real ridge in places. The towers stand on the
 * three highest crests, not their surveyed spots.
 *
 * OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0. SRTM: NASA/USGS
 * (public domain), via OpenTopoData. Copernicus DEM © ESA, via Open-Meteo.
 *
 *   node scripts/fetch-great-wall-profile.mjs
 *   node scripts/fetch-great-wall-profile.mjs --check   (fetch and report; write nothing)
 *
 * OVERPASS_URL / OPENTOPODATA_URL / OPENMETEO_URL override the endpoints.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'greatWallProfile.ts');
const CHECK_ONLY = process.argv.includes('--check');

const PIN = { lat: 40.36, lon: 116.02 };
const RADIUS = 900; // m round the pin to look for the wall
const WINDOW = 740; // m of wall to keep, centred on the pin's nearest point
const STEP = 10; // m between height samples

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const OPENTOPO = process.env.OPENTOPODATA_URL ?? 'https://api.opentopodata.org/v1/srtm30m';
const OPENMETEO = process.env.OPENMETEO_URL ?? 'https://api.open-meteo.com/v1/elevation';
const UA = { 'User-Agent': 'ChronosEarth/1.0 (bunhead.github.io)' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KX = 111_320 * Math.cos((PIN.lat * Math.PI) / 180), KZ = 111_320;
const toXY = ([lat, lon]) => [(lon - PIN.lon) * KX, (lat - PIN.lat) * KZ];
const toLL = ([x, y]) => [PIN.lat + y / KZ, PIN.lon + x / KX];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

async function overpassWays() {
  const q = `[out:json][timeout:90];
(
  way(around:${RADIUS},${PIN.lat},${PIN.lon})["barrier"="city_wall"];
  way(around:${RADIUS},${PIN.lat},${PIN.lon})["historic"="citywalls"];
  way(around:${RADIUS},${PIN.lat},${PIN.lon})["name"~"长城|Great Wall"];
);
out geom;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q),
    });
    if (res.ok) {
      const json = await res.json();
      return (json.elements ?? []).filter((e) => e.type === 'way' && e.geometry?.length > 1 && e.nodes?.length === e.geometry.length);
    }
    console.log(`Overpass HTTP ${res.status} — retrying`);
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error('Overpass failed');
}

/** The way nearest the pin, grown at both ends through ways that share an end node. */
function stitch(ways) {
  const pin = [0, 0];
  const nearest = (w) => Math.min(...w.geometry.map((g) => dist(toXY([g.lat, g.lon]), pin)));
  const start = ways.reduce((a, w) => (nearest(w) < nearest(a) ? w : a));
  let ids = [...start.nodes], pts = start.geometry.map((g) => [g.lat, g.lon]);
  const used = new Set([start.id]);
  for (let grown = true; grown;) {
    grown = false;
    for (const w of ways) {
      if (used.has(w.id)) continue;
      const g = w.geometry.map((p) => [p.lat, p.lon]);
      const head = ids[0], tail = ids[ids.length - 1], a = w.nodes[0], z = w.nodes[w.nodes.length - 1];
      if (a === tail) { ids = [...ids, ...w.nodes.slice(1)]; pts = [...pts, ...g.slice(1)]; }
      else if (z === tail) { ids = [...ids, ...[...w.nodes].reverse().slice(1)]; pts = [...pts, ...[...g].reverse().slice(1)]; }
      else if (z === head) { ids = [...w.nodes.slice(0, -1), ...ids]; pts = [...g.slice(0, -1), ...pts]; }
      else if (a === head) { ids = [...[...w.nodes].reverse().slice(0, -1), ...ids]; pts = [...[...g].reverse().slice(0, -1), ...pts]; }
      else continue;
      used.add(w.id);
      grown = true;
    }
  }
  return { pts: pts.map(toXY), ways: [...used] };
}

/** Points every STEP m along a polyline, WINDOW m centred on the point nearest the pin. */
function resample(xy) {
  const cum = [0];
  for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + dist(xy[i - 1], xy[i]));
  const total = cum[cum.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [xy[i - 1][0] + (xy[i][0] - xy[i - 1][0]) * f, xy[i - 1][1] + (xy[i][1] - xy[i - 1][1]) * f];
  };
  let sPin = 0, best = Infinity;
  for (let s = 0; s <= total; s += 2) { const d = dist(at(s), [0, 0]); if (d < best) { best = d; sPin = s; } }
  const s0 = Math.max(0, Math.min(sPin - WINDOW / 2, total - WINDOW)), s1 = Math.min(total, s0 + WINDOW);
  const out = [];
  for (let s = s0; s < s1; s += STEP) out.push(at(s));
  out.push(at(s1));
  return { pts: out, length: s1 - s0, offPin: best };
}

async function heights(lls) {
  try {
    const out = [];
    for (let i = 0; i < lls.length; i += 100) {
      const locs = lls.slice(i, i + 100).map(([la, lo]) => `${la.toFixed(6)},${lo.toFixed(6)}`).join('|');
      const res = await fetch(`${OPENTOPO}?locations=${locs}`, { headers: UA });
      if (!res.ok) throw new Error(`OpenTopoData HTTP ${res.status}`);
      const json = await res.json();
      for (const r of json.results) { if (r.elevation == null) throw new Error('OpenTopoData: no data'); out.push(r.elevation); }
      await sleep(1100); // its public API allows one call a second
    }
    return { elev: out, source: 'SRTM 30 m (NASA/USGS) via OpenTopoData' };
  } catch (err) {
    console.log(`  ${err.message} — falling back to Open-Meteo (Copernicus 90 m)`);
    const out = [];
    for (let i = 0; i < lls.length; i += 100) {
      const part = lls.slice(i, i + 100);
      const res = await fetch(`${OPENMETEO}?latitude=${part.map((p) => p[0].toFixed(6)).join(',')}&longitude=${part.map((p) => p[1].toFixed(6)).join(',')}`, { headers: UA });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      out.push(...(await res.json()).elevation);
    }
    return { elev: out, source: 'Copernicus DEM GLO-90 (ESA) via Open-Meteo' };
  }
}

async function main() {
  const ways = await overpassWays();
  if (!ways.length) throw new Error(`no wall mapped within ${RADIUS} m of the pin`);
  const line = stitch(ways);
  const { pts, length, offPin } = resample(line.pts);
  if (offPin > 300) throw new Error(`the nearest mapped wall is ${Math.round(offPin)} m from the pin — not Badaling's?`);
  if (length < 200) throw new Error(`only ${Math.round(length)} m of wall found`);
  const lls = pts.map(toLL);
  const { elev, source } = await heights([[PIN.lat, PIN.lon], ...lls]);
  const [pinElev, ...pathElev] = elev;
  const path = lls.map(([la, lo], i) => [Number(la.toFixed(6)), Number(lo.toFixed(6)), Math.round(pathElev[i] * 10) / 10]);
  const rise = Math.max(...pathElev) - Math.min(...pathElev);
  const date = new Date().toISOString().slice(0, 10);
  console.log(`${line.ways.length} OSM way(s) → ${Math.round(length)} m of wall, ${path.length} samples, ` +
    `${Math.round(offPin)} m from the pin; ground ${Math.min(...pathElev).toFixed(0)}–${Math.max(...pathElev).toFixed(0)} m ` +
    `(rise ${rise.toFixed(0)} m), pin ${pinElev.toFixed(0)} m`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  const ts = `/**
 * greatWallProfile.ts — the surveyed line and heights of the Badaling wall,
 * written by scripts/fetch-great-wall-profile.mjs (OpenStreetMap's wall way,
 * heights from a 30 m DEM). Empty until that script has been run with network
 * access; while \`path\` is null the model keeps its representative ridge.
 */
export interface GreatWallProfile {
  /** Where the line and heights came from, and when. */
  source: string | null;
  /** The pin and the ground height (m above sea level) under it. */
  pin: { lat: number; lon: number; elevM: number } | null;
  /** The wall's crest, about every 10 m: [lat, lon, ground m above sea level]. */
  path: Array<[number, number, number]> | null;
}

export const GREAT_WALL_PROFILE: GreatWallProfile = {
  source: ${JSON.stringify(`OpenStreetMap ways ${line.ways.join(', ')} (© OpenStreetMap contributors, ODbL); heights: ${source}; fetched ${date}`)},
  pin: { lat: ${PIN.lat}, lon: ${PIN.lon}, elevM: ${Math.round(pinElev * 10) / 10} },
  path: [
${path.map((p) => `    [${p.join(', ')}],`).join('\n')}
  ],
};
`;
  await writeFile(OUT, ts);
  console.log(`wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
