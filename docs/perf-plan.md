# Chronos Earth — Performance Levers 3 & 4

**Status (2026-07-07).**
- Lever 1 (marker pool) — **SHIPPED**.
- Lever 2 (throttle) — **SHIPPED**.
- Lever 3b (runtime index: binary-search time slice + spatial grid) — **SHIPPED**
  (`src/lib/eventIndex.ts`, wired in `Globe.tsx`). Retrieval is now O(log n + slice).
- Lever 3a (harvest pre-bake: stamp cell + dupOf, emit tiny index file) — remaining,
  LOW marginal value (index build is ~1 ms; dedup runs once per load, not per tick).
- Lever 3c (levels of detail / per-cell top-N) — remaining, only for region-streaming
  at very large scale.
- Lever 4 — **HELD** by recommendation (see below).

Profiling proved the per-scrub data *scan* is cheap (0.025 ms at 2,328 events,
0.4 ms at 50,000) — the stutter was update *frequency* (fixed by Lever 2).
Levers 3a/3c/4 are **future-proofing for 10,000s+ and instant loads**, not the
current stutter.

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

## Lever 4 — Off-thread + warm cache (HELD — do only when the trigger below fires)

### 4a. Web Worker — NOT RECOMMENDED yet (premature)
- The filter is already 0.025 ms (indexed + throttled). A worker adds a ~1 ms
  message round-trip and complexity, making marker updates *slower*. Only worth
  it at MILLIONS of events. Skip until then.
- If ever built: `src/workers/eventQuery.worker.ts`; Globe posts `{year, viewRect,
  tier}`, worker returns visible ids from the index; keep a synchronous fallback.

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
