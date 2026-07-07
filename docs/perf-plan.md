# Chronos Earth — Performance Levers 3 & 4 (queued, ready to run)

**Status.** Lever 1 (marker pool) and Lever 2 (throttle) are shipped and live.
Profiling proved the per-scrub data *scan* is cheap (0.025 ms at 2,328 events,
0.4 ms at 50,000) — the stutter was update *frequency*, now fixed. Levers 3 & 4
are therefore **future-proofing for 10,000s+ and instant loads**, not the
current stutter. Execute this top-to-bottom on the Captain's nod.

The golden rule: **do the work once, at harvest; make everything after a lookup.
Every stage costs O(what's on screen), never O(everything imported).**

---

## Lever 3 — Index retrieval (the harvest earns its keep)

Turn the per-scrub full scan into indexed lookups. Highest value, lowest risk
first (3b), then bake the source at harvest (3a).

### 3b. Runtime index (do first — self-contained, no data migration)
- **New `src/lib/eventIndex.ts`** (pure, unit-tested):
  - Build once from `events`: (a) a copy **sorted by `startYear`** + binary-search
    for the `[year-window, year+window]` slice; (b) a `Map<cellKey, TimelineEvent[]>`
    **spatial grid** (cellKey = `floor(lat/CELL)|floor(lon/CELL)`, CELL≈10°).
  - `queryWindow(year, windowYears)` → year slice via binary search.
  - `queryView(viewRect)` → union of the cells the view covers (dateline-aware).
- **`Globe.tsx` visibility effect:** replace `events.filter(...)` with
  `eventIndex.queryWindow(...)` ∩ `queryView(...)`. Keep the per-category cap +
  notability sort on the (small) result. Fall back to the linear filter if the
  index isn't built yet.
- **Tests:** window/bucket correctness; parity — index results == old filter
  results for a set of sample years/views.

### 3a. Pre-bake at harvest (pairs with 3b)
- In the importer / a post-process step: keep `events` **sorted by `startYear`**,
  and stamp each event with its **grid cell** and a pre-computed **`dupOf`** flag
  (which curated battle/site it duplicates) — removing the runtime O(n·m)
  `findTwin` loop in `Globe.tsx`.
- Emit a **tiny global index file** (`id, name, lat, lon, startYear, category,
  notability, cell`) separate from full detail, for search + timeline.

### 3c. Levels of detail (optional, larger)
- Bake per-cell / per-era **top-N by notability** so declutter is a read, and a
  small "world-famous" set always-loaded with the rest streamed by region+zoom
  (same pattern as the world-harvest region cells). Loads only what's near you.

---

## Lever 4 — Off-thread + warm cache (for true 10,000s / instant loads)

### 4a. Web Worker
- `src/workers/eventQuery.worker.ts`: move filter+declutter off the main thread.
  Globe posts `{year, viewRect, tier}`, worker returns visible ids from the index.
  Keep a synchronous fallback so nothing breaks if workers are unavailable.

### 4b. IndexedDB warm cache
- Cache parsed events (and region chunks) in IndexedDB, keyed by the build
  version (`stamp-version.mjs`). On load, read from IDB first; re-fetch + re-parse
  only on a version bump. Instant warm loads, no re-download on every visit.

---

## Order, risk, verification
1. **3b** (runtime index) — biggest retrieval win, no data change. Do first.
2. **3a** (harvest pre-bake) — makes the index authoritative + kills runtime dedup.
3. **4a / 4b** — only once counts approach 10,000s; **measure first**.
- Each step: `tsc` + `vitest` green; live parity check (same markers at 1815 &
  1916 as today, clean console); commit → push → watch deploy, `gh run rerun
  <id> --failed` on the usual transient Pages flake.
