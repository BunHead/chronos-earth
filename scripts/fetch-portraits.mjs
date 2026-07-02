/**
 * fetch-portraits.mjs
 * -------------------
 * Downloads a portrait thumbnail for every commander listed in
 * public/data/battles.json (the `commanders[].wiki` Wikipedia article titles)
 * and saves them into public/data/portraits/, plus a manifest.json mapping
 * each wiki title to its local image file. Bundling the images means the live
 * app never depends on Wikipedia being reachable.
 *
 * Re-run this any time you add battles or commanders:
 *   node scripts/fetch-portraits.mjs
 *
 * Images are the lead images of each Wikipedia article (typically public-
 * domain paintings/photos of historical figures; see each article for the
 * exact licence). The manifest records the source article URL for credit.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const OUT_DIR = join(DATA, 'portraits');
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';

/** "Tōgō Heihachirō" -> "togo-heihachiro" (safe, ascii file name). */
function slugify(title) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch with polite retries — Wikipedia rate-limits bursts with HTTP 429. */
async function politeFetch(url, accept) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

async function fetchSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  return (await politeFetch(url, 'application/json')).json();
}

async function download(url) {
  return Buffer.from(await (await politeFetch(url, '*/*')).arrayBuffer());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const { battles } = JSON.parse(await readFile(join(DATA, 'battles.json'), 'utf-8'));

  // Incremental: keep previous successes so a re-run only fetches what's missing.
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf-8')).portraits ?? {};
  } catch {
    /* first run */
  }

  const titles = new Set();
  for (const b of battles) for (const c of b.commanders ?? []) {
    if (c.noPortrait) continue; // their wiki link isn't a page about them
    if (!manifest[c.wiki]) titles.add(c.wiki);
  }
  console.log(`${titles.size} commanders to fetch (${Object.keys(manifest).length} already done)...`);
  const failures = [];
  const queue = [...titles];
  const CONCURRENCY = 2;

  async function worker() {
    while (queue.length) {
      const title = queue.shift();
      await sleep(120); // stay well under Wikipedia's rate limits
      try {
        const summary = await fetchSummary(title);
        // The summary's default thumbnail (~320px wide) is plenty for the UI.
        // Don't ask the thumbnailer for other sizes — it returns HTTP 400 when
        // the request exceeds the original image's width.
        const src = summary.thumbnail?.source;
        if (!src) throw new Error('no lead image on article');
        const buf = await download(src);
        const extMatch = src.match(/\.(jpe?g|png|gif|webp)(?:$|\?)/i);
        const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
        const file = `${slugify(title)}.${ext}`;
        await writeFile(join(OUT_DIR, file), buf);
        manifest[title] = { file, page: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
        console.log(`ok      ${title}  (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        failures.push(`${title}: ${err.message}`);
        console.log(`MISSING ${title}  (${err.message})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ portraits: manifest }, null, 2));
  console.log(`\nDone: ${Object.keys(manifest).length}/${titles.size} portraits saved to public/data/portraits/`);
  if (failures.length) console.log(`No image (will show initials in the app):\n  ${failures.join('\n  ')}`);
}

main();
