# Plan — spatial + temporal tiling (scaling the skeleton)

_Status: **SHIPPED behind a flag, 2026-07-17.** The design below is intact; this
note records what landed and how to switch it on._

## Shipped (behind the `tiles` flag — default OFF / monolithic)

The tiled skeleton is live but dormant by default, so the current load path can't
regress. Turn it on per-load with **`?tiles=1`** in the URL (`?tiles=0` turns it
back off and clears the sticky bit; the choice persists in `localStorage`
`chronos.tiling`). See `src/lib/tilingFlag.ts`.

- **Build side** — `scripts/build-core-index.mjs` still writes the monolithic
  `core-index.json` unchanged, and now ALSO emits `public/data/core-index/`:
  `manifest.json` (which era buckets each 10° cell holds — so the client never
  404-probes), `headline.json` (the 600 most-notable events worldwide, the
  always-loaded LOD tier), and one `<cell>__b<bucket>.json` per (cell, era
  bucket). A bucket is the timeline ERA index (`bucketFor`), mirrored on both
  sides and parity-tested.
- **Runtime** — `src/lib/coreTiles.ts` loads the manifest + headline first (globe
  never flashes empty), then `src/App.tsx` (flag-gated effect) streams the cells
  the view rect covers × the era buckets the timeline window touches, keyed off
  the existing `viewRegion` + `heavyYearsBP`/`zoomIdx`. Merge de-dups by id/qid,
  exactly like the region-chunk loader it sits beside.
- **Search decision** — the plan's sanctioned "route search through the headline
  tier + live lookup" option. With the flag on, `SearchBox` searches whatever is
  in memory (the headline tier + already-streamed cells); anything not found
  locally falls to the existing `onWebSearch` (live Wikidata, already wired). No
  separate global name index was needed. Enabling the flag by default — and, if
  desired, a tiny name-only index for offline search of the long tail — is a
  later, separate decision.
- **Verified 2026-07-17** — flag ON: cold start fetches only `headline.json` (no
  `core-index.json`); panning to Europe streamed the manifest + 61 tiles;
  scrubbing to 1850 CE rendered 66 real markers in-view. Flag OFF: `core-index.json`
  loads as before and zero tiled files are requested. Tests green.

---

_Original design (written 2026-07-15):_

## Why

The globe already does a **skeleton / flesh** split (see `src/lib/data.ts`,
`src/lib/coreIndex.ts`, `src/lib/detail.ts`):

- **Skeleton** — `public/data/core-index.json`, a compact columnar dump of
  *every* event (id, name, lat, lon, year, category, notability, cell). Loaded
  **once, in full, at startup.**
- **Flesh** — `public/data/detail/<cell>.json`, the heavy per-event fields
  (deaths, wikidataId, image…). Already **lazy, fetched per cell** when a panel
  opens. `cell` keys come from `eventIndex.cellKey(lat, lon)`.

So *detail* is already tiled. The bottleneck is the **skeleton**: it is one
monolithic file holding the whole planet's whole timeline. At ~3,440 events
today that's fine; the nightly harvest only ever grows it. At 30–50k events it
becomes a multi-MB blocking download on first paint — most of it for markers
off-screen or outside the current time window.

## The idea

Tile the **skeleton** the way detail is already tiled — by space **and** time —
and load only the tiles the current view needs.

- **Spatial tiles.** Reuse the existing `cellKey(lat, lon)` grid. Emit
  `core-index/<cell>.json` per cell instead of one `core-index.json`. The globe
  already computes a view rectangle (`Globe.tsx` `computeViewRectangle` →
  `viewRect`); fetch only the cells intersecting it, plus a one-cell margin so
  panning is seamless. Cache fetched cells in memory (a `Set`, like
  `detail.ts`'s `hydratedIds`).
- **Temporal buckets.** Within each cell, split rows into coarse era buckets
  (the log-scale `ERAS` boundaries are the natural cut points). The timeline
  knows its window (`yearsBP` + `zoomIdx` → a `TimeWindow`); fetch only buckets
  overlapping it. Scrubbing from the Bronze Age to the Modern era swaps buckets
  instead of re-reading everything.
- **LOD by notability.** The skeleton already carries `notability`. Ship a
  tiny always-loaded "headline" tier (the few hundred most-notable events
  worldwide) so the globe is never empty while cells stream in; load the long
  tail per tile on demand. This mirrors the existing zoom-tier event caps in
  `Globe.tsx`.

## Where the code touches down

- `scripts/build-core-index.mjs` — emit `core-index/<cell>.json` (+ a small
  `core-index/headline.json` for the LOD tier) instead of one file. Keep a
  manifest of which cells exist so the client never 404-probes.
- `src/lib/data.ts` / `coreIndex.ts` — replace the single up-front fetch with a
  cell+bucket loader keyed off `viewRect` and the time window. The columnar
  decode logic is reusable as-is per tile.
- `src/components/Globe.tsx` — it already polls `viewRect` and camera height;
  hang the tile fetches off that existing loop (debounced). No new event source.
- `public/sw.js` — the data cache already covers `data/**` cache-first with the
  build stamp, so tiles get offline caching for free. No SW change needed.

## Watch-outs

- **Cell formula parity.** `cellKeyFor` (build side) must stay identical to
  `cellKey` (runtime) — there's already a parity test in `coreIndex.test.ts`;
  extend it to the bucketed layout.
- **Dedup across tiles.** Live-fetched Wikidata events and the live cache
  (`loadLiveCache`) must not double-count a tiled event — keep the id `Set`.
- **Don't regress cold start.** The headline LOD tier must load first and fast,
  or the globe flashes empty. Measure first-contentful markers before/after.
- **Search.** `SearchBox` currently filters the in-memory `events` array. With
  tiling, most events aren't in memory. Either keep a name-only global index
  (id + name + year + cell, very small) for search, or route search through the
  headline tier + a live Wikidata lookup (already wired as `onWebSearch`).

## Rough size

Medium-to-large. The build-side split and the tile loader are each a day; the
search-index question and cold-start tuning are the risk. Ship behind a flag
(load monolithic OR tiled) so it can be A/B'd against the current path.
