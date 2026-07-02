# Chronos Earth — Large History Import: execution plan

> Prepared 2026-06-28. This is the game plan for the "big import" session — the
> work that turns the zoomable timeline into the **illustrated wall of time**
> (each significant event a dated, photographed circle on the to-scale detail
> rail; monuments shown as start→end spans; decluttered by zoom). Approved
> reference: a school-corridor history mural. Mockup approved as-is (BCE/CE
> labels, photo-circles alternating above & below the ribbon, span bars).

**Status (2026-06-28):** Foundation built ✅ — steps 1–2 below are done. `TimelineEvent`
type, `loadEvents()`, and `scripts/fetch-wikidata-events.mjs` exist; the fetcher has
been run → **`public/data/imported/events.json` = 936 events** (battles, monuments,
cities, disasters), all dated/located/notable with Wikipedia titles. Not yet rendered.
Remaining: images (step 4), marquee curation (step 3), and the globe + detail-rail
rendering (steps 5–6).

---

## 1. Goal

Zoom the timeline into any period and see that period's real events as captioned
photo-circles at their true positions. Click one → the existing `InfoPanel`
(image + description + Wikipedia link). The era colour-bands stay as the
zoomed-out overview/minimap.

## 2. Data model (proposed `TimelineEvent`)

Add to `src/lib/types.ts` when the session starts:

```ts
export interface TimelineEvent {
  id: string;             // stable slug, or the Wikidata Q-id
  name: string;
  startYear: number;      // signed astronomical year: -216 === 216 BCE
  endYear?: number;       // present ⇒ a SPAN (pyramid build, an era, a war)
  lat: number;
  lon: number;
  category: 'monument' | 'invention' | 'city' | 'battle' | 'disaster' | 'discovery';
  tier: 'curated' | 'imported';
  wikidataId?: string;    // Qxxxxx
  wikiTitle?: string;     // for live REST summary fetch (imported tier)
  image?: string;         // cached thumbnail filename under public/data/events/img/
  summary?: string;       // short factual blurb (curated) — imported tier fetches live
  links?: { label: string; url: string }[];
  notability?: number;    // Wikipedia sitelink count → ranking for declutter
}
```

Spans are just `startYear` + `endYear`. Single moments omit `endYear`.

## 3. Categories & sources

Bulk from **Wikidata SPARQL** (`https://query.wikidata.org/sparql`), images +
summaries from **Wikipedia REST** / **Wikimedia Commons**.

| Category   | Wikidata seed (instance-of / props)                          | Date prop |
|------------|--------------------------------------------------------------|-----------|
| monument   | structures/heritage (e.g. Q839954, UNESCO Q9259)             | P571 inception |
| invention  | invention/technology (Q… ) + notable firsts                  | P575 / P571 |
| city       | cities with P571 inception + P625 coords                     | P571 |
| battle     | Q178561 battle (long tail beyond the 78 curated)             | P585 point in time |
| disaster   | earthquakes Q7944, eruptions Q7692360, pandemics             | P585 |

Every row must have **P625 coordinates** and a **date**. Filter/rank by sitelink
count for notability tiers. Queries are fiddly — expect to iterate them with a
small `LIMIT` first (see step order).

## 4. Two-tier quality

- **Curated (marquee):** hand-pick the showcase events the user named —
  Great Pyramid (build span), Stonehenge (span), Colosseum, Parthenon, Eiffel
  Tower, Wright Flyer 1903, Apollo 11 1969 — with good text + a chosen image.
- **Imported (long tail):** thousands auto-pulled; short factual line + a LIVE
  Wikipedia summary fetched on click (offline-safe fallback note), per the
  original interview decision.

## 5. File layout

```
public/data/imported/events.json        # the bulk TimelineEvent[]
public/data/events.json                 # curated marquee TimelineEvent[]
public/data/events/img/<id>.jpg         # cached thumbnails (curated + top imported)
public/data/events/manifest.json        # {file, credit, license} per image
```

## 6. Pipeline (scripts)

- `scripts/fetch-wikidata-events.mjs` — runs the SPARQL queries per category →
  `public/data/imported/events.json`. **Reuse the proven `politeFetch` pattern**
  from `fetch-portraits.mjs` (concurrency 2, ~120 ms delay, backoff — Wikipedia
  429s bursts hard; do NOT upscale thumbnail width in the URL).
- `scripts/fetch-event-images.mjs` — for curated + top-N imported, pull P18 /
  REST thumbnail → cache + manifest. Same caching discipline.
- Chain both into `npm run refresh-data` (incremental, skip-done), and document
  at the top of the data README.

## 7. Rendering

- **Globe:** new `EventsController` layer + LayersPanel toggle "History events".
  Thousands of points ⇒ Cesium `EntityCluster` (or zoom-based declutter). Time-
  windowed visibility like battles. Click → `InfoPanel`. CAUTION (known build
  lesson): heavy entity/polygon work can crash this Cesium build — keep to point
  billboards / clustering; markers must `CLAMP_TO_GROUND` +
  `disableDepthTestDistance` like the existing site/battle markers.
- **Timeline detail rail (the mural):** when zoomed in, render events in the
  window as **photo-circles** (image thumbnail, ring, date caption) alternating
  above/below the ribbon; `endYear` events draw a **span bar** on the ribbon.
  Position via `bpToWindowPos`. **Declutter by zoom:** show only the top-
  `notability` events that fit without overlap at the current span; reveal more
  as the window narrows. Click a circle → `InfoPanel`.
- Reuse the existing `InfoPanel`; it already shows image + description + links.

## 8. Step order for the session

1. Add `TimelineEvent` to `types.ts` + a couple of schema unit tests.
2. Write `fetch-wikidata-events.mjs`; run with `LIMIT 50` per category, eyeball
   the JSON, fix the SPARQL, then lift the cap.
3. Curate the marquee `events.json` by hand (the named showcase events).
4. `fetch-event-images.mjs`; cache curated + top imported; manifest.
5. Globe events layer (clustered) + LayersPanel toggle + click→panel.
6. Detail-rail photo-circles + span bars + declutter-by-zoom.
7. Tests (schema + a render/data test), `npm run build`, live-verify (zoom into
   ancient & modern slices; spans show; click opens panel; perf OK with N pins).
8. Update About + data README. Checkpoint memory at ~80%, stop.

## 9. Risks / notes

- **Volume/perf:** thousands of globe points — cluster early, test FPS.
- **Rate limits:** Wikipedia/Wikidata throttle hard — keep politeFetch discipline.
- **SPARQL drift:** queries need real-world iteration; cap-then-expand.
- **Declutter is the make-or-break UX** — without it the rail/globe drown in pins.
  The zoom we already built is exactly what makes it tractable.
- Keep the verified Timeline 2.0 behaviour intact (controlled `yearsBP`, tours,
  search, mobile fit).
