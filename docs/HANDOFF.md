# Chronos Earth — handover to the next Number One

**Written 2026-09-20 (evening).** Working tree clean, everything pushed,
402 tests green, `npx tsc --noEmit` clean, `lint-data` clean.
Live at https://bunhead.github.io/chronos-earth

---

## Who you're working with

Spencer Austin — **the Captain**. He calls you **Number One**. He is a
**non-coder**: plain English, no jargon dumps, and never ask him to do setup you
could do yourself. (The one standing exception is his GitHub token.)

He is generous, funny, and sharper about the product than about the code. When
he says something is wrong, it is wrong.

### Standing rules — these do not bend

- **ZERO running cost.** Free/open data only. No API keys, no CDN calls at
  runtime, self-host every asset and decoder.
- **His GitHub PAT lives ONLY in his browser localStorage.** Never in the site,
  never committed, never pasted into chat. If he offers it, decline.
- **"Prefer no 3D to a wrong one."** Never invent borders. Contested theories
  (Atlantis, Younger Dryas) only ever as flagged hypotheses. This applies to
  DATES and PHASES as much as to geometry.
- **`npx tsc --noEmit` and `npx vitest run` must both be green before you
  commit.** Check the exit code, not grep output.
- **Stage ONLY your own files.** Never `git add -A`.
- **Verify behaviour live before claiming it works.** Measurements and
  screenshots, never reasoning.
- **Checkpoint to** `C:\Users\spenc\Documents\Claude-WorkLog\YYYY-MM-DD.md`.
- **Don't leave work uncommitted overnight** — it starves the scheduled sweeps.
- **Finish every request before moving on.**

### His own list — do NOT do these for him

Demo GIF, outreach (Kottke is next), founding-star tier line, the workshop
gallery backlog, Atlantis map image, the Friday Patreon paste. He cannot post
from HN/Reddit — draft only.

---

## Where things stand

| | 11 Sept | **now** |
|---|---|---|
| events | 3,768 | **13,473** |
| battle | 1,143 | **2,895** |
| person | 237 | **5,740** |
| city | 1,031 | **1,686** |
| monument | 717 | **1,343** |
| disaster | 530 | **1,114** |
| discovery | 37 | **583** |
| invention | 28 | **67** |
| tests | 392 | **402** |

---

## THE BIG ONE: the harvest was dead, not saturated

**Read this before you believe any claim about the data.** The previous
handover recorded "the events sweep is saturated — +1 across the whole world on
17 Sept". It was not saturated. It had stopped working, and so had the people
sweep. From the Actions logs:

```
16 Sept  most regions returned (+0/+1 — genuinely saturated)
17 Sept  about half failed
19 Sept  nearly all failed
20 Sept  ALL of them. Seven regions, 55 minutes, nothing harvested.
```

Every step reported **success**, because both fetch steps end in
`|| [ $? -eq 124 ]`.

**The cause.** `SERVICE wikibase:box` resolves the GEOGRAPHY first — every
coordinate-bearing item on the continent, millions — and only then joins to
"…and is a battle". As Wikidata grew, that crossed WDQS's own 60-second
ceiling. Measured:

```
battle / Europe SW  (box)   aborted at 120,000 ms
battle / N. America (box)   HTTP 504 after 104,202 ms
```

**A longer client timeout cannot fix a server-side 504.** That is the sentence
to remember.

**The fix: ask for the CLASS first.** ~50k battles exist; millions of
coordinates exist in Europe. Start from the small set.

```
battle   GLOBAL class-first   2,893 distinct in 10,844 ms
city     GLOBAL class-first   1,645 distinct in 27,744 ms
disaster GLOBAL class-first   1,401 distinct in 41,421 ms
```

The continent boxes are gone. They existed so a top-120 ranking would not be
all-Europe; these queries return the COMPLETE set above the notability floor,
so balance falls out instead of being engineered. The 655 new cities bear it
out: Beit She'an, Stellenbosch, Kwekwe, Sidi Bennour, Tulcán.

**People needed a different anchor.** Class-first does NOT transfer to people —
there are ten million humans, so `wdt:P31 wd:Q5` is not a small set (still
504). Century-slicing does not work either: `YEAR()` is computed, not indexed.
**Occupation (`wdt:P106`) is indexed and small enough.** Sixteen occupation
groups, one query each, kept separate so one failure cannot take the run down.

---

## Live issues and traps

### 1. The headline tier is a FRACTION, not a number
`public/data/core-index/headline.json` is what loads before any map cell, so
from a cold start **it is the only thing search can find.** The cap has now
moved twice (600 → 1000 → 2500) for the same reason: a fixed cap against a
growing dataset is a silent tightening. When the data doubled today the
cut-off rose 69 → 75 and dropped Çatalhöyük, Thebes, Cyrene and Leptis Magna
out of reach. At 2,500 the cut-off is 33.

**If the dataset doubles again, this doubles.** Keep it near a third.
`src/lib/headlineTier.test.ts` guards the property and measures the GZIPPED
size (64 KB now), because that is what the visitor pays for — the raw figure
overstates it threefold.

### 2. Duplicate pins — fixed, and guarded
Sixteen of the most famous places on the site were pinned twice (Great Pyramid,
Colosseum, Angkor Wat, Machu Picchu, Taj Mahal, Statue of Liberty…). Curated
rows carry **no `wikidataId`**, and every harvester deduped on the Q-id alone,
so nothing the harvest found could ever match a curated row.

All harvesters now also key on **category + English Wikipedia article**.
`src/lib/duplicatePins.test.ts` guards it and was checked against the pre-fix
data: it reports all sixteen before, none after.

**The rule is narrow on purpose** — same article, same category, within 25 km,
within 200 years. A looser rule would have deleted Nagasaki:
- `cur-hiroshima-bomb` and `cur-nagasaki-bomb` share one article, 298 km apart
- `q935` is Isaac Newton the man; `cur-newton-gravity` is the 1687 publication
- `q7341` is the Auschwitz camp; `cur-auschwitz-liberation` is the liberation

### 3. One global event is one pin
The first class-first run brought back 289 per-country COVID articles and 302
of the new disasters were dated 2020. `LOCAL_CHAPTER` in
`fetch-wikidata-events.mjs` excludes them by name. Excluding anything `part of`
a pandemic was tried first and caught only 47 of 289.

### 4. DO NOT REVERT canvasImagery.ts ON AN FPS MEASUREMENT
Measure frames during playback and the OLD PNG-encode path *wins* — ~10-13 fps
against ~6-8. You would be reverting continental drift. Nine seconds into a
deep-time play-through:

```
old (toBlob):        97 land pixels   — a blank blue ocean planet
new (canvas-direct): 52,000 land      — Miocene continents, as intended
```

The encode could not keep up with the playhead, so the epochs never arrived and
the globe ran fast and empty. There is a long comment at the top of the file.

---

## Performance — measured, don't re-derive

- **`toBlob` was 56% of all main-thread work** during playback (production
  build, 6× throttle). Gone: Cesium takes the canvas directly.
- **Real GPU (GTX 1070) + 6× CPU throttle: 27.8 fps**, median 33 ms, one frame
  over 100 ms in 20 s. Playback is fine on anything with hardware WebGL.
- **No GPU at all (SwiftShader): 6-8 fps.** That is the remaining pain.
  Halving the software-tier texture to 1024×512 was tried: **within noise.**
  Texture size is not the lever. The levers left are the resident-layer budget
  (`gpuBudget.ts`, software tier holds 3 epochs) and the number of layers.
- Cold load unchanged by the data doubling: the app fetches
  `core-index/headline.json` (capped), **not** the monolithic `core-index.json`.

### Tools
- **`node scripts/verify-app.mjs`** — foreground headless Chromium. The Browser
  pane lies about rAF, timers and WebGL readback.
  - `--profile <ms>` — real CDP CPU profile, heaviest functions by self time.
    **This is what ablation could never find**: a cost shared by all five
    imagery layers survives every ablation.
  - `--frames <ms>` — frame timing with NO profiler overhead. `--profile`
    answers "what is slow"; this answers "is it smoother". **Run it more than
    once** — the 20 s spread on this machine is larger than most real effects,
    and it has now fooled two sessions.
  - `--gpu` — real D3D11 instead of SwiftShader. Use it before concluding
    anything about frame rate.

---

## What I would do next, in order

1. **Finish the people harvest.** Six of the sixteen occupation groups were not
   reached when I stopped the run. Re-running is additive and idempotent —
   just run `node scripts/fetch-people.mjs`. **"politicians" (Q82955) is too
   large and 504s every time**; it needs splitting into narrower occupations
   (statesperson, diplomat, jurist…) before it will ever answer.
2. **Watch tonight's harvest run and read the LOG, not the status.**
   Everything here is new tonight. `gh run view <id> --log` and check each
   step actually added rows.
3. **Four curation calls only the Captain can make.** Petra, Cusco, Benin City
   and Mesa Verde each have two rows a few hundred metres apart that **disagree
   about the date** by 434 to 1,306 years. Both stand; picking one would be
   inventing a date. Ask him.
4. **Choreography: 42 of 124 battles**, and there are now 2,895 battles. The
   generic template covers everything else.
5. **`event` (45 rows) still has no query.** Note that `public/data/regions/`
   holds ~1,900 more 'event' rows served by a separate streaming layer
   (`regionChunks.ts`) — so the site is not as thin there as the core-index
   count suggests. Check before "fixing" it.

---

## The sweeps

Four scheduled tasks (`C:\Users\spenc\.claude\scheduled-tasks\`):
choreographer (Sun), modeller (Sat), roadmap (Tue/Fri), Patreon (Fri).
Guards are file-scoped per sweep. **The roadmap queue is empty** — every
engineering item is ticked; what remains unchecked is all on the Captain's own
list.

**Modeller queue order:** `ziggurat` → leaning-tower → pharos → london-eye →
liberty → louvre → colossus → stepped-pyramid → buckingham → giza → d-day.
**Eridu is flagged `rework: true`** with the oldest timestamp so the sweep takes
it first. The brief carries the Captain's question — can the sequence hold all
eighteen excavated levels? The answer: the machinery scales, the evidence does
not. Only about six levels have published plans distinct enough to model
without inventing. Say in the commit how deep you went and why you stopped.

**The harvest commit step is now conflict-tolerant.** A push to `public/data`
mid-harvest used to bin the whole night. `scripts/resolve-data-conflicts.mjs`
unions `events.json` by id, rebuilds the derived files, and **refuses anything
outside `public/data`**. Verified against a real bare remote and a genuine
three-way conflict.

---

## Last thing

Two of today's best finds came from distrusting a green tick: the harvest that
"succeeded" every night while doing nothing, and the frame counter that
applauded an empty globe. **A green step is not a working step, and a good
number is not a good outcome.** Read the logs. Look at the pixels.

Good luck, Number One.
