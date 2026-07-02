/**
 * fetch-battle-maps.mjs
 * ---------------------
 * Downloads a historical/tactical map image from Wikimedia Commons for every
 * battle that has an animated battle view, saving them into
 * public/data/battlemaps/ plus a manifest.json with credits. The app overlays
 * these maps in the 2D battle view and drapes them over the 3D battlefield.
 *
 * For each battle we try a curated list of known Commons file names first and
 * fall back to a Commons file search. Re-run after adding battle views:
 *   node scripts/fetch-battle-maps.mjs
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const OUT_DIR = join(DATA, 'battlemaps');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const THUMB_WIDTH = 1400;

/** Known-good Commons file candidates per battle id (tried in order). */
const CANDIDATES = {
  marathon: ['Battle of Marathon Greek Double Envelopment.png'],
  gaugamela: [
    'Battle of Gaugamela, 331 BC - Opening movements.png',
    'Battle gaugamela decisive.png',
    'Battle of Gaugamela (Arbela).png',
  ],
  cannae: [
    'Battle cannae destruction.png',
    'Battle cannae destruction.svg',
    'Battle of Cannae, 216 BC - Initial Roman attack.png',
  ],
  hastings: ['Battle of Hastings, 1066.png', 'Battle of Hastings map.jpg'],
  agincourt: ['AgincourtMap.svg', 'Agincourt map.PNG'],
  austerlitz: [
    'Battle of Austerlitz - Situation at 1800, 1 December 1805.png',
    'Battle of Austerlitz - Situation at 0900, 2 December 1805.png',
  ],
  trafalgar: ['Trafalgar 1200hr.svg', 'Battle of Trafalgar, October 21st 1805.svg'],
  waterloo: ['Battle of Waterloo map.png', 'Waterloo Campaign map-alt3.svg'],
  gettysburg: ['Gettysburg Battle Map Day3.png', 'Gettysburg Battle Map Day1.png'],
  'd-day': ['Map of the D-Day landings.svg', 'Normandy Invasion, June 1944.png'],
};

/** Search queries used if none of the curated candidates exist. */
const SEARCH_QUERY = {
  marathon: 'Battle of Marathon map',
  gaugamela: 'Battle of Gaugamela map',
  cannae: 'Battle of Cannae map',
  hastings: 'Battle of Hastings 1066 map',
  agincourt: 'Battle of Agincourt map',
  austerlitz: 'Battle of Austerlitz map',
  trafalgar: 'Battle of Trafalgar map',
  waterloo: 'Battle of Waterloo 1815 map',
  gettysburg: 'Gettysburg battle map',
  'd-day': 'Normandy invasion 1944 map',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const qs = new URLSearchParams({ format: 'json', ...params });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`API HTTP ${res.status}`);
  }
}

function stripHtml(s) {
  return (s ?? '').replace(/<[^>]*>/g, '').trim();
}

/** Look up a Commons file; returns {thumbUrl, page, license, title} or null. */
async function fileInfo(fileTitle, width = THUMB_WIDTH) {
  const json = await api({
    action: 'query',
    titles: `File:${fileTitle}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: String(width),
  });
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const mime = info.mime ?? '';
  if (!/^image\/(png|jpe?g|svg|gif|webp)/.test(mime) && !mime.includes('svg')) return null;
  const meta = info.extmetadata ?? {};
  return {
    thumbUrl: info.thumburl ?? info.url,
    page: info.descriptionurl,
    license: stripHtml(meta.LicenseShortName?.value) || 'see file page',
    title: fileTitle,
  };
}

/** Find a plausible map via Commons full-text search (namespace 6 = File:). */
async function searchFile(query) {
  const json = await api({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '6',
    srlimit: '10',
  });
  const hits = json.query?.search ?? [];
  for (const hit of hits) {
    const title = hit.title.replace(/^File:/, '');
    if (!/\.(png|jpe?g|svg|gif)$/i.test(title)) continue;
    if (!/map|battle|plan|situation|campaign|invasion/i.test(title)) continue;
    const info = await fileInfo(title);
    if (info) return info;
    await sleep(150);
  }
  return null;
}

async function download(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`image HTTP ${res.status}`);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const { battleViews } = JSON.parse(await readFile(join(DATA, 'battle-views.json'), 'utf-8'));
  const ids = Object.keys(battleViews);
  console.log(`Fetching maps for ${ids.length} battle views...`);

  const maps = {};
  for (const id of ids) {
    process.stdout.write(`${id}: `);
    let info = null;
    for (const candidate of CANDIDATES[id] ?? []) {
      info = await fileInfo(candidate);
      if (info) break;
      await sleep(150);
    }
    if (!info) {
      process.stdout.write('(curated files not found, searching) ');
      info = await searchFile(SEARCH_QUERY[id] ?? `${id} battle map`);
    }
    if (!info) {
      console.log('NO MAP FOUND');
      continue;
    }
    try {
      let buf = await download(info.thumbUrl);
      // Keep the bundle lean: very detailed maps can render to multi-MB PNGs;
      // step the thumbnail width down until the file is a sensible size.
      for (const width of [1000, 700]) {
        if (buf.length <= 2_000_000) break;
        const smaller = await fileInfo(info.title, width);
        if (!smaller) break;
        buf = await download(smaller.thumbUrl);
      }
      const extMatch = info.thumbUrl.match(/\.(png|jpe?g|gif|webp)(?:$|\?)/i);
      const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
      const file = `${id}.${ext}`;
      await writeFile(join(OUT_DIR, file), buf);
      maps[id] = {
        file,
        credit: `"${info.title}" · ${info.license} · Wikimedia Commons`,
        page: info.page,
      };
      console.log(`ok — ${info.title} (${(buf.length / 1024).toFixed(0)} KB, ${info.license})`);
    } catch (err) {
      console.log(`FAILED download: ${err.message}`);
    }
    await sleep(200);
  }

  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ maps }, null, 2));
  console.log(`\nDone: ${Object.keys(maps).length}/${ids.length} maps saved to public/data/battlemaps/`);
}

main();
