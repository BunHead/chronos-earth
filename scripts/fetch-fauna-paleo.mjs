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

/** One point at one time, or null when the model has no plate under it. */
async function reconstructOnce(lon, lat, timeMa) {
  const url =
    `https://gws.gplates.org/reconstruct/reconstruct_points/?points=${lon},${lat}` +
    `&time=${timeMa}&model=${MODEL}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'ChronosEarth/1.0' } });
    if (res.ok) {
      const json = await res.json();
      const c = json.coordinates?.[0];
      // The service answers 999.99 (older versions: 99.99) for a point it
      // cannot place. This check used to test 99.99 alone, so a failure was
      // stored as a real coordinate (found 6 Oct 2026 on the Burgess Shale).
      if (!c || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return null;
      return c;
    }
    if (attempt < 4) {
      await sleep(800 * 2 ** attempt);
      continue;
    }
    throw new Error(`GWS HTTP ${res.status}`);
  }
}

/**
 * A point at a time. Where the model has no plate under the exact spot — the
 * Burgess Shale lies in folded Rocky Mountain rock that MERDITH2021 leaves out
 * before ~500 Ma — use the NEAREST point that does reconstruct (rings of
 * 0.5° to 2°), so the animal rides the plate it lived on. Null if none does.
 */
async function reconstruct(lon, lat, timeMa) {
  if (timeMa < 0.5) return [lon, lat]; // effectively modern
  const exact = await reconstructOnce(lon, lat, timeMa);
  if (exact) return exact;
  for (const r of [0.5, 1, 1.5, 2]) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const p = await reconstructOnce(+(lon + (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180)).toFixed(3), +(lat + r * Math.sin(a)).toFixed(3), timeMa);
      if (p) return p;
    }
  }
  return null;
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
    // Already reconstructed — unless a stored point is impossible (the old
    // sentinel bug), in which case do it again.
    const bad = (animal.track ?? []).some((p) => Math.abs(p.lon) > 180 || Math.abs(p.lat) > 90);
    if (Array.isArray(animal.track) && animal.track.length && !bad) continue;
    try {
      const times = sampleTimes(animal.fromMa, animal.toMa);
      const track = [];
      for (const t of times) {
        const at = await reconstruct(animal.lon, animal.lat, t);
        if (!at) throw new Error(`no plate within 2° at ${t} Ma`);
        const [lon, lat] = at;
        track.push({ ma: t, lon: Math.round(lon * 100) / 100, lat: Math.round(lat * 100) / 100 });
        await sleep(120);
      }
      animal.track = track;
      done++;
      console.log(`${animal.name}: ${track.map((p) => `${p.ma}Ma(${p.lon},${p.lat})`).join(' ')}`);
    } catch (err) {
      if (bad) delete animal.track;
      console.log(`SKIP ${animal.name}: ${err.message}`);
    }
  }
  await writeFile(FILE, JSON.stringify(json, null, 2) + '\n');
  console.log(`\nDone: reconstructed ${done} new animal(s) (${json.fauna.length} total).`);
}

main();
