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

1. **Search‑driven live fetch — ✅ SHIPPED (ee7b01e, Opus).** The search box's
   "🌐 Look up '<query>' online" row → `liveFetch.fetchByName` (Wikidata
   entity‑search → SPARQL → shared `parseBindings`, date optional w/ ~1700
   fallback for undated country houses) → adds the place (marker via the pool),
   flies + opens the panel, and remembers it in `liveCache` (localStorage) for
   next visit. Fixes the missing castles for good — bundle is a fast core, the
   web fills any gap on demand. Zero cost, 9s timeout.
2. **Skeleton / flesh split — ✅ SHIPPED (cfa61e2, Fable 5).** `scripts/build-core-index.mjs`
   emits a columnar `public/data/core-index.json` (year‑sorted, cell‑stamped)
   + 181 per‑cell `detail/` files; the app loads the skeleton first (63 KB gz
   vs 93 KB), falls back to `events.json`, and hydrates flesh from one cached
   per‑cell fetch on panel open. `eventIndex` detects the pre‑sorted input and
   skips its sort. Chained into `refresh-data` + `npm run build:core`.
3. **Harvest craft‑ready fields.** Fetch Wikidata instance‑of **type** (accurate
   archetype, not name‑guessing) + **dimensions** (height/area) so monuments
   arrive craft‑ready and auto‑fill `monumentFit`. Plus a targeted
   castle/palace/country‑house harvest for the famous bundled set.
4. **Repeat‑visit cache — ✅ SHIPPED (cfa61e2, Fable 5):** `public/sw.js`, a
   hand‑rolled versioned service worker (no deps), cache‑first for `/data/`
   JSON + images, cache name keyed to the build stamp, production‑only.
   **Remaining:** LOD tiles + Web Worker (off‑thread queries) — only near 100k+ rows.

## Format & scaling decisions (2026‑07‑07 review)

Anchor numbers: current events ≈ 175 B/event raw, ~50 B gzipped (Pages gzips JSON
automatically). Skeleton‑only columnar ≈ 60–70 B/event raw → **~1.5–2 MB gz at
100k rows** — an acceptable single load (revises the "few hundred KB" guess above).

- **Skeleton format: columnar JSON** — one array per field instead of one object
  per event. Kills repeated key names (30–50% raw savings), and pre‑sorted arrays
  mean the index build is a slice, not a sort. Human‑inspectable, zero deps.
- **Rejected:** NDJSON (streams but ships same bytes); FlatBuffers/Protobuf/
  Arrow/Parquet (schema/WASM tax, and **GitHub Pages does not gzip binary
  content‑types** — "compact" binary can arrive larger than gzipped JSON);
  sql.js/SQLite‑WASM (1–1.5 MB WASM + per‑query JS↔WASM cost vs many
  queries/sec during playback; `sql.js‑httpvfs` range‑request trick only wins at
  GB scale); quadtree/R‑tree (the ~10° grid is simpler and fast enough).
- **Never chunk by time** — playback sweeps all of time and would fetch‑churn
  mid‑animation. Chunk on SPACE (cells); time stays an in‑memory dimension.
- **Repeat visits: service worker + Cache API** for `/data/*`, keyed by
  `stamp-version.mjs` (e.g. `vite-plugin-pwa`). Instant warm loads + offline.
  IndexedDB stays the flesh cache; IDB for the skeleton only if parse ever hurts.
- **Search:** debounced lowercase substring scan over skeleton names (~2–5 ms at
  100k) — start there; MiniSearch (~7 KB, built in a worker) only if fuzzy wanted.
- **Measured triggers, not dates:** parse+index > 100 ms → move load work to a
  worker; skeleton gz > ~3 MB (~300k rows) → top‑20k famous set always loaded +
  region‑streamed skeleton chunks (reuse `regionChunks.ts`); typed‑array binary
  core → likely never.

## Zero‑cost law

Static hosting (GitHub Pages), free endpoints (Wikidata SPARQL, Wikipedia REST),
all client‑side, IndexedDB cache. **No backend, no database, no paid API — ever.**
Live fetches need a timeout + a Wikipedia‑search fallback (WDQS can 429/504).
