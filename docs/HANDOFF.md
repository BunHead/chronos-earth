# Chronos Earth — handover to the next Number One

**Written 2026-09-20, updated 2026-09-22 after the first nightly runs.** Working tree clean, everything pushed,
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

| | 11 Sept | 20 Sept | 22 Sept | **now (25th)** |
|---|---|---|---|---|
| events | 3,768 | 13,474 | 22,576 | **51,577** |
| battle | 1,143 | 2,895 | 2,895 | **2,900** |
| person | 237 | 5,740 | 14,842 | **17,068** |
| city | 1,031 | 1,686 | 1,686 | **21,204** |
| monument | 717 | 1,343 | 1,343 | **8,593** |
| disaster | 530 | 1,114 | 1,114 | **1,115** |
| discovery | 37 | 584 | 584 | **585** |
| invention | 28 | 67 | 67 | **67** |
| tests | 392 | 402 | 402 | **503** |

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

### 1. The headline tier is bounded by the WIRE BUDGET (and I got this wrong once)
`public/data/core-index/headline.json` is what loads before any map cell, so
from a cold start **it is the only thing search can find.** The cap has now
moved three times (600 → 1000 → 2500 → 4500) for the same reason: a fixed cap
against a growing dataset is a silent tightening. On the 20th, when the data
tripled, the cut-off rose 69 → 75 and dropped Çatalhöyük, Thebes, Cyrene and
Leptis Magna out of reach.

It happened AGAIN overnight on the 21st and the cap moved a third time,
2,500 → 4,500: the people harvest landed 9,102 figures, the cut-off sprang
back 33 → 77, and 878 rows that were findable the day before were not (the
1556 Shaanxi earthquake, Joseph I, Georg Simmel, Surtsey). 4,500 recovers all
878 at a cut-off of 58.

**THE RULE I WROTE HERE ON THE 20TH WAS WRONG.** It said the cap "is a
FRACTION of the dataset — keep it near a third". A third of 22,576 is 7,500
rows, or 183 KB gzipped, well past what belongs on the critical path. The
fraction only looked right while the dataset was small.

The honest rule: **the cap is bounded by the WIRE BUDGET, not by a fraction.**
About 120 KB gzipped (what `headlineTier.test.ts` guards, measuring the
gzipped size because that is what the visitor pays for), which at ~25 gzipped
bytes a row is roughly 4,800 rows. **We are near that ceiling now — 103 KB.**

**So do NOT raise it a fourth time**; that just chooses which famous thing goes
missing. One tier is doing two jobs: drawing the globe before cells stream
(full rows, but never more than 130 markers drawn) and being the only thing
search can reach (every row, but only name/id/year/coords). Split them and
load the search index LAZILY after first paint — off the critical path, where
its size stops mattering and everything becomes findable. That is the next
real piece of work here, and it is the Captain's call.

### 1b. Search is now SPLIT from the headline tier — the cap-chasing is over
`core-index/search.json` carries EVERY row (23,077 at the last harvest), lean
— id/name/year/lat/lon/category only — at 367 KB gzipped, and it is **not on
the critical path**: SearchBox fetches it when the box is first focused, so
anyone who never searches never pays. Results from memory appear instantly and
the index widens them.

So the headline cap is no longer a rationing decision and **should not need
raising again**. It is now only "what draws before cells stream".

`scripts/build-core-index.mjs` writes it, so the nightly workflow keeps it in
step automatically — verified: the 22 Sept harvest rebuilt it to 23,077 without
anyone touching it. If you ever hand-edit events.json, rebuild.

### 1c. The video layer
`public/data/videos.json` + `scripts/add-videos.mjs`. A video is a pin with a
place, a date, a placeNote and `covers` — the ids of globe events it talks
about, which the panel turns into clickable rows.

**Zero running cost, and this is the constraint that shaped it.** The YouTube
Data API needs a key. **oEmbed does not** — `youtube.com/oembed` is public and
keyless and returns title, channel, channel URL and thumbnail. The script calls
it at AUTHORING time; the running site never talks to YouTube. The channel RSS
feed (`youtube.com/feeds/videos.xml?channel_id=UC…`) is also keyless and gives
the latest 15 videos — that is the route to bulk, and it is untaken.

Two traps, both already paid for:
- `covers` must resolve through the SEARCH INDEX, not loaded events. The first
  version checked memory only; both events the Picts film covers are below the
  headline cut-off, so it rendered nothing and said nothing.
- `covers` ids are hand-typed. Checked in add-videos.mjs (exits 1) and in
  videos.test.ts.

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

## The site at 13,473 events — verified, don't re-measure

The dataset more than tripled today, so this was checked rather than assumed.
All at **4× CPU throttle**:

| | |
|---|---|
| search latency | **19-65 ms** ("battle" 65, "Spartacus" 19) |
| panel open | **277 ms** to open; the prose arrives later from Wikipedia |
| tile streaming (zoomed to Europe) | 82 requests, 643 KB, slowest **73 ms** |
| cold load | **unchanged** — see below |
| visible markers | capped by tier, balanced by category |

**The architecture absorbs growth by design, in three places, and all three
were confirmed working:**

1. **Cold load doesn't grow.** The app fetches `core-index/headline.json`
   (capped) and **never** the monolithic `core-index.json`.
2. **Tiles stream per cell + era bucket**, and only once you zoom — at global
   view the effect no-ops because `viewRegion` is null, which is why a
   playback test shows zero tile requests. That is correct, not a fault.
3. **Visible markers are capped per zoom tier** — `EVENT_MAX_VISIBLE_BY_TIER`
   `[34, 52, 80, 130]` after a per-category `[10, 16, 25, 42]`. The
   per-category pass runs FIRST, which is what stops 5,740 people crowding out
   the battles. Measured mixes:
   - Europe 1000 CE: 30 monument, 11 city, 10 person
   - Europe 1800 CE: 46 monument, 42 person, 26 discovery, 9 battle, 8 invention
   - Middle East 526 CE: 13 person, 11 monument

**Harness note:** search results are wired to `onMouseDown`, not `onClick` (so
blur can't close the list first). A synthetic `.click()` does nothing and looks
exactly like a broken panel. Dispatch `new MouseEvent('mousedown')`.

### Two runtime calls to outside services — pre-existing, worth a decision
Not introduced today, and not fixed, because they are the Captain's call:

- **`query.wikidata.org`** — `fetchNearbyHistory()` in `src/lib/liveFetch.ts`
  fires a live SPARQL query when you zoom into a region. Free and keyless, so
  it clears the zero-cost rule, but it is a runtime dependency that **429s when
  rate-limited** (seen repeatedly today). Worth asking whether it still earns
  its keep now the shipped dataset is 13,474 events rather than 3,768.
- **`elevation3d.arcgis.com`** — Cesium terrain, fetched at runtime. Also free,
  also external. Worth a conscious decision against "self-host every asset".

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

## CLOSED: capitals looked sparse in the Americas (Captain, 23 Sept)

Fixed and shipped the same day — `779be5e` and `408677b`. Three faults, all
silent, none of them the one I first suspected.

**1. The scan was reading 40% of the evidence.** `fetch-capitals.mjs` pass 1
pulled every P1376 statement on Wikidata under `LIMIT 40000`. There are
**99,475**. A query that returns exactly LIMIT rows has been cut off, not
finished — the rule was already written down and I still walked into it. A city
whose only capital statement sat in the unseen 60% simply was not a capital as
far as this globe was concerned. Pass 1 now supplies our own Q-ids in a VALUES
block, which cannot truncate. **WDQS calls are POST now**: 1,200 Q-ids is ~14 KB
of URL and GET answers that with HTTP 414. 2,384 -> 2,513 capitals, 157 -> 177
handovers.

**2. Brasília is a `monument`, not a `city`** — and so were all three capital
gates in `Globe.tsx`, which checked `category === 'city'`. City and monument are
one family; the duplicate-pin dedupe already knew that and the capital layer did
not. `isPlaceRow()` in `lib/capitals.ts` now says it in one place. 39 capitals
were hiding in `monument`.

**3. The handover bonus was flat +150 anywhere in the 30-year window**, which at
2026 put Kabul, Astana, Rabat, Katowice, Malabo and Bujumbura above Paris and
London, and pushed Washington DC to **18th of 1,200** — off a globe with ten
city slots. That is what he could not find. It decays to nothing across the
window now and peaks at 90: worth noticing, not worth more than being Paris.

Verified live at his own view, measured not reasoned:
  - 2026 — Washington DC drawn at (580,145) gold, Brasília at (804,619) gold
  - 1800 — Washington DC gold **and pulsing**, his own example working
  - 1869 — Kyoto and Tokyo both gold and pulsing, the handover as one movement

**DONE, and it was bigger than a ranking problem** — see the next section. I
had recommended a per-region notability floor as the cure. It was the right
diagnosis of the arithmetic and the wrong diagnosis of the map: Moscow, Lisbon
and Madrid were not ranked too low, they **were not in the database at all**.

### THE BARE MAP: three data faults and two rendering ones (24 Sept)

The Captain listed what he could not find at 2026 — Moscow, Lisbon, Madrid,
"practically all African capitals", Oz, NZ, Borneo, India, Pakistan, Nepal.
Fixed in `d2fda59` and `3e59166`. **Read this before trusting any harvest count.**

1. **The city query was truncated.** `LIMIT 6000` against 9,638 matches, no
   `ORDER BY`. Nairobi has 238 sitelinks and was missing because it happened to
   fall outside an arbitrary 6,000. Now banded by sitelink and unioned, and it
   logs loudly when a band comes back full. `DISTINCT` added as well — a city
   with five P1249 statements was spending five rows of the budget.
2. **It demanded `P571`.** Wikidata records no inception for most old cities.
   It records `P1249`, first written mention. Now a fallback, labelled in
   `dateNote` so we never claim a founding date we do not have.
3. **Madrid is not a city.** Its only `P31` is "municipality of Spain", not a
   subclass of Q515. **No class-first query can ever reach it.** `add-capitals.mjs`
   asks what a place DOES (capital of a sovereign state) instead of what it is.
4. **Half the markers were behind the planet.** At orbital tiers nothing scoped
   to a view, so the whole globe competed and roughly half the winners were on
   the far side — picked, counted, occluded. Now culled to the visible cap.
5. **One global sort always fills from Europe.** Places are spread by a minimum
   separation that collapses as you zoom. `lib/markerSpread.ts`.

**RESOLVED for 10 of them, including Beijing** (`add-curated-capitals.mjs`).
Dated by hand from the English Wikipedia infobox or lead, each row carrying the
quote in `dateNote`. I wrote a scraper first and threw it away: it read
"1 January 1921" as the year 1 and "16th century" as the year 16, and could not
parse eleven of nineteen at all. A date parser good enough to trust here is a
bigger and more dangerous thing than a table of ten rows.

**NINE ARE STILL MISSING ON PURPOSE** — Abu Dhabi, Kampala, Bamako, Conakry,
Lomé, Muscat, Yamoussoukro, Nouakchott, Suva. No establishment row in the
infobox, no founding sentence in the lead, nothing to cite. **Do not fill them
in from memory.** A sourced date is the only thing that gets them on.

**PETRA IS SETTLED.** Asked 24 Sept: he chose -300, the Nabataean city, over
q5788's -799. Recorded in `CURATED_DROPS` in `dedupe-places.mjs` so the nightly
harvest cannot re-open it. There are now ZERO unresolved date disagreements.

The original note, for the record:
**19 capitals had no date anywhere, including BEIJING.** Kampala,
Khartoum, Tunis, Bamako, Conakry, Bandar Seri Begawan, Lomé, Niamey, Porto-Novo,
Muscat, Yamoussoukro, Nouakchott, Suva, Sofia, Dhaka, Amman, Podgorica, Abu
Dhabi. Wikidata has no P571, no P1249 and no P580 for them, and **DBpedia has a
founding date for only 1 of 17** — that route is thinner than it looks, which is
worth knowing before anyone invests in it. They cannot go on a TIMELINE without
a year. Dating them from their country's founding would put Beijing at 1949,
which is worse than absent. The honest fix is a curated row each, like
`add-first-cities.mjs` — ask the Captain.

### Two pin defects found while checking the above

Both were stealing slots from the rest of the world, so they belong to the same
complaint. Fixed in `408677b`.

**1,430 pins read "Untitled".** That is Pleiades' own placeholder for a place it
cannot name, and our importer guarded with `!title`, which a real string sails
straight past. No name, no Wikidata id, two sitelinks. They never reached the
wide view but they were in the search index and drew as soon as you zoomed into
the Mediterranean. Rejected at import now, so the sweeps cannot re-add them.

**23 places were pinned twice** — Pompeii, Cyrene, Ostia, Frankfurt, Babylon,
Sparta and more. Each harvester dedupes against what it can see and they see
different things: `fetch-pleiades.mjs` guards spatially (Pleiades calls Rome
"Roma"), the city harvest dedupes by wiki title, which a Pleiades row has not
got. So arrival order decided it. **`scripts/dedupe-places.mjs` is the standing
fix — run it after any harvest**, before `build-core-index.mjs`. It merges only
where the sources agree (same name, same family, 2 km, dates within 200 years),
keeps the better-provenanced row and fills anything it was missing from the
loser, so a capital record cannot be lost in a merge.

**88 date disagreements are now listed, not resolved.** `public/data/date-disagreements.json`.
Çatalhöyük is -10000 and -7499; Petra -799 and -300. Same place, real
scholarly disagreement, and picking one to tidy the map would be inventing
history for the sake of a pin. **This list supersedes the "four curation calls"
item below — Petra, Cusco, Benin City and Mesa Verde are four of the 88.**

---

## 26 Sept (evening): audit, wiring map, phones, Pangaea, dinosaurs

Read **docs/AUDIT-2026-09-26.md** first — what was found, fixed, left on purpose, and the three decisions waiting for the Captain (battle maps, 49 same-name pins, emblems). The wiring diagram is docs/relationship-map.html (rebuild: `node scripts/build-relationship-map.mjs`). Routines keep an honest start/finish ledger in Claude-WorkLog/sweep-ledger.md. Phones are detected by device (`isPhone`, `data-phone` on <html>), not width — the Captain's Pixel was in Chrome's Desktop-site mode. Deep-time playback no longer goes blank. 90 prehistoric animals (39 dinosaurs added from the Paleobiology Database).

---

## 26 Sept: dates, playback, search — what changed and what to watch

**BCE YEARS FROM WDQS ARE ASTRONOMICAL — BUT ONLY WHEN PRECISE.** The query
service writes a BCE date recorded to the year, month or day with year 0 = 1
BCE, so Caesar's death (44 BCE) arrives as `-0043`. A date recorded only to
the century or millennium arrives as entered (Jericho, `-9600`). Measured
against Wikidata's own entity data: 444 precise statements a year late, 240
coarse ones right. The value alone cannot tell them apart, so:
- `scripts/lib/wdqs-json.mjs` has ONE parser, `wdqsYear()` (it replaced ten
  copies) — it reads the digits as written — and `wdqsYearAt(iso, precision)`,
  which undoes the shift exactly when the precision is known.
- `fetch-capitals` asks for precision (value nodes) and uses `wdqsYearAt`, so
  capital roles and country lifespans are right at source.
- Everything else is corrected after harvest by `normalize-bce-years.mjs`
  (nightly, before the merge): each harvested BCE row is checked against
  Wikidata's own record and moved only where it is provably the late copy of a
  precise date. 1,152 years moved on 26 Sept. Curated rows (hand-read years —
  Beijing's -1045) are never touched. If you add a NEW harvester, route its
  years through `wdqsYear` and it is covered.
- `src/lib/bceYears.test.ts` pins the famous dates: Caesar 100–44 BCE,
  Gaugamela 331, Confucius 551, Classical Athens 508–322.

**People have death years** (16,974 of 17,091). `fetch-people` required a
date of death and threw it away; it keeps it now, and `add-death-years.mjs`
back-filled (it replaced `enrich-people-death.mjs`, which nothing ran). A
person now leaves the map when they died, and panels show a lifespan.

**Dedupe never merges two different Wikipedia articles.** Sault Ste. Marie,
Michigan and Ontario (4 km apart, twin towns) were one core name; closer dates
would have deleted one. The date-disputes list is now EMPTY — the "88" below is
history.

**Playback, profiled** (`scripts/play-probe.mjs` watches the main thread while
the timeline plays):
- Markers ground-clamp only below 1,200 km. Clamping ray-cast the terrain for
  every billboard AND every label glyph on every marker hand-over — ~1,000 a
  second, the largest single cost. The globe does not depth-test against
  terrain, so a sea-level marker under the Himalaya still draws.
- The horizon test is prepared once per pass; the in-view set is reused while
  the camera is still; smoothed border rings are cached; the disaster list is
  made once. Together roughly 2.5 s of main-thread work saved per 6–10 s of
  playback.
- **An intermittent multi-minute stall remains**, seen twice in headless D3D11.
  Pausing the JS engine during it showed NO script running — it is the driver
  compiling the globe's 69 KB surface shader for a new layer combination
  (TEXTURE_UNITS 25/26: one coarse terrain tile covered by many finer imagery
  tiles). Cesium behaviour, not ours; unconfirmed on the Captain's machine.

**Search**: the place you typed ranks first (Delphi before Philadelphia; one
tier table, `src/lib/searchRank.ts`); arrow keys walk the list; two identical
rows show coordinates; "look it up online" opens a place already on the globe
instead of pinning it twice, and badges an unlisted building a monument.

**Countries**: picking one flies to where it was THAT year (Rome in 500 BCE is
the city, not its 200 BCE sprawl) — the index carries a year's own point where
the latest one would miss. "Unknown", "unclaimed" and "?" are placeholders, not
polities: no title, label or search result. Northern Cyprus, Western Sahara and
Taiwan got neutral dispute notes, each true only from its own year.

**Small**: phone layout (search on its own row below 480 px); a capital lists
what it is capital of NOW first; the Byzantine Empire marker ends in 1453;
curated rows keep their Wikidata id in the core index (Lothal and Tunguska
could be drawn twice).

**Left for the Captain** (judgement calls, not bugs):
- ~~The destroyed Wonders~~ — DONE 26 Sept: they fade when nothing was left (Colossus 654, Artemis 401, Zeus 475, Pharos 1480, Mausoleum 1522); phone pins drawn at 70% below 600 px. Originally: (Temple of Artemis, the Pharos, the Colossus, the
  Statue of Zeus, the Mausoleum) still show in 2026 as "monuments stand
  forever". Fading them would also hide their 3D models in the present.
- Pins on a phone are desktop-sized; Europe is crowded at 390 px.

---

## 22–25 Sept: capitals, borders, names — what changed and what to watch

**Capitals are yellow only for a COUNTRY'S capital.** `scripts/fetch-capitals.mjs`
has four passes: which cities claim to be a capital (P1376) → when, and of
what → is that polity a country (pass 3: a POSITIVE class list, cached in
`scripts/data/polity-class.json` with each polity's own lifespan) → the
country's own word (P36, pass 4). Nightly it asks only about NEW cities;
`--full` re-asks everything (use the one-off `capitals-full.yml` workflow — a
desktop that has queried all day gets throttled); `--only Q1,Q2` re-asks a few.
Traps, each found the hard way on 25 Sept:
- Wikidata files Indian states under "constituent country" and DR Congo
  provinces straight under "country". `NOT_NATIONAL` blocks those classes. If
  Mumbai-style leaks recur, look there first.
- A dead polity with no dissolution date keeps its capital yellow forever.
  `KNOWN_ENDS` (Scythia, Classical Athens, Medieval Egypt) — sourced, per polity.
- Pass 4 skips DEPRECATED P36 statements (Tel Aviv came from one).
- `ROLE_FIXES` holds hand-checked role corrections (Yangon ends 2005, The Hague
  is dropped). Keep it short and cite every line.
- `capitalsCoverage.test.ts` guards both directions: every national capital is
  yellow in 2026, and nothing else is, bar ten reviewed exceptions (Edinburgh,
  Nuuk, Tiraspol, Putrajaya…).

**Borders**: 23 missing sovereign states added from Natural Earth 1:10m (1:50m
put West Jerusalem in Palestine and displaced the Vatican); the Vatican itself
is from OpenStreetMap (ODbL, credited in About). Kosovo and Palestine are drawn
"as Natural Earth does" — the Captain's choice — named "(disputed)", with a
neutral note in the panel (`DISPUTED_NOTES`, `src/lib/panel.ts`). A click just
off a small island still names it (`CLICK_SLOP_PX`, `COASTAL_ALLOWANCE_KM`).

**Search** finds countries first, and by old or other names: "Holland",
"Persia", "Burma", "UK" (`RELATED_NAMES`, `src/lib/countryIndex.ts`).

**Names**: namesake towns take Wikipedia's title — "Athens, Ohio" — via
`scripts/disambiguate-names.mjs` (nightly). 331 groups of genuine ancient
namesakes (two Argoses) are left alone, and **49 same-name pairs within 30 km**
(Amarna, Nevalı Çori, Maykop — mostly Pleiades vs Wikidata) are left for a
human: merging them could move a date.

**Map density**: cities and monuments have their own slot budget below orbit
(`PLACE_PER_CATEGORY_BY_TIER` 24/40/60; max visible 150 of a 180-marker pool).
Over Europe at 2,500 km, ordinary cities went from 2 to 17. **Not yet checked
for smoothness on the Captain's own machine** — headless fps is meaningless
(1.7 whatever you do). Ask him to pan around Europe at mid zoom.

**Harvest**: the city selector dates a city by founding OR first written
mention (+3,665 cities; 51,577 rows). The scheduled run (cron 03:17 UTC)
actually starts around **08:30 UTC** — GitHub delays it; not a fault. Every
workflow checks out `ref: main`: a dispatched run otherwise works on the commit
it was QUEUED at. The harvest commit step restores `scripts/data` before
rebasing — a dirty cache there once cost 847 cities.

**Leftovers for a human:**
- `stash@{0}` "autosweep: pre-existing uncommitted events.json change" — left by
  a sweep, not mine to drop. Look before deleting.
- The sweeps ask for permission on every run because "always allow" saves the
  EXACT command. `allow-sweeps.cjs` (24–25 Sept session scratchpad) merges
  general rules plus guard rails into `.claude/settings.local.json`. **Only the
  Captain can run it** — a session editing its own permissions is rightly
  blocked. Don't work around that.
- Stuck or failed routines should show as failed — the Captain's reminder, and
  the first item of the full code audit that follows.

---

## What I would do next, in order

1. ~~Finish the people harvest~~ **DONE by the nightly run of 21 Sept** — it
   collected all sixteen occupation groups and added 9,102 people in 44
   minutes. And **I was wrong about "politicians" (Q82955)**: I recorded it as
   "too large, 504s every time and needs splitting". It does not. On the
   runner it returned 5,000 rows in 30 seconds and contributed +3,148. It only
   failed for me because I had been hammering WDQS all afternoon and was being
   rate-limited. **Do not split it.** A lesson worth keeping: a query failing
   on this machine after a day's testing says nothing about the runner.
2. **The harvest is now VERIFIED WORKING in production**, not just locally —
   21 Sept, 44 minutes against the old 80, events sweep answering all five
   categories in ~40 s and reporting a genuine +0. Keep reading the LOG and not
   the status: all three fetchers **exit 1 with a banner if every query
   failed**, so a totally dead harvest goes red, but a PARTIAL failure stays
   green by design. Some "traditional" sweeps still 504 most nights; that is
   expected and costs nothing.
3. ~~**88 curation calls only the Captain can make**~~ — resolved: the list is empty as of 26 Sept (Pleiades buckets are not disputes, and two different articles are two places). Originally listed in
   `public/data/date-disagreements.json`. Each is one place with two rows a few
   hundred metres apart that **disagree about the founding date**. Petra, Cusco,
   Benin City and Mesa Verde are four of them. Both rows stand; picking one
   would be inventing a date. Ask him — and consider asking about the worst
   dozen rather than all 88.
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
