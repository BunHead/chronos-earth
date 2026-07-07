# Chronos Earth — Data Architecture

The spec for how data is harvested, stored, retrieved and shown. Sits beside
`docs/perf-plan.md` (which covers the runtime performance levers). Any session
builds from this.

## Two principles

1. **Do the work once, at harvest; make everything after a lookup.**
   Every runtime stage costs **O(what's on screen)**, never O(everything
   imported). (Realised by perf Levers 1–3: marker pool, throttle, index.)
2. **Ship the skeleton eagerly, the flesh lazily.**
   Bundle a tiny always‑loaded **skeleton** for everything; fetch the **flesh**
   (full text, dimensions, images, 3D detail) only when a thing is looked at,
   and cache it. (Fable 5's line — the missing half of principle 1.)

## What the app asks of the data, continuously

- **Temporal** — "which events fall in this time window?" (timeline scrub/play,
  many queries per second).
- **Spatial** — "which events are in this map region?" (globe zoom/pan).
- **Search** — free‑text lookup by name.

## The data model (target)

- **Skeleton** — one small, always‑loaded index: `id, name, lat, lon, startYear,
  [endYear], category, notability, cell`. A few hundred KB even at 100k rows.
  Powers all three query shapes. Pre‑sorted by year + pre‑celled into a spatial
  grid **at harvest** (the `eventIndex` shape from Lever 3, shipped pre‑built
  rather than rebuilt on load).
- **Flesh** — per‑item detail: full text, links, real dimensions + type, image,
  time‑phases, 3D model params. Fetched **on demand** (already: the live
  Wikipedia summary + photo on panel open). Cached in **IndexedDB** so a second
  look is instant.
- **On‑the‑fly gap fill** — search or click for something NOT in the skeleton →
  a **live Wikidata/Wikipedia fetch** → show it there and then, and add it to a
  local cache so the skeleton grows by use. This is the cure for "missing
  castles": the bundle is a fast core, not the whole world.
- **Region tiles** — the base map is already streamed in 20° cells by the world
  harvest; the same LOD/tiling pattern extends to events at very large scale.

## Already built (the machinery exists)

- **Lever 1** marker pool · **Lever 2** throttle · **Lever 3** `src/lib/eventIndex.ts`
  (binary‑search time slice + spatial grid) — runtime retrieval is O(log n + slice).
- **`src/lib/liveFetch.ts`** — on‑the‑fly nearby fetch on empty‑ground click.
- Live Wikipedia summary/photo on panel open (flesh, lazy).
- **`src/lib/monumentFit.ts`** — per‑monument real size + facing (flesh that
  makes each monument sit right; wants real dimensions from the harvest).

## The steps (build order)

1. **Search‑driven live fetch.** Type any place not in the set → live
   Wikidata/Wikipedia → show + cache. Fixes missing castles (Edinburgh, Windsor,
   Chatsworth, Hardwick, Germany's Schlösser) for good. Reuses `liveFetch` +
   the panel's existing live‑summary path.
2. **Skeleton / flesh split.** Emit the skeleton index at harvest (pre‑sorted +
   pre‑celled); lazy‑load detail per item; back it with an IndexedDB cache
   (warm loads instant). Turns Lever 3's in‑memory index into a bundled asset.
3. **Harvest craft‑ready fields.** Fetch Wikidata instance‑of **type** (accurate
   archetype, not name‑guessing) + **dimensions** (height/area) so monuments
   arrive craft‑ready and auto‑fill `monumentFit`. Plus a targeted
   castle/palace/country‑house harvest for the famous bundled set.
4. **LOD tiles + Web Worker.** Level‑of‑detail streaming (famous when zoomed out,
   everything up close) + off‑thread queries. Only needed near 100k+ rows.

## Zero‑cost law

Static hosting (GitHub Pages), free endpoints (Wikidata SPARQL, Wikipedia REST),
all client‑side, IndexedDB cache. **No backend, no database, no paid API — ever.**
Live fetches need a timeout + a Wikipedia‑search fallback (WDQS can 429/504).
