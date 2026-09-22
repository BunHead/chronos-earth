/**
 * add-videos.mjs — refresh the curated video layer's metadata.
 *
 * Adding a video should be one line: paste a URL, a pin and what it covers.
 * This script fills in the rest — title, channel, channel URL, thumbnail —
 * and re-checks them on every run, so a renamed video does not go stale on
 * the globe.
 *
 * ZERO RUNNING COST, and that shaped the whole design. The YouTube Data API
 * needs a key, so it is out. **oEmbed does not**:
 *
 *     https://www.youtube.com/oembed?url=<video url>&format=json
 *
 * It is public, keyless, unauthenticated, and returns exactly the four fields
 * above. That is the whole dependency. Verified working 22 Sept 2026.
 *
 *   node scripts/add-videos.mjs           # refresh every entry
 *   node scripts/add-videos.mjs --check   # report drift, write nothing
 *
 * TO ADD A VIDEO, edit public/data/videos.json and append:
 *
 *   { "url": "https://www.youtube.com/watch?v=XXXX",
 *     "lat": 56.63, "lon": -2.80, "year": 685,
 *     "startSeconds": 2661,               // optional, jumps to that moment
 *     "placeNote": "Why it is pinned here.",
 *     "covers": ["q961243", "q298263"] }  // globe event ids it talks about
 *
 * then run this. `id`, `title`, `author`, `authorUrl` and `thumb` are
 * MACHINE-OWNED — do not hand-edit them, they are overwritten here.
 *
 * `covers` is the cross-reference and it is checked: every id must exist in
 * events.json, or this exits non-zero. A dead link in the panel is worse than
 * no link, and a typo in a Q-id is invisible until somebody clicks it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'videos.json');
const EVENTS = join(__dirname, '..', 'public', 'data', 'imported', 'events.json');
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const CHECK_ONLY = process.argv.includes('--check');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "https://www.youtube.com/watch?v=abc123&t=42s" → "abc123". Also handles
 * youtu.be/abc123 and /embed/abc123, because those get pasted too. */
export function videoIdFrom(url) {
  const m =
    /[?&]v=([A-Za-z0-9_-]{6,})/.exec(url) ??
    /youtu\.be\/([A-Za-z0-9_-]{6,})/.exec(url) ??
    /\/embed\/([A-Za-z0-9_-]{6,})/.exec(url);
  return m ? m[1] : null;
}

/** "&t=2661s" or "&t=44m21s" → 2661. The Captain pastes links mid-video. */
export function startSecondsFrom(url) {
  const m = /[?&#]t=(\d+)h?(?:(\d+)m)?(?:(\d+)s)?/.exec(url) ?? /[?&#]t=(\d+)s?/.exec(url);
  if (!m) return null;
  if (/[?&#]t=\d+$/.test(url) || /[?&#]t=\d+s/.test(url)) return +m[1];
  const h = +(m[1] ?? 0), mi = +(m[2] ?? 0), s = +(m[3] ?? 0);
  return h * 3600 + mi * 60 + s;
}

async function oembed(url) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(endpoint, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const videos = doc.videos ?? [];
  const eventIds = new Set(
    (JSON.parse(await readFile(EVENTS, 'utf8')).events ?? []).map((e) => e.id),
  );

  let changed = 0;
  let broken = 0;

  for (const v of videos) {
    // Cross-reference integrity first — it is the part a human gets wrong.
    for (const id of v.covers ?? []) {
      if (!eventIds.has(id)) {
        console.error(`  ✗ ${v.url}: covers "${id}", which is not an event on the globe`);
        broken++;
      }
    }

    const id = videoIdFrom(v.url);
    if (!id) {
      console.error(`  ✗ ${v.url}: cannot read a video id out of that URL`);
      broken++;
      continue;
    }
    // A timestamp in the pasted URL wins, so "paste the link at the moment you
    // mean" just works; an explicit startSeconds already in the file is kept.
    const t = startSecondsFrom(v.url);
    if (t !== null && v.startSeconds === undefined) v.startSeconds = t;

    let meta;
    try {
      meta = await oembed(`https://www.youtube.com/watch?v=${id}`);
    } catch (err) {
      // Not fatal: keep whatever is on file and say so. A flaky fetch must not
      // empty the layer.
      console.error(`  ! ${id}: ${err.message} — keeping the metadata on file`);
      continue;
    }

    const next = {
      id,
      title: meta.title,
      author: meta.author_name,
      authorUrl: meta.author_url,
      thumb: meta.thumbnail_url,
    };
    const drift = Object.entries(next).filter(([k, val]) => v[k] !== val);
    if (drift.length > 0) {
      changed++;
      for (const [k, val] of drift) {
        console.log(`  ~ ${id} ${k}: ${JSON.stringify(v[k])} -> ${JSON.stringify(val)}`);
        if (!CHECK_ONLY) v[k] = val;
      }
    } else {
      console.log(`  ✓ ${id}  ${meta.title}`);
    }
    await sleep(400); // courtesy gap
  }

  if (broken > 0) {
    console.error(`\n${broken} problem(s) — fix these before committing.`);
    process.exitCode = 1;
    return;
  }
  if (CHECK_ONLY) {
    console.log(`\n${changed} entr${changed === 1 ? 'y has' : 'ies have'} drifted (nothing written).`);
    return;
  }
  if (changed > 0) {
    await writeFile(FILE, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`\nUpdated ${changed} entr${changed === 1 ? 'y' : 'ies'}.`);
  } else {
    console.log(`\n${videos.length} video(s), all current.`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
