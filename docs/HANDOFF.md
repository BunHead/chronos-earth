# Chronos Earth — handover to the next Number One

**Written 2026-09-20.** Working tree clean, everything pushed, 392 tests green,
`npx tsc --noEmit` clean. Live at https://bunhead.github.io/chronos-earth

---

## Who you're working with

Spencer Austin — **the Captain**. He calls you **Number One**. He is a
**non-coder**: plain English, no jargon dumps, and never ask him to do setup you
could do yourself. (The one standing exception is his GitHub token — see below.)

He is generous, funny, and sharper about the product than about the code. When
he says something is wrong, it is wrong — twice in my run I "explained" a
symptom away and he turned out to be right both times.

### Standing rules — these do not bend

- **ZERO running cost.** Free/open data only. No API keys, no CDN calls at
  runtime, self-host every asset and decoder.
- **His GitHub PAT lives ONLY in his browser localStorage.** Never in the site,
  never committed, never pasted into chat. He offered to show it to me on
  2026-09-20 and the answer is no. You never need it.
- **"Prefer no 3D to a wrong one."** Never invent borders. Contested theories
  (Atlantis, Younger Dryas) only ever as flagged hypotheses. This applies to
  DATES and PHASES as much as to geometry.
- **`npx tsc --noEmit` and `npx vitest run` must both be green before you
  commit.** A pipe is not a gate — check the exit code, not grep output.
- **Stage ONLY your own files.** Other sessions and four scheduled sweeps work
  this repo concurrently. Never `git add -A`.
- **Verify behaviour live before claiming it works.** Screenshots and
  measurements, never reasoning. See "The verification rule" below.
- **Checkpoint to** `C:\Users\spenc\Documents\Claude-WorkLog\YYYY-MM-DD.md`
  (append, never overwrite).
- **Finish every request before moving on.** He had to stop a tool call once and
  I drifted to the next topic without going back. He said: *"in fact always make
  sure that all requests are complete before moving on."* Keep an explicit list
  each turn and close every item.

### His own list — do NOT do these for him

Demo GIF, outreach (Kottke is next), founding-star tier line, the workshop
gallery backlog, Atlantis map image, the Friday Patreon paste. He cannot post
from HN/Reddit accounts — draft only.

---

## The verification rule, and why it exists

**The agent Browser pane lies.** Hidden tabs don't run rAF, throttle timers to
~1/minute, read back WebGL as blank, and freeze camera flights. A whole day was
lost to this before `scripts/verify-app.mjs` existed.

**Use `node scripts/verify-app.mjs`** — a foreground headless Chromium. Flags:
`--base --url --size --wait --click --menu --eval --eval-wait --probe --shot
--globe --hold --film --gpu --cpu --net`. It only serves the ROOT page; for
`workshop.html` use the Browser pane's `javascript_tool` (DOM reads are fine
there, it's only rAF/WebGL that lie).

For 3D models: **`scripts/render-model.mjs <model> <outDir> "<Title>"`**, and
read `MODELLER-CRAFT.md` first. Two hard-won rules:
- **Verify by render, never by code.** You cannot judge 3D from source.
- **Port-ownership check** before trusting any render: `curl -s
  localhost:5173/src/components/Monument3D.tsx | grep -c <yourNewToken>`.
  Use a token from CODE, not a comment — Vite strips comments and you'll get a
  false negative (I did).

---

## Where things stand

| | |
|---|---|
| events | **3,768** — battle 1143 · city 1031 · monument 717 · disaster 530 · **person 237** · event 45 · discovery 37 · invention 28 |
| battles | **124**, of which **42** hand-choreographed |
| 3D models | **43** base archetypes (68 `.glb` with stages/ruins) |
| tests | **392** green |

### Recently landed (my run, 11–20 Sept)

- Africa + Oceania: 20 battles, plus a **lane-classifier bug** where Adwa and
  Omdurman were filed under "Middle East" so Africa read as zero.
- Search now **folds accents** — "Orakau", "Koniggratz", "Alcacer" all failed
  before.
- **The first cities**: Uruk, Eridu, Nippur, Lagash, Harappa, Liangzhu,
  Hierakonpolis, Solnitsata, Maidanetske, Nebelivka, Dhar Tichitt, and the
  Indus four (Dholavira, Lothal, Rakhigarhi, Kalibangan). Curated via
  `scripts/add-first-cities.mjs`, idempotent, wired into the nightly workflow.
- **Angkor Wat** archetype (quincunx of five lotus towers) — it had been
  suppressed in `NO_3D_NAMES` because the keyword cascade made it a Maya
  platform.
- **Eridu ziggurat with a 5-stage through-time sequence**, 5400 BCE → 2050 BCE.
  The mound grows as `frac^2.1`. See `STAGE_TABLE` in `src/lib/stageTable.ts`.
- **Three harvester bugs** (below) and **the headline-tier bug** (below).

---

## Live issues and traps

### 1. The headline tier — the trap that bit hardest
`public/data/core-index/headline.json` is what loads before any map cell
streams in, so **from a cold start it is the only thing SEARCH CAN FIND.** It
used to be a straight top-600 by notability, and that cut-off is a *moving
target* — every harvested name pushes it up. It reached 116 and silently threw
**33 curated rows** out of reach (Eridu, Uruk, Harappa, Gilgamesh, King Arthur,
Beowulf, the Chicxulub impact, the 1918 flu…). Fixed: every `cur-*` row now
rides in the tier regardless of notability, cap raised to 1000.
**`src/lib/headlineTier.test.ts` checks the PROPERTY, not a threshold.** If you
add a new curated source, that test is your safety net — do not weaken it.

### 2. The nightly harvest — three bugs, all fixed, one lesson
- The **workflow job timeout was 75 min** while the two fetch steps inside it
  were capped at 55 + 25 = 80. The commit step was skipped **every night** for
  five days. Budget now 100 min, with the arithmetic written into the file.
- **`fetch-people.mjs` had never saved a single person** since 20 July: its only
  `writeFile` sat after every region, and `timeout` kills the process first.
  Now saves per region. Person count went **37 → 237** the first night it worked.
- **`fetch-wikidata-events.mjs` wrote per CATEGORY, not per continent**, so a
  mid-category hang lost that category's work. Now writes per continent.

**The lesson, and it generalises: a long job that only persists at the end
persists nothing.** Also — *a green step is not a working step.* All three of
these passed their step checks while doing nothing. **Read the run LOGS.**

### 3. Still open on the harvest
- The **commit step is not conflict-tolerant.** If you push to `public/data`
  while a harvest is running, its `git pull --rebase` hits conflicts on
  generated files and the whole night is lost (happened 18 Sept). Worth making
  it resolve additively — the union can only grow.
- **The events sweep is saturated** for its four categories: +1 across the whole
  world on 17 Sept. Growth now needs wider queries or curation.
- **There is NO query anywhere for `invention`, `discovery` or `event`.** Those
  three categories (28/37/45) can only ever grow by hand. Not broken — never
  written. This is the biggest content gap on the site.

### 4. The sweeps
Four scheduled tasks (`C:\Users\spenc\.claude\scheduled-tasks\`):
choreographer (Sun), modeller (Sat), roadmap (Tue/Fri), Patreon (Fri).

The modeller, roadmap and Patreon sweeps had a blanket *"if the tree is dirty,
stop"* rule. **It starved the modeller for a month** — 24 Aug to 20 Sept, zero
output, because the Captain's own WIP is nearly always in the tree, and a
21-second do-nothing run looks identical to a healthy one. The guard is now
**file-scoped** per sweep. **Don't leave WIP uncommitted overnight** — that's
what caused it.

**The roadmap queue is EMPTY** (`docs/roadmap-queue.md`), which is why that
sweep exits clean. Not a fault.

**Modeller queue order:** `ziggurat` → leaning-tower → pharos → london-eye →
liberty → louvre → colossus → stepped-pyramid → buckingham → giza → d-day.

---

## What's in flight

### Eridu is the modeller sweep's next job
Flagged `rework: true` in `public/data/model-review.json` with a `ts` set one
second below the oldest flag **on purpose** (the sweep picks oldest-first). The
brief carries the Captain's question: **can the sequence hold all eighteen
excavated levels?**

The answer to give, and it is already in the brief: **the machinery scales** —
an 18-entry stage table resolves all eighteen suffixes, verified. **The
evidence does not.** Only about six of Eridu's levels (XVI, XI, VIII, VII, VI,
and the Ur III ziggurat) have published plans distinct enough to model without
inventing. Go as deep as the sources support, say in the commit how deep and
why you stopped, and never pad.

### He is mid-way through fixing his GitHub token
His workshop PAT expired (HTTP 401). On 2026-09-20 he generated a new
fine-grained token: repo `BunHead/chronos-earth`, **Contents: Read and write** +
Metadata read-only. The last thing he said was that it worked.
**If he offers to show you the token, decline.** He may need help pasting it
into the workshop → Save key → *Maker's mode on*. Diagnose by the message only:
401 = expired · *"can read but cannot save"* = permissions · *"could not
verify"* = network.

---

## Performance — measured, don't re-derive

Cold load of the live site: **2,470 KB / 50 requests / load at 2.36 s**.
**Cesium is 1,845 KB of that — ~95% of the blocking path.** The Wikipedia
thumbnails (14 requests, 236 KB) all arrive *after* the load event, so they are
already correctly deferred.

Runtime at 6× CPU throttle: idle globe **59 fps**; **during timeline playback
29.5 fps, worst frame 211 ms, 33 stutters >50 ms in 6 s.** That is the
"extremely slow on my parents' laptops" complaint, measured.

**I could not attribute the playback stutter to a layer.** Ablation gave a clean
negative — worst frames of 150–195 ms appear in *every* configuration including
borders-only, and run-to-run variance is large. **It needs a real CPU profile
via CDP, not more ablation.** Don't repeat that experiment.

Agreed priority list, cheapest first:
1. Prune what ships but is never fetched (`dist` is 73 MB; basis_transcoder,
   google-earth-dbroot-parser, much of Cesium's Assets) — ~1 hr, no risk.
2. **WebP the 181 portraits/battle maps** (~24 MB, zero WebP today) — half a
   day. Improves panel-open on slow connections, not cold start.
3. Switch off unused Cesium features (waterNormals 287 KB,
   approximateTerrainHeights 292 KB) — half a day.
4. **Profile the playback frame properly** — 1–2 days. *This is the one that
   fixes his parents' machines.* Highest user value.
5. Service-worker precache of Cesium for repeat visits — 1–2 days.
6. Tree-shake Cesium into a custom build — a week+, high risk, biggest prize.

---

## Content gaps worth filling

- **People, inventions, discoveries.** 237 / 28 / 37 against 1,143 battles.
  The human and ideas layer is the thinnest part of the site.
- **Choreography: 42 of 124 battles.** Everything added recently (Vietnam,
  Korea, Africa, Oceania, the Gulf) runs the generic template.
- Africa and Oceania now have battles but few monuments.

---

## Last thing

He responds best to being told the truth plainly, including when something you
shipped was wrong. Several of the best finds in my run came from him saying
"this doesn't work" and me going to look properly instead of explaining why it
should. Measure it, show him the number, and say what you're going to do.

Good luck, Number One.
