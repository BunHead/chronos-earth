# Chronos Earth — autonomous big-build queue

Worked through by the **chronos-roadmap-sweep** scheduled routine — and by any
Claude session (Opus or Fable) the Captain points here: one unchecked item per
run, top to bottom. Tick the box and push when an item is verified done, so this
file is the live progress board. When every box is ticked the routine no-ops.

**Exclusions lifted** (Captain's call, 2026-07-17): _Audience skins_ and _"Play
all of history"_ are now QUEUED below (items 10 and 12) — this supersedes the
2026-07-15 exclusion. Item 12 carries a live-review note; respect it.

Iron laws for every item: ZERO running cost (no services, keys, or CDN calls —
self-host any decoder/asset); keep `npx tsc --noEmit` and `npx vitest run`
green; verify behaviour before committing; one item per run; if the working tree
is dirty at the start, stop and do nothing.

---

- [x] **1. Draco-compress the model fleet.** _(done 2026-07-15)_
  Landing note: `scripts/export-models.mjs` now runs each exported glb through
  gltf-pipeline's `processGlb` with `dracoOptions` (compressionLevel 7), with a
  safe fallback to the raw glb if compression ever throws. Whole fleet re-exported:
  58 models, ~18 MB → ~11 MB (opera-house 755→171 KB, london-eye 556→165 KB).
  Cesium decodes Draco natively via its bundled decoder — no CDN, zero cost — and
  no viewer wiring was needed (the glbs are Cesium-only; Three.js builds
  procedurally). Verified live: Cesium `Model.fromGltfAsync` parsed the compressed
  glbs (incl. the two largest) without error. gltf-pipeline added as a devDependency.

- [x] **2. WCAG accessibility — stage 2.** _(done 2026-07-15)_
  Landing note: the timeline scrubber is now a real keyboard **slider** — the
  playhead carries `role="slider"` + `aria-valuemin/max/now` + `aria-valuetext`
  (human date like "988 CE, Medieval age"), and arrow keys step, Page keys leap,
  Home/End jump to the deepest past / the present. Landmarks added: `main` on the
  globe, `region`(Timeline), alongside the existing `banner`/`search`. Contrast:
  spot-fixed the faint battle-tally note (0.5→0.72 opacity, 9.5→10.5px). A full
  axe/Lighthouse contrast sweep is left as optional polish (needs the running app).
  Builds on stage 1 (skip link, focus rings, reduced-motion, labels).

- [x] **3. Spatial + temporal tiling of the skeleton.** _(done 2026-07-17, behind a flag)_
  Tiled skeleton shipped behind the `?tiles=1` flag (default monolithic). Build
  emits `core-index/{manifest,headline,<cell>__b<bucket>}.json` (monolithic
  `core-index.json` byte-identical); `coreTiles.ts` + a flag-gated App effect
  stream cells×era-buckets off the existing viewRegion/time-window. Cell-parity +
  bucket-parity + tiled round-trip + selection tests added. Search routes through
  the headline tier + existing onWebSearch. Verified live both flag states.
  Enabling by default is the Captain's call (see his list at the bottom).

- [x] **4. Border-data fidelity.** _(done 2026-07-17 — geometry only, no new frames)_
  Landing note: new pure module `src/lib/ringSmooth.ts` densifies border rings for
  DRAWING ONLY with **centripetal** Catmull-Rom — chosen over Chaikin because the
  queue's rule is "densify, don't relocate": every original vertex survives
  exactly, so no border moves to a new claim and neighbours sharing a vertex
  sequence still produce identical curves (corner-cutting would have opened
  hairline gaps between countries). Two guards make it honest: rings denser than
  2000 pts are skipped (cost), and a segment is only smoothed when the turn at
  BOTH ends is ≤60° — so faceted CURVES (coastlines, rolling frontiers) round out
  while genuinely ruled/geometric borders stay crisp, and Catmull-Rom can't
  overshoot outside the outline. On the 1600 CE frame that smooths 52.6% of long
  segments and leaves 47.4% crisp. `hitTest` is untouched (it reads pristine
  geometry) — verified live: England and Ireland (1668) / United Kingdom (1980) /
  Beaker (−1409) / France + Ottoman Empire (1600) all unchanged. `ownerGrid` also
  keeps pristine geometry so the orange diff is unaffected. 9 unit tests.
  NO new frames were sourced — the intermediate-frame gaps (700→1000→1200) still
  need a cited open dataset; left for the Captain / a future sourced pass.
  - ALLOWED: smooth/re-sample the EXISTING polygon geometry (e.g. Chaikin /
    Catmull-Rom) so outlines read less jagged — a pure geometry operation that
    moves no border to a new claim. Densify vertices, don't relocate them.
  - ALLOWED: add intermediate frames ONLY from a cited free/open historical-GIS
    source (e.g. a public CC dataset); record the source in the frame/manifest.
  - FORBIDDEN: guessing or interpolating boundaries, or authoring contested lines
    freehand. If a frame is missing and no sourced data is on hand, DON'T invent
    it — instead append a note here listing which frames need sourcing, for the
    Captain, and move on.
  - Verify: a smoothed frame renders cleaner at region zoom and the polity
    `hitTest` still returns the same names at sampled points (geometry only).
  - Done when: smoothing pass committed (and any sourced frames added with
    citations), tests green.

- [x] **5. Border raster — GPU package.** _(done 2026-07-17)_
  Landing note: `geoText` is now KEPT permanently (~8 MB of text for all 35
  frames) so an evicted frame re-rasterises without network. Added
  `evictFarFrames()` — an LRU-by-year-distance eviction with an adaptive cap from
  `navigator.deviceMemory` (≥8 GB → 16 layers, ≥4 GB → 10, else 6; unknown → 10),
  never evicting the active floor/ceil/prev span. Added `preRasteriseAhead()`,
  which rasterises the next ±2 frames in the DIRECTION of travel during idle, so
  a steady scrub doesn't even pay the ~200 ms rasterise. New ⋯ → Settings toggle
  **"🗺️ Fast border travel"** (default ON, persisted in `ce_gpu_borders`) drops
  the cap to 4 and disables pre-rasterising for constrained machines.
  Verified live on a 16 GB machine: cap 16, and a FULL 35-frame sweep to the
  deepest past and back again held at exactly 16 resident (not 35 → the ~1 GB
  GPU risk is gone) with **zero network fetches** in either direction; toggling
  the setting OFF dropped to 4 resident and stayed lean while scrubbing.
  _Original spec:_ Goal (the Captain's words): "the fastest experience their
  hardware can honestly hold." Today `src/components/borders.ts` warms every frame's geojson TEXT after
  load (`warmAllFrames`, ~8 MB) but frames rasterise on first visit (~150–250 ms)
  and every rasterised frame keeps a 4096-wide GPU texture (~30 MB) forever —
  all 35 ≈ 1 GB GPU, fine on desktops, fatal on integrated/mobile GPUs.
  - Keep `geoText` PERMANENTLY (remove the `geoText.delete(year)` after parse in
    `ensureFrame`) so an evicted frame can re-rasterise without network.
  - LRU-evict rasterised layers by distance from the current frame: adaptive cap
    from `navigator.deviceMemory` — 8 GB or more → keep ~16 layers; 4 GB → ~10;
    otherwise ~6. Evict = remove the Cesium imagery layer + drop the cache entry
    (geoText remains). Never evict the active floor/ceil/prev frames.
  - PRE-rasterise ahead of travel: when the playhead moves, rasterise ±2 frames
    in the direction of travel during idle (setTimeout chain, one per ~1 s) so a
    steady scrub never even pays the rasterise.
  - SETTINGS TOGGLE (⋯ menu → Settings, beside "Reduce motion"): "GPU border
    cache" on/off, persisted in localStorage. OFF = cap ~4 layers + no
    pre-rasterise, for constrained machines.
  - Verify LIVE: scrub forward AND backward across 10+ frames — zero network
    (after the warm-up), no visible stall, and the borders imagery-layer count
    never exceeds the cap. Toggle both states.
  - Done when: eviction + adaptive cap + ahead-of-travel pre-rasterise + toggle
    land, verified both directions, tests green.

- [x] **6. Continental drift sharpness.** _(done 2026-07-17 — investigation changed the fix)_
  Landing note: the investigation overturned the assumption in this item. The
  drift epochs are NOT bundled snapshot images — they are **vector coastline
  geojson** (`public/data/paleo/coastlines-*.geojson`, 26 epochs) rasterised in
  the browser by `src/components/paleo.ts`. So there was no source resolution to
  out-resolve and nothing to re-fetch from GPlates: the blur was purely the
  canvas it was drawn onto — **2048×1024, half the border layer's 4096×2048**.
  Raised TEX to 4096×2048, so the same vectors rasterise with twice the detail —
  zero download growth, zero new data, no runtime service calls.
  That alone would have quadrupled the epoch textures to ~30 MB each (26 epochs
  ≈ 780 MB of GPU), recreating the very risk item 5 removed — so paleo now shares
  the same budget: extracted `src/lib/gpuBudget.ts` (`adaptiveLayerCap`, 4 unit
  tests), used by BOTH borders and paleo, with `evictFarEpochs()` mirroring the
  border eviction and never dropping the two epochs mid-cross-fade.
  The Settings toggle is now **"🗺️ Fast time travel"** and governs both layers.
  Verified live: the visible epoch texture measures 4096×2048 (was 2048×1024),
  and a full 230 Mya → present → back sweep held exactly 16 of 26 epochs
  resident. `__paleo` added to the dev probes for future diagnosis.
  - Likely fix: re-fetch higher-resolution snapshots from the GPlates Web
    Service at BUILD time (zero-cost law: bundle them, no runtime calls — About
    already credits GPlates) for the marquee epochs; keep total bundle growth
    sane (2048-wide for all epochs; 4096 only if sizes stay reasonable — log
    before/after MB in the commit).
  - Also check the Cesium layer isn't just UPSCALING with linear blur from an
    already-small canvas (magnification filter / texture size) before
    re-fetching anything.
  - Optional extra credit: a crisp vector coastline stroke over the raster at
    region zoom (same idea as the border stroke pass).
  - Verify: side-by-side screenshots (same camera, e.g. 150 Mya South-Atlantic
    rift) before/after, visibly crisper; no regression in drift animation.
  - Done when: sharper epochs committed with sizes logged, tests green.

- [x] **7. Celestial engine 1 — real sun + true seasons.** _(done 2026-07-20, Fable)_
  Landing note: `astronomy-engine` added (tree-shakes to +1.7 KB gz in main).
  New `src/lib/celestial.ts` gates everything: window **−2000 … +3000** (probed
  empirically — wider than the spec's ±1000 BCE guess), real solar declination
  (including the ancient world's larger obliquity: 23.74° at 900 BCE), real
  season instants via `SearchSunLongitude`, and `moonState()` (phase + lit
  fraction) for items 8-9 and the night sky. TRAP FOUND AND DEFUSED: JS Dates
  (and the library's own `Seasons()`) treat years 0–99 as 1900+year — Seasons(1)
  returns 1901! All dates go through a `utcDate()` safe path and seasons are
  searched directly, so the Roman era is correct (unit-tested at year 50 CE).
  `sun.ts` upgrades through its two foundations (`solarDeclination`,
  `solsticesEquinoxes`) with zero API churn, so the SkyDial, its solstice/
  sunrise buttons, and the monument scenes all got the real sky with no UI
  changes; outside the window the old cosine model carries on, per the honesty
  doctrine. 14 new known-value tests (2026 solstice instant 08:25 UTC;
  Stonehenge midsummer sunrise az 49–51°; equator equinox 12 h day; solstice
  drift to Jun 20 by 2500; ancient obliquity) + the 9 existing sun tests pass
  unchanged on the real engine. 249 total green.
  FOR ITEMS 8-9: import from `./celestial` — the window gate and `utcDate()`
  are mandatory for any date you construct; never call the library's `Seasons()`
  directly.
  - Seasonally-true sun for the Weather & Sky dial: sun path/altitude from real
    date + latitude (today's code: `src/lib/sun.ts` + the SkyDial component) —
    low winter arcs, midnight sun at high latitude, correct day length. Keep the
    dial's UX identical; only the physics changes.
  - Workshop solstice/equinox buttons (`src/workshop.ts` celestial dates) use
    real Seasons(year) instants instead of fixed calendar dates.
  - Moon phase for the night sky (bonus): expose moonPhase(date) for the star
    field/night scenes.
  - Unit-test against known values (2026 June solstice instant; Stonehenge
    midsummer sunrise azimuth ~49-50 deg; equator equinox ~12 h day).
  - Done when: library added, celestial gate + SkyDial/workshop wired, known-value
    tests green. NOTE: items 8-9 build on this — land it first.

- [x] **8. Celestial engine 2 — the eclipse finder.** _(done 2026-07-20, Opus)_
  Landing note: `findSolarEclipse(from, lat, lon, dir)` added to `celestial.ts`
  — local search for what's actually visible at the observer, enriched with the
  GLOBAL greatest-eclipse point as the centreline to fly to (null for globally
  partial events, so we never fly to a track that doesn't exist). The library
  searches forward only, so backward walks from 12 years earlier and keeps the
  last hit before the target (~50 ms, measured). UI: an **Eclipses** row on the
  Weather & Sky frame (◀ prev / next ▶) showing kind, date, % covered, and
  "below the horizon here" when it isn't actually visible; clicking jumps the
  timeline to the year, sets the dial to the local solar hour of greatest
  eclipse, and flies to the centreline.
  HONESTY: pre-1500 hits carry the ΔT warning ("the date is sound; the ground it
  crossed is an estimate"), and outside the celestial window it refuses outright
  rather than guessing — both verified live.
  TWO BUGS FOUND BY LIVE TESTING, both fixed: (1) searching from noon on the
  timeline's day re-found an eclipse that peaked that afternoon, so prev/next
  stuck on the same event; (2) stepping only an hour clear still landed inside
  the eclipse's own partial phases — it takes TWO DAYS to clear an event, which
  can never skip a neighbour since one place waits months between eclipses.
  Verified live at Casper, Wyoming: forward walk 2017 Total 100% → 2023 Partial
  73% → 2024 Partial 55% → 2028 Partial 4% (below horizon), and the backward
  walk retraces it exactly. Unit tests pin the 2017 American and 1919 Eddington
  eclipses, the backward search, a round-trip, and the honesty rules. 256 green.
  - UI: an "Eclipses" row on the Weather & Sky frame — prev/next buttons showing
    kind (partial/annular/total), date, local magnitude; clicking jumps the
    timeline to the instant and flies to the centreline point.
  - HONESTY LABEL (iron rule, same spirit as the Atlantis flagging): for years
    before ~1500 CE show "path approximate — Earth's slowing rotation (ΔT)
    shifts ancient tracks by hundreds of km". Outside the validity window the
    finder says the sky is beyond reliable computation rather than guessing.
  - Verify: the 2017-08-21 American and 1919-05-29 Eddington eclipses are found
    from nearby dates/places with correct dates; unit-test 2-3 knowns.
  - Done when: finder UI + honesty labels land, knowns verified, tests green.

- [x] **9. Celestial engine 3 — the eclipse ON the globe.** _(done 2026-07-22)_
  Landing note: new pure module `src/lib/eclipseShadow.ts` casts the real cones.
  `shadowAt(date)` takes the Sun and Moon as geocentric equator-of-date vectors,
  runs the axis from the Sun's centre through the Moon's and intersects it with
  the WGS84 **ellipsoid** (stretch z by a/b → the ellipsoid becomes a sphere and
  the near root is an ordinary quadratic; the 21 km polar difference is bigger
  than an umbra, so a sphere would not do). Umbra radius
  `Rm − x(Rs−Rm)/D` — negative means the tip fell short and the eclipse is
  ANNULAR — and penumbra `Rm + x(Rs+Rm)/D`, plus `incidenceCos` so a shadow near
  the limb draws as the long smeared ellipse it really is.
  Verified against NASA's catalogue, all within ~10 km: 2017-08-21 greatest at
  36.92 N 87.58 W (published 36.97/−87.65), 1919 Eddington 4.36 N 16.91 W
  (4.4/−16.7), 2024-04-08 25.14 N 104.47 W (25.3/−104.1), and the 2023-10-14
  ring of fire correctly flagged `annular`.
  TRAP, and the reason the known-value tests exist: the first draft used
  `Equator(…, new Observer(0,0,0))` for the Moon — Observer(0,0,0) is a point
  STANDING ON THE EQUATOR at Greenwich, not the centre of the Earth, and the
  Moon's parallax from there threw the 2017 track 8000 km into the Pacific.
  `GeoVector` + `Rotation_EQJ_EQD` is the honest path.
  RENDERING: `src/components/eclipseShadow.ts` paints two entity ellipses with
  baked radial-gradient textures — NOT the SingleTileImagery repaint the other
  overlays use, because a play-through is hundreds of frames and each would mean
  a `toDataURL` plus a new ImageryLayer; this way a sweep is just a position and
  two radii per frame. `play()` runs the whole ground window (~5 h for 2017,
  found by `eclipseGroundWindow`) in 30 s, driving `viewer.clock` so the
  terminator and the monument night-dimmer march with the shadow. New
  `src/lib/eclipseDim.ts` publishes the live shadow so `globeModels`' colour
  callback dims monuments under it (a non-linear curve — an eclipse stays oddly
  bright until the last few percent). SkyDial gains "▶ watch the shadow cross",
  a live "% covered where you're standing" readout, and the sun becomes a
  CORONA ring with the moon sliding over it.
  BUG FOUND BY LIVE TESTING, fixed: `obscurationAt` measured plain distance from
  the shadow centre against a penumbra radius that, stretched near the limb,
  reached over 20 000 km — so an eclipse over Canada dimmed Stonehenge at
  MIDNIGHT. It now checks the sun is actually above the horizon (angular
  distance to the subsolar point) and caps the stretch, with a 5° roll-off so
  the darkening eases in rather than switching on at the terminator. Regression
  tests pin it. Post-fix numbers match reality: Chicago 61% in the 2014 event
  (real ~60%), New York 68% in 2017 (real ~71%), London 0% in 2017 (correct —
  not visible there).
  VERIFIED BY RENDER on a dev server proved to serve this code (port-ownership
  check per MODELLER-CRAFT): screen luminance at the umbra centre fell
  **120 → 9.1 (92% darker — totality)** and **130 → 60 (54%)** 65 km out in the
  penumbra, with the umbra standing on eastern Wyoming at 42.55 N 104.94 W,
  103 km wide — the real 2017 track. The sweep starts at the computed first
  contact (15:47 UTC) with the shadow in the mid-Pacific, exactly where the
  penumbra first met Earth, and walks its corridor. Ancient case: the Thales
  eclipse (585 BCE = astronomical −584) lands over northern Anatolia at
  40.8 N 36.5 E, 99% at the Halys battlefield, wearing item 8's ΔT label.
  NOTE for whoever verifies next: the Browser pane runs as a HIDDEN tab
  (`document.visibilityState === 'hidden'`), so rAF never fires and timers are
  throttled to ~1/s. Drive frames with `viewer.dataSourceDisplay.update(t)`
  FOLLOWED BY `viewer.scene.render()` — `scene.render()` alone never builds
  entity geometry, which will convince you a perfectly good overlay is invisible.
  NOT BUILT, deliberately: "the real star field shows" at a site inside
  totality. There IS a real star catalogue (`src/lib/stars.ts`) but it is
  rendered only in the Three.js workshop scenes — the Cesium globe has no star
  field at all, and standing one up is its own piece of work rather than part of
  this item. The sun dimming to a corona and the monuments going dark under the
  umbra both landed; the stars behind them are left for the Captain to call.
  19 tests added (283 total green).
  _Original spec:_ When the timeline sits inside an eclipse's ground-track window
  (item 8's data):
  - Paint the moving umbra/penumbra as a dark soft-edged ellipse sweeping the
    real terrain — same repaint machinery as `src/components/oceanDrain.ts`
    (SingleTileImageryProvider refresh); penumbra gradient wide, umbra core
    near-black.
  - A play-through (like the battle HUD): press play at first contact and the
    shadow crosses the globe on its real path, accelerated to ~30 s.
  - At a site inside totality: the Weather & Sky sun dims to a corona ring, the
    real star field shows, monuments dim via the existing night-dimmer
    (globeModels' colour callback already reacts to enableLighting).
  - Verify LIVE with 2017-08-21 over the US and one ancient (Thales −585,
    wearing its ΔT label): the shadow sweeps the right corridor, a site inside
    the track goes dark.
  - Done when: shadow sweep + play-through + totality-at-site land, verified,
    tests green.

---

## 🚀 LAUNCH QUEUE — distribution before decoration (inserted 2026-07-29, Captain's call)

**Standing order from the Captain, relayed by the cloud session:** the site is
excellent and nobody knows it exists. Both Patreons are live (ChronosEarth: 0
posts, ~0 patrons; IRLid: 15 posts, 1 member) — the bottleneck is TRAFFIC, not
features. Until every L-item below is ticked, **no session may take an
engineering item** (items 10–12 wait). Same iron laws apply: zero running cost,
tests green, verify before committing, one item per run, stop on a dirty tree.

- [x] **L1. Wire the ❤ Support link + ship's manifest.** _(done 2026-07-29)_
  Landing note: the components already existed from the cloud session — the ⋯
  menu's `❤ Support Chronos Earth` link, the About panel's `❤ Support on Patreon`
  button, and the **ship's manifest** (About reads `public/data/supporters.json`
  with a cache-buster, falls back to empty gracefully, and renders the roll with
  a founding star ⭐ on the first 20; the empty state reads "the first berth is
  empty — be the first name aboard"). `supporters.json` is seeded with an empty
  `patrons: []` and a note telling the Captain how to add a name (display names
  only, order = order joined). What was actually WRONG and is the substance of
  this commit: both links pointed at the old `patreon.com/**c**/ChronosEarth`
  form, not the canonical `patreon.com/**cw**/ChronosEarth` the Captain gave.
  Verified both forms resolve to the live page (so nothing was broken), but
  standardised on `/cw/` per the Captain. Verified LIVE from both entry points:
  menu link and About button both now resolve to `/cw/ChronosEarth`, the
  manifest heading renders, and the empty-state message shows. 310 tests green.

- [x] **L2. Rich link previews (OG/social cards).** _(done 2026-07-29)_
  Landing note: full Open Graph + Twitter-card meta added to `index.html`
  (og:type/site_name/title/description/url/image + image:width/height/alt,
  twitter:summary_large_image). The **card** (`public/og-image.jpg`, 1200×630,
  ~115 KB) is a REAL orthographic globe drawn from the app's own Natural Earth
  II imagery (Cesium's bundled TMS tiles, level 2 → 2048×1024 equirectangular,
  orthographically projected with limb-darkening + atmosphere rim), composited
  with the title, tagline and the signature era-gradient timeline bar — not a
  mock. Baked by `scripts/build-og-image.mjs`: a **2D-canvas** render (NOT a
  headless-WebGL screenshot of the live globe — a hidden tab throttles Cesium's
  render loop per the item-9 note, so that would be fragile), captured with
  puppeteer at exactly 1200×630. The tiles are sampled same-origin from the dev
  server so the canvas stays untainted. The script is standalone and NOT in the
  CI build — the committed JPG ships; a puppeteer step must never break a
  deploy. KEY GOTCHA: `og:image`/`og:url` are ABSOLUTE (hard-code the Pages
  origin) because scrapers don't resolve the app's relative `base: './'` paths.
  Verified: `npm run build` → `dist/index.html` carries all the tags and the
  absolute image URL, and `dist/og-image.jpg` resolves. Card viewed and correct
  (Africa/Europe/Atlantic upright and in place). 310 tests green.

- [x] **L3. Ready-to-paste launch posts — CHANNELS THE CAPTAIN CAN USE.**
  _(first pass 2026-07-29; **REWRITTEN 2026-07-30** against the Bridge's
  `WEBSITES/LAUNCH-TARGETS.md`, which did not exist when the first pass shipped)_

  **Why it was rewritten — the first pass was wrong three ways:**
  1. **Tone, and this one mattered most.** Web Curios's contact page explicitly
     says *no AI-generated emails — write in your actual, human voice.* The
     first pass handed the Captain four polished, AI-written email scripts.
     Pasting them would have breached a curator's stated rule and read as
     TheKit™ to exactly the people whose goodwill the launch depends on. The
     curator section is now **notes, not scripts**: the address, why the outlet
     fits, what to lead with, and a bank of true raw material — and an explicit
     instruction that HE writes the two or three sentences. No paste-ready
     curator email survives in the file, deliberately.
  2. **Wrong targets.** The first pass INVENTED "Hacker Newsletter" as an
     HN backdoor and missed **Kottke.org** entirely; 3 of its 5 YouTubers
     (Kings and Generals, Stefan Milo, Miniminuteman) were guesses that the
     Bridge's verified list does not carry. Now matches the real list: Web
     Curios (with the real address `matt@webcurios.co.uk`), Kottke, Dense
     Discovery, Recomendo/Cool Tools; Ollie Bye (flagged best single fit),
     UsefulCharts, History Matters, toldinstone, Atlas Pro.
  3. **Missing the operational spine.** No send order, no tracker. Now ends
     with the Bridge's sequence (Bluesky → Web Curios → Kottke → Product Hunt →
     Dense Discovery → Recomendo → Ollie Bye → teachers) and points every send
     at `WEBSITES/OUTREACH-TRACKER.xlsx`.

  Also added: the **Historical Association** (`history.org.uk`) as the strongest
  teacher route, with the suggestion to offer a "using Chronos Earth in KS2/KS3"
  write-up rather than a bare link — a contribution, not a promotion. Kept from
  the first pass (still good, and these are broadcasts rather than personal mail
  so drafts are legitimate): the 30-second demo-GIF shot list, the 8-post
  Bluesky/X thread, the Product Hunt listing, and the friend-relay HN/Reddit
  note. Each of those now carries a "read it aloud; if it isn't something you'd
  say, change it" instruction.
  Docs-only: no code touched, tsc and vitest unaffected. Sending is the
  Captain's. _Constraint honoured throughout: no primary HN/Reddit posts drafted
  for his own accounts — only the friend-relay path._
  _Original spec follows:_ Write `docs/launch/launch-posts.md` for channels open to him:
  (a) a **Bluesky/X thread** (6–8 posts, each pairing one money-shot with one
  line); (b) a **Product Hunt** listing draft (tagline, description, first
  comment); (c) short pitch **emails to newsletter curators** — Hacker
  Newsletter, Web Curios, Dense Discovery, Recomendo — two sentences + link,
  personalised per outlet; (d) the **education angle**: posts for
  history-teacher communities (TES forum, teacher Facebook groups,
  homeschool groups) pitching it as a free classroom tool; (e) outreach notes
  to 5 named **history YouTubers/streamers** whose audience fits; (f) a short
  "would you share this?" note a FRIEND could post to HN/Reddit on his behalf —
  honest, first-person-friend voice, no astroturfing.
  Plus the 30-second screen-capture SHOT LIST for a demo GIF (Pangea → today
  scrub, ocean-drain land-bridges, Stonehenge rising, eclipse shadow sweep) —
  the same GIF serves every channel. One channel per day, UK evening. Done when
  the file lands; sending is the Captain's (see his list).

- [x] **L4. First Patreon post + page sync.** _(done 2026-07-29)_
  Landing note: the "0 posts" premise is already resolved — the Captain
  published the maiden post ("The maiden voyage of the support ship 🚢", the
  launch-kit's exact first post) on launch day, confirmed live on the page. So
  rather than draft a duplicate first post, `docs/patreon/next-post.md` now
  holds (1) a status note that the maiden post is up, (2) the genuine **second**
  post — a public launch-week feature spotlight on the eclipse-shadow sweep,
  honest (claims no patron numbers, since there are none to inflate), with a
  softer "drain the oceans" alternate, and (3) the **page-sync checklist**. The
  live tier prices could not be read automatically (Patreon renders them in JS —
  a scraper sees an empty page), so the checklist is a compare-against-the-kit
  list with the suspected drifts flagged: the £3-vs-£3.50 entry-tier price, the
  "dispatches as they land" cadence wording, the founding-star line (now backed
  by the app's real manifest from L1), the welcome note and About. The file is
  headed with a note that the Friday `patreon-dispatch-draft` routine overwrites
  it, so the post should be pasted before Friday; the routine then resumes its
  normal cadence. Docs-only; tsc/vitest unaffected.

- [x] **L5. "Share this moment" deep links.** _(done 2026-07-29)_
  Landing note: the URL-param machinery already existed (`src/lib/sceneState.ts`
  + a `🔗 Share This Moment` menu item + `shareScene()` copying a
  `buildSceneUrl`), but it only carried WHEN (`time`/`zoom`/`layers`) — a shared
  link reopened at the right year but back in orbit. Added the missing half:
  WHERE. New `CameraState` + a compact `cam=lon,lat,height,heading,pitch` param
  (trimmed to ~1 m / 0.1°), rejected outright if corrupt or out of range rather
  than flying to nowhere. `Globe` gained `getCamera()` on its handle (reads
  `camera.positionCartographic` + heading/pitch) and an `initialCamera` prop
  that `setView`s straight to the saved view on load — instant, no swoop, since
  the year and layers are being restored in the same beat. `shareScene()` now
  includes the live camera; `App` passes `initialScene.camera` to the globe.
  Verified LIVE end-to-end: parked the camera over Stonehenge, clicked Share —
  the copied URL carried time+zoom+layers+a 5-field cam matching the view; then
  opened such a link cold and the camera restored to all five values exactly
  (lon/lat/height/heading/pitch). 6 sceneState tests (round-trip, corrupt-cam
  rejection, no-cam default), 312 total green.

---

- [ ] **10. Audience skins (exclusion lifted 2026-07-17).**
  Three reading modes — Explorer (default, current voice), Scholar (denser:
  dates/sources up front, no emoji), Casual/Kid (shorter sentences, friendlier
  words, bigger type) — as a ⋯ menu → Settings choice, persisted in
  localStorage.
  - Implement as a copy-transform layer where panels render (`src/lib/panel.ts`
    builders + a small tone helper), NOT three copies of the data. Kid mode may
    also bump font-size via a root class.
  - Verify: switch modes live on a monument + battle panel; persists on reload.
  - Done when: three modes + persistence land, tests green.

- [ ] **11. Site detail bake — vertical slice (the Maker's Circle engine).**
  Follow `docs/plan-site-detail-bake.md`. Build ONLY the vertical slice:
  - `role` on site-plan parts (infer from the Captain's part names — "wall" →
    curtain-wall etc., overridable in the builder UI), and
  - the curtain-wall role's bake: buildSiteFromPlan(spec) emitting crenellated
    parapets + a wall-walk within the traced footprint (reuse the castle
    archetype's battlement helpers in `src/components/Monument3D.tsx`), exported
    as one Draco glb via the export harness, stood on the globe REPLACING the
    plain corridor for that site.
  - Modeller-craft rules apply: verify-by-render from 3+ angles; NEVER move or
    resize a traced part — ornament only.
  - Verify: the Captain's Tower of London plan (siteplan: key in
    model-review.json) bakes with battlemented walls exactly on his traced lines.
  - Done when: role field + curtain-wall bake + export + globe swap land for one
    site, renders verified, tests green.

- [ ] **12. "Play all of history" — engine behind a flag (LIVE-REVIEW note).**
  One button that plays the whole timeline as a show: monuments rising/ruining,
  borders breathing, battles flaring, day/night rolling — choreographing systems
  that all already exist. Build the ENGINE (a pacing curve over the log
  timeline, layer orchestration, skip-dead-air heuristics) behind a `?show=1`
  flag, default OFF.
  **NOTE: final pacing/choreography wants the Captain's live eye — land the
  flagged engine + a decent default script, then STOP and leave a note here for
  a live session rather than polishing blind.**
  - Done when: flagged engine + default script land, tests green, live-review
    note appended here.

---

## Standing notes for whoever picks this up (Opus: read me)

- House rules live in the repo: `MODELLER-CRAFT.md` (verify-by-render, port
  ownership), the ZERO running-cost law, "prefer no 3D to a wrong one",
  contested theories flagged as hypotheses. Design briefs: `docs/plan-*.md`.
- Weekly routines already running LOCALLY (Claude scheduled tasks, not CI):
  modeller-rework-sweep (Sat), battle-choreographer-sweep (Sun),
  patreon-dispatch-draft (Fri — writes docs/patreon/next-post.md for the
  Captain to paste to Patreon). Nightly GitHub harvest + Pages deploy are CI.
- The Captain saves reviews/site plans from the app straight to main via the
  GitHub contents API — on any model-review.json rebase conflict, take the
  REMOTE file and re-apply only your own change.
- Heavy geometry/verification work suits full sessions; the routine takes one
  item per run. Always leave the tree clean, tests green, and pushed.

## Captain's own 5-minute list (things only he can do)

**Do these in order — each unblocks the fleet or puts the work in front of humans.**
_(Cross-fleet priority — including the income track — lives in `WEBSITES/ORDERS.md`;
this list is ChronosEarth's part of it.)_

- [x] ~~**Commit this queue update.**~~ Done — `e1f5397`.
- [x] ~~**Publish the first Patreon post.**~~ Done 29 Jul — "The maiden voyage
      of the support ship 🚢" is live.
- [ ] **① RECORD THE 30-SECOND DEMO GIF.** Everything else waits on this — it is
      the hero asset for every single channel. Shot list is at the top of
      `docs/launch/launch-posts.md` (Pangea→today, drain the oceans, Stonehenge
      rising, a battle, the eclipse sweep). One take, ~30s, no narration.
      **Press `Win + G`** (Xbox Game Bar, already installed) → record → it saves
      an MP4 to `Videos\Captures`. That's the whole job, ~90 seconds of your
      time. _(This one genuinely can't be delegated: the toolchain has no
      ffmpeg or GIF encoder, and the agent browser canvas is a letterboxed
      1536×519 — wrong shape for social. Tried, hit the wall, reporting it
      rather than shipping poor assets under your name.)_
- [ ] **② THEN one channel per evening, UK ~6–8pm**, logging each send in
      `WEBSITES/OUTREACH-TRACKER.xlsx`. Order (from the Bridge's
      `WEBSITES/LAUNCH-TARGETS.md`): **Bluesky/X thread → Web Curios → Kottke →
      Product Hunt → Dense Discovery → Recomendo → Ollie Bye → teacher tier.**
      This is the highest-leverage 15 minutes a day in the whole queue.
      ⚠️ **Write the curator emails YOURSELF — two or three sentences, your own
      voice, typos welcome.** Web Curios explicitly refuses AI-written mail, and
      the rest can smell it too. `launch-posts.md` deliberately gives you raw
      material and no paste-ready email for those four. Your own platform posts
      (Bluesky, Product Hunt) are drafted and fine to use — just read them aloud
      first and change anything you wouldn't say.
- [ ] **Founding-star line on the Time Traveller tier** (~2 min, the last
      outstanding tier edit): the first 20 aboard wear the star forever. The app
      now really renders it, so the promise is keepable. _(The "dispatches as
      they land" cadence wording was part of the same review — check it stuck.)_
- [ ] Approve the workshop gallery backlog (~35 models awaiting the maker key).
- [ ] Drop the annotated Atlantis water-system map image into the repo (its
      panel slot has been waiting since 2026-07-15).
- [ ] Try `?tiles=1` on the live site; if it feels identical, say the word and
      tiling becomes the default.
- [ ] Paste each Friday's docs/patreon/next-post.md to Patreon (~5 min).
