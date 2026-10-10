/**
 * fetch-osm-site.mjs — a whole ancient site's ground plan, from OpenStreetMap.
 *
 * WHY. The Captain asked for the Maya, Inca and Olmec sites as WHOLE SITES,
 * not one pyramid (10 Oct 2026). Their temples, platforms and plazas are
 * already traced by OpenStreetMap's mappers from aerial imagery, so the plan
 * comes from there — positions and outlines are surveyed fact, not guesses.
 * Heights are not in OSM; they come from each site's sources, per structure,
 * in the site's recipe (src/lib/sites/*).
 *
 * OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0
 * (openstreetmap.org/copyright). Credited in the app's About panel.
 *
 * Output: scripts/data/osm/<site>.json — every way within RADIUS m of the
 * centre carrying a building / historic / ruins / man_made / place tag, with
 * its tags and its outline as [lat, lon] pairs. Committed: it is the input
 * the site recipe is built from, so the model can be rebuilt without the
 * network and a later OSM edit cannot silently move a temple.
 *
 *   node scripts/fetch-osm-site.mjs tikal 17.2221 -89.6237 1100
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [site, latS, lonS, radS] = process.argv.slice(2);
if (!site || !latS || !lonS) {
  console.error('usage: node scripts/fetch-osm-site.mjs <site> <lat> <lon> [radiusM]');
  process.exit(1);
}
const lat = Number(latS);
const lon = Number(lonS);
const R = Number(radS ?? 1000);

const q = `[out:json][timeout:120];
(
  way(around:${R},${lat},${lon})["building"];
  way(around:${R},${lat},${lon})["historic"];
  way(around:${R},${lat},${lon})["ruins"];
  way(around:${R},${lat},${lon})["man_made"];
  way(around:${R},${lat},${lon})["place"="square"];
  way(around:${R},${lat},${lon})["area:highway"];
  way(around:${R},${lat},${lon})["highway"="pedestrian"]["area"="yes"];
  // Big structures are often MULTIPOLYGON relations, not ways — Teotihuacan's
  // Pyramid of the Sun is one (its named way is a 1,900 m² patch beside it).
  relation(around:${R},${lat},${lon})["type"="multipolygon"]["building"];
  relation(around:${R},${lat},${lon})["type"="multipolygon"]["historic"];
);
out geom;`;

let json;
for (let attempt = 0; attempt < 4; attempt++) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'ChronosEarth/1.0 (bunhead.github.io)', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q),
  });
  if (res.ok) { json = await res.json(); break; }
  console.log(`Overpass HTTP ${res.status} — retrying`);
  await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
}
if (!json) { console.error('Overpass did not answer'); process.exit(1); }

const pt = (g) => [+g.lat.toFixed(7), +g.lon.toFixed(7)];
/** Stitch a relation's OUTER member ways end-to-end into closed rings. */
function outerRings(rel) {
  const segs = (rel.members ?? [])
    .filter((m) => m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry))
    .map((m) => m.geometry.map(pt));
  const rings = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (segs.length) {
    let ring = segs.shift();
    let grew = true;
    while (!same(ring[0], ring.at(-1)) && grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i];
        if (same(ring.at(-1), sg[0])) ring = ring.concat(sg.slice(1));
        else if (same(ring.at(-1), sg.at(-1))) ring = ring.concat(sg.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4 && same(ring[0], ring.at(-1))) rings.push(ring);
  }
  return rings;
}
const ways = [];
for (const e of json.elements) {
  if (e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 3) {
    ways.push({ id: e.id, tags: e.tags ?? {}, outline: e.geometry.map(pt) });
  } else if (e.type === 'relation') {
    // One entry per outer ring; the relation's tags travel with each.
    for (const ring of outerRings(e)) ways.push({ id: e.id, relation: true, tags: e.tags ?? {}, outline: ring });
  }
}
const out = {
  site,
  centre: { lat, lon },
  radiusM: R,
  fetched: new Date().toISOString().slice(0, 10),
  licence: 'Data © OpenStreetMap contributors, ODbL 1.0 — openstreetmap.org/copyright',
  ways,
};
await mkdir(join(__dirname, 'data', 'osm'), { recursive: true });
await writeFile(join(__dirname, 'data', 'osm', `${site}.json`), JSON.stringify(out));
const named = ways.filter((w) => w.tags.name);
console.log(`${site}: ${ways.length} outlines, ${named.length} named`);
for (const w of named) console.log(`  ${w.tags.name} · ${Object.entries(w.tags).filter(([k]) => k !== 'name').map(([k, v]) => `${k}=${v}`).join(' ')}`);
