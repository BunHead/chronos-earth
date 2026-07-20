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

- [ ] **6. Continental drift sharpness ("continents separating looks blurry").**
  The paleo epochs (GPlates snapshots) read soft/blurry mid-drift. INVESTIGATE
  FIRST — find the paleo texture path (grep `paleo` in src/components/, likely a
  SingleTileImageryProvider over bundled snapshot images) and measure the source
  resolution actually shipped.
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

- [ ] **7. Celestial engine 1 — real sun + true seasons (Astronomy Engine).**
  Add the `astronomy-engine` npm package (MIT, ~100 KB, pure JS, NO data files,
  no CDN — passes the zero-cost law). Validity window: use it for roughly
  **1000 BCE → 3000 CE**; OUTSIDE that window keep the current approximate sun
  (precession makes exact dates meaningless anyway). Put the gate in one place,
  e.g. `src/lib/celestial.ts`.
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

- [ ] **8. Celestial engine 2 — the eclipse finder.**
  Using astronomy-engine's SearchGlobalSolarEclipse / SearchLocalSolarEclipse:
  from the CURRENT timeline date and the camera's ground point, find the
  next/previous solar eclipse visible there.
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

- [ ] **9. Celestial engine 3 — the eclipse ON the globe.**
  The showpiece. When the timeline sits inside an eclipse's ground-track window
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

- [ ] Patreon tier edits to mirror the kit: the £3 dev-log line → "dispatches
      as they land" (no cadence promised), and the founding-star line (the
      first 20 aboard wear the star forever).
- [ ] Approve the workshop gallery backlog (~35 models awaiting the maker key).
- [ ] Drop the annotated Atlantis water-system map image into the repo (its
      panel slot has been waiting since 2026-07-15).
- [ ] Try `?tiles=1` on the live site; if it feels identical, say the word and
      tiling becomes the default.
- [ ] Paste each Friday's docs/patreon/next-post.md to Patreon (~5 min).
