/**
 * fetch-fauna-paleo.mjs
 * ---------------------
 * Fills in each animal's `track` in public/data/fauna.json: the fossil site's
 * reconstructed lon/lat at sampled times, via the GPlates Web Service point
 * reconstruction (same MERDITH2021 model as the drift frames), so the icons
 * ride the drifting continents. Re-run after adding animals:
 *   node scripts/fetch-fauna-paleo.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'fauna.json');
const MODEL = 'MERDITH2021';
const STEP = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reconstruct(lon, lat, timeMa) {
  if (timeMa < 0.5) return [lon, lat]; // effectively modern
  const url =
    `https://gws.gplates.org/reconstruct/reconstruct_points/?points=${lon},${lat}` +
    `&time=${timeMa}&model=${MODEL}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'ChronosEarth/1.0' } });
    if (res.ok) {
      const json = await res.json();
      const c = json.coordinates?.[0];
      // The service returns [99.99, 99.99] when a point can't be reconstructed.
      if (!c || (c[0] === 99.99 && c[1] === 99.99)) return [lon, lat];
      return c;
    }
    if (attempt < 4) {
      await sleep(800 * 2 ** attempt);
      continue;
    }
    throw new Error(`GWS HTTP ${res.status}`);
  }
}

/** Sample times for an animal: its endpoints plus every 10-My grid line inside. */
function sampleTimes(fromMa, toMa) {
  const times = new Set([toMa, fromMa]);
  for (let t = Math.ceil(toMa / STEP) * STEP; t <= fromMa; t += STEP) times.add(t);
  return [...times].sort((a, b) => a - b);
}

async function main() {
  const json = JSON.parse(await readFile(FILE, 'utf-8'));
  let done = 0;
  for (const animal of json.fauna) {
    if (Array.isArray(animal.track) && animal.track.length) continue; // already reconstructed
    try {
      const times = sampleTimes(animal.fromMa, animal.toMa);
      const track = [];
      for (const t of times) {
        const [lon, lat] = await reconstruct(animal.lon, animal.lat, t);
        track.push({ ma: t, lon: Math.round(lon * 100) / 100, lat: Math.round(lat * 100) / 100 });
        await sleep(120);
      }
      animal.track = track;
      done++;
      console.log(`${animal.name}: ${track.map((p) => `${p.ma}Ma(${p.lon},${p.lat})`).join(' ')}`);
    } catch (err) {
      console.log(`SKIP ${animal.name}: ${err.message}`);
    }
  }
  await writeFile(FILE, JSON.stringify(json, null, 2) + '\n');
  console.log(`\nDone: reconstructed ${done} new animal(s) (${json.fauna.length} total).`);
}

main();
