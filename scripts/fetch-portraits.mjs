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
 *   node scripts/fetch-portraits.mjs --limit 5    (a small test run)
 *
 * Re-runs RESUME: anyone who already has a portrait on disk is skipped, and
 * the manifest is saved after every success, so a run cut short by a rate
 * limit keeps what it got. Requests go one at a time with backoff — see
 * scripts/lib/polite-fetch.mjs.
 *
 * Images are the lead images of each Wikipedia article (typically public-
 * domain paintings/photos of historical figures; see each article for the
 * exact licence). The manifest records the source article URL for credit.
 */
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPoliteFetch, limitFromArgs } from './lib/polite-fetch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const OUT_DIR = join(DATA, 'portraits');

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

const politeFetch = createPoliteFetch({ gapMs: 400 });
const exists = (p) => access(p).then(() => true, () => false);

async function fetchSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  return (await politeFetch(url, { headers: { Accept: 'application/json' } })).json();
}

async function download(url) {
  return Buffer.from(await (await politeFetch(url)).arrayBuffer());
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

  // Resume: drop manifest entries whose image went missing, so they refetch.
  for (const [title, entry] of Object.entries(manifest)) {
    if (!(await exists(join(OUT_DIR, entry.file)))) delete manifest[title];
  }
  const save = () => writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ portraits: manifest }, null, 2));

  const titles = new Set();
  for (const b of battles) for (const c of b.commanders ?? []) {
    if (c.noPortrait) continue; // their wiki link isn't a page about them
    if (!manifest[c.wiki]) titles.add(c.wiki);
  }
  const todo = [...titles].slice(0, limitFromArgs());
  console.log(`${titles.size} commanders missing a portrait (${Object.keys(manifest).length} already done); fetching ${todo.length}...`);
  const failures = [];
  let saved = 0;

  // One at a time: politeFetch queues requests and backs off on 429/503.
  for (const title of todo) {
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
      await save(); // keep progress even if a later request fails
      saved++;
      console.log(`ok      ${title}  (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failures.push(`${title}: ${err.message}`);
      console.log(`MISSING ${title}  (${err.message})`);
    }
  }

  await save();
  console.log(`\nDone: ${saved}/${todo.length} new portraits saved (${Object.keys(manifest).length} in total) to public/data/portraits/`);
  if (failures.length) console.log(`No image (will show initials in the app; a re-run will try again):\n  ${failures.join('\n  ')}`);
}

main();
