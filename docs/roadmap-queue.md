# Chronos Earth — autonomous big-build queue

Worked through by the **chronos-roadmap-sweep** scheduled routine: one unchecked
item per run, top to bottom. The routine ticks the box and pushes when an item is
verified done, so this file is the live progress board. When every box is ticked
the routine no-ops.

**Deliberately excluded** (Captain's call, 2026-07-15): _Audience skins_ and
_"Play all of history"_. Do NOT build these; do not add them here.

Iron laws for every item: ZERO running cost (no services, keys, or CDN calls —
self-host any decoder/asset); keep `npx tsc --noEmit` and `npx vitest run`
green; verify behaviour before committing; one item per run; if the working tree
is dirty at the start, stop and do nothing.

---

- [ ] **1. Draco-compress the model fleet.**
  Shrink the ~50 `.glb` files (500–570 KB each) with Draco geometry compression.
  - Enable Draco in the export path (`src/export-models.ts` / `export-models.html`
    via three's `DRACOExporter`, or post-process the exported `.glb` with
    `gltf-pipeline -d`). Re-export the whole fleet + `-ruin` + `-b<NN>` stages
    (`scripts/export-models.mjs`).
  - Wire the decoder for the viewers: Cesium loads Draco `.glb` natively; the
    three.js workshop viewer (`src/workshop.ts`) and any in-app three loader need
    a `DRACOLoader` pointed at a **self-hosted** decoder in `public/` (NO CDN —
    zero-cost law). Bundle the `draco_decoder.wasm`/`.js` under `public/`.
  - Verify: a sample model (giza, cathedral, opera-house) still renders correctly
    in the workshop viewer, and file sizes dropped materially (log before/after).
  - Done when: fleet re-exported + committed, decoder self-hosted, viewers load
    them, `manifest.json` updated, tests green.

- [ ] **2. WCAG accessibility — stage 2.**
  Builds on stage 1 (skip link, focus rings, reduced-motion, labels — already
  shipped).
  - Landmark sweep: ensure `header`/`main`/`nav`/`aside`/`footer` (or ARIA roles)
    wrap the right regions; one `h1`; sensible heading order.
  - The custom timeline scrubber: give it `role="slider"`, `aria-valuemin`/`max`/
    `now` (in years), `aria-valuetext` (human label e.g. "988 CE"), `tabindex=0`,
    and arrow-key operation (←/→ step, PageUp/Down jump) mirroring the drag.
  - Colour-contrast audit of text/controls against their backgrounds; fix any
    below WCAG AA (4.5:1 normal, 3:1 large). Keep the palette's character.
  - Verify: keyboard-only pass (tab to search, skip link, operate the timeline),
    and an axe-core/Lighthouse a11y check if runnable headlessly.
  - Done when: landmarks + slider ARIA + contrast fixes committed, tests green.

- [ ] **3. Spatial + temporal tiling of the skeleton.** _(behind a flag)_
  Follow `docs/plan-spatial-tiling.md` exactly. Tile the monolithic
  `core-index.json` by cell (+ era bucket), load only what the view rect and time
  window need, with a small always-loaded "headline" LOD tier.
  - MUST ship behind a flag (load monolithic OR tiled), default **monolithic**,
    so the live path can't regress. Extend the `coreIndex.test.ts` cell-parity
    test to the tiled layout. Address the search-index note in the plan (keep a
    tiny name index, or route search through the headline tier + live lookup).
  - Verify: with the flag ON, the globe fills in as you pan/scrub and cold start
    doesn't flash empty; with the flag OFF, behaviour is byte-identical to today.
  - Done when: build-side split + tiled loader land behind the flag, tests green,
    flag documented. (Enabling by default is a later, separate decision.)

- [ ] **4. Border-data fidelity.** _(conservative — never invent borders)_
  The medieval borders read coarse/straight-edged and frames sit centuries apart
  (700 → 1000 → 1200). Improve the READABILITY without fabricating history.
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
