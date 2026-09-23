/**
 * fetch-video-feeds.mjs — follow YouTube channels, keylessly.
 *
 * `add-videos.mjs` refreshes videos somebody has already chosen. This one goes
 * looking: it reads the channels listed in videos.json, pulls their latest
 * uploads, and works out which ones the globe can already place.
 *
 * ZERO RUNNING COST, and there is exactly one trick to it. The YouTube Data API
 * needs a key, so it is out. But every channel publishes a plain Atom feed:
 *
 *     https://www.youtube.com/feeds/videos.xml?channel_id=UC…
 *
 * Public, keyless, unauthenticated, and it carries the last 15 uploads with
 * their ids, titles and publication dates. That is the whole dependency.
 * (A channel's UC… id can be read out of its page: fetch the @handle URL and
 * look for "externalId":"UC…".)
 *
 * WHAT IT DOES WITH THEM. A pin needs a place and a reason, and no script
 * should invent either — so each video is sorted by whether those two things
 * can be had honestly:
 *
 *   matched   — the title names something the globe already has, so BOTH are
 *               in hand: the place is the event's own coordinates and the
 *               reason is "this film is about that event". These go straight
 *               on. Titles on this sort of channel carry the subject and the
 *               year: "What They Don't Say About the Battle of Barra (1308)".
 *   unmatched — the globe has no such row, so there is no honest place to put
 *               it. These wait for a human, and they are the interesting pile.
 *
 * THE GATE USED TO CATCH BOTH, AND THAT WAS WRONG. Everything waited for
 * approval, so the layer sat at ONE film while two perfectly placeable ones
 * queued behind it — which is exactly what the Captain found when he switched
 * the Films layer on and saw a single pin. Asking for a decision where there
 * is nothing to decide is not caution, it is a stalled queue.
 *
 * THE UNMATCHED PILE IS THE POINT. Tested against A History of Peoples on
 * 22 Sept: 2 of 15 titles matched. The other 13 were real Scottish battles —
 * Tippermuir, Barra, Fyvie, Glenlivet, Renfrew — that the globe simply does not
 * have, because they sit below the harvest's notability floor. So a followed
 * channel is not just a source of videos; it is an AUDIT of the gaps, and
 * exactly the sort of gap the Captain means when he says the map outside
 * Europe is bare.
 *
 *   node scripts/fetch-video-feeds.mjs
 *   node scripts/fetch-video-feeds.mjs --check   # report, write nothing
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

/** Fold for matching a video title against an event name. */
export const fold = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Strip a channel's house phrasing to leave the subject.
 *
 * Deliberately a small, visible list rather than anything clever: these
 * channels front-load a hook ("What They Never Tell You About the…") and the
 * subject follows. If a new channel uses a different formula, add it here —
 * a title that does not match any of these simply stays whole, and lands in
 * the unmatched pile, which is a safe failure.
 */
export function subjectOf(title) {
  return String(title)
    .replace(/^what they (never tell you|don.?t say|don.?t tell you) about( the)?\s*/i, '')
    .replace(/^who (were|was)( the)?\s*/i, '')
    .replace(/^the story of( the)?\s*/i, '')
    .replace(/\s*[-–—]\s*.*$/, '') // drop a trailing subtitle after a dash
    .replace(/\s*\([^)]*\)\s*$/, '') // drop the trailing "(1308)"
    .replace(/[?!.]+$/, '')
    .trim();
}

/** "(1308)" / "(83 AD)" / "(55 BC)" → a signed year, or null. */
export function yearOf(title) {
  const m = /\((?:c\.?\s*)?(\d{1,4})\s*(AD|BC|BCE|CE)?\)/i.exec(String(title));
  if (!m) return null;
  const y = +m[1];
  return /^b/i.test(m[2] ?? '') ? -y : y;
}

export function parseFeed(xml) {
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
    const get = (tag) => {
      const r = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(m[1]);
      return r ? r[1] : null;
    };
    return { id: get('yt:videoId'), title: get('title'), published: get('published') };
  }).filter((v) => v.id && v.title);
}

/**
 * Does the globe already hold what this video is about?
 * A year in the title must agree within five years — "Battle of Barra (1308)"
 * must not match a different Barra six centuries away.
 */
export function matchEvent(title, byName) {
  const hit = byName.get(fold(subjectOf(title)));
  if (!hit) return null;
  const y = yearOf(title);
  if (y !== null && Math.abs(hit.startYear - y) > 5) return null;
  return hit;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const channels = doc.channels ?? [];
  if (channels.length === 0) {
    console.log('No channels followed yet. Add one to "channels" in videos.json.');
    return;
  }
  const events = JSON.parse(await readFile(EVENTS, 'utf8')).events ?? [];
  const byName = new Map();
  for (const e of events) {
    const k = fold(e.name);
    if (!byName.has(k)) byName.set(k, e);
  }

  const known = new Set((doc.videos ?? []).map((v) => v.id));
  const seenSuggest = new Set((doc.suggested ?? []).map((v) => v.id));
  const suggested = doc.suggested ?? [];

  const videos = doc.videos ?? [];
  let added = 0;
  let reachable = 0;
  let promoted = 0;
  let ok = 0;

  for (const ch of channels) {
    let xml;
    try {
      xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`);
      ok++;
    } catch (err) {
      console.error(`  ${ch.name}: feed failed (${err.message})`);
      continue;
    }
    const entries = parseFeed(xml);
    let fresh = 0;
    for (const v of entries) {
      if (known.has(v.id) || seenSuggest.has(v.id)) continue;
      const hit = matchEvent(v.title, byName);
      suggested.push({
        id: v.id,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        title: v.title,
        author: ch.name,
        published: v.published?.slice(0, 10) ?? null,
        // A match proposes the pin and the cross-reference outright. No match
        // leaves them null: the globe has nothing to hang it on, and guessing a
        // place would be inventing one.
        ...(hit
          ? { covers: [hit.id], lat: hit.lat, lon: hit.lon, year: hit.startYear, matchedTo: hit.name }
          : { covers: [], lat: null, lon: null, year: yearOf(v.title), matchedTo: null }),
      });
      seenSuggest.add(v.id);
      fresh++;
      added++;
      if (hit) reachable++;
    }
    console.log(`  ${ch.name.padEnd(26)} ${entries.length} in feed, ${fresh} new`);
    await sleep(700);
  }

  // PROMOTE whatever needs no decision — and do it BEFORE worrying about
  // whether the feeds answered.
  //
  // A matched suggestion already has the two things a pin requires: the place
  // is the event's own coordinates, the reason is "this film is about that
  // event". There is nothing for a human to decide, and the approval gate used
  // to catch these anyway — so the layer sat at ONE film while two perfectly
  // placeable ones queued behind it, which is what the Captain found when he
  // switched the Films layer on.
  //
  // Doing it before the feed check matters: YouTube served 404 to every channel
  // on 23 Sept, and returning early on that would have kept two videos waiting
  // that had been ready since the day before. A dead feed is a reason to fetch
  // nothing new. It is not a reason to sit on what is already in hand.
  const stillWaiting = [];
  const onGlobe = new Set(videos.map((v) => v.id));
  for (const sug of suggested) {
    if (onGlobe.has(sug.id)) continue;
    if (!sug.matchedTo || sug.lat === null || sug.lon === null) {
      stillWaiting.push(sug);
      continue;
    }
    videos.push({
      id: sug.id,
      url: sug.url,
      title: sug.title,
      author: sug.author,
      lat: sug.lat,
      lon: sug.lon,
      year: sug.year,
      // The same contract every other pin keeps: say why the marker is here.
      placeNote:
        `Pinned at ${sug.matchedTo}, which this film is about — the marker sits ` +
        `where the event does. The link below it goes to the event itself.`,
      covers: sug.covers,
    });
    onGlobe.add(sug.id);
    promoted++;
  }

  console.log(
    `\n${added} new video(s) found${reachable ? `, ${reachable} of them placeable` : ''}.` +
      (promoted > 0 ? `\n${promoted} promoted onto the globe — they needed no decision.` : '') +
      (stillWaiting.length > 0
        ? `\n${stillWaiting.length} still waiting: the globe has no row to hang them on, which makes them a list of GAPS.`
        : ''),
  );

  if (CHECK_ONLY) {
    console.log('(--check: nothing written)');
  } else if (added > 0 || promoted > 0) {
    doc.videos = videos;
    doc.suggested = stillWaiting;
    await writeFile(FILE, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`videos.json: ${videos.length} on the globe, ${stillWaiting.length} waiting for a place.`);
  }

  // Now complain about the feeds, having first saved everything that did not
  // depend on them.
  if (ok === 0 && channels.length > 0) {
    console.error(
      `\n${'!'.repeat(72)}\n` +
        `NO CHANNEL FEED COULD BE READ. All ${channels.length} failed — this is not\n` +
        `"nothing new", it is a fault.\n\n` +
        `On 23 Sept 2026 YouTube served 404 to EVERY channel tried, including ones\n` +
        `with millions of subscribers, from an address that had read the same feeds\n` +
        `the day before. So read a total failure as "we are being refused", not as\n` +
        `"the channel moved" — re-resolving the channel id will not help.\n${'!'.repeat(72)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
