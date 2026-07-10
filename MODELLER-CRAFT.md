# The Modeller's Craft Book

Everything Chronos Earth has learnt about building 3D monuments that survive
review. **Read this before touching `buildModel()`.** Agents: follow it to the
letter — every rule here was paid for with a real failure.

## The iron rules

1. **VERIFY BY RENDER, NEVER BY CODE.** You cannot judge 3D from source. Run
   the harness (`RENDER_BASE=http://localhost:<port> ANGLES=3q node
   scripts/render-model.mjs <model> ./out "<Title>"`), READ the PNG, iterate.
   **And verify the PORT serves YOUR code first** — several dev servers can be
   alive at once (main repo + agent worktrees); grep the served module for a
   token you just wrote (`curl -s localhost:<port>/src/components/Monument3D.tsx
   | grep -c <yourNewVariable>`) before trusting a single render. (Atlantis
   was once render-reviewed against a rival server's stale code.)
   A model isn't done until its renders read right from 3q, top and (if
   relevant) ruin. Angles: `3q`, `top` (true north-up plan), `side`. Extra
   env: `RUIN=1`, `LAT=.. LON=..` (real satellite ground + crosshair),
   `BUILD_FRAC=`, `SEA=`.
2. **Scene frame (calibrated, do not re-derive):** real north = world **−Z**,
   real east = **+X**. The code once claimed +Z=north and it caused every
   "90° off" bug in the project's history. Plan renders draw a red north
   arrow + green east bar; geo renders add a red crosshair at the site's true
   lat/lon — the model must sit ON the crosshair, aligned with the real
   footprint under it. Position and orientation are yes/no reads, not
   opinions.
3. **facingDeg** (lib/monumentFit.ts): the model's front is authored at local
   +Z; to face compass bearing B, θ = 180 − B (N→180, E→90, S→0, W→270).
   Facings for marquee sites were READ off calibration renders — never guess
   a facing; render on the real site and read it.
4. **Fit**: `fitFor(title, model)` gives real `widthM`; `computeFit` scales
   the model so it is true-sized on imagery. Effects/sky/water must set
   `userData.noShadow = true` so they never inflate the fit box. Scale MUST
   come from the pristine (intact, complete) build — phase variants reuse it.
5. **Zero cost, zero deps.** Procedural three.js only. No downloaded assets,
   no textures beyond the procedural stone canvas, no new packages.

## Geometry techniques that earned their place

- **Real arches** (the Colosseum bake-off winner): a `THREE.Shape` rectangle
  with a rect+semicircle hole (`absarc`), `ExtrudeGeometry`, ONE geometry per
  tier cloned per bay. Daylight must pass through the opening. Orient bays
  with the TRUE ellipse tangent `Math.atan2(-B*cos t, -A*sin t)` — a plain
  `-t` leaves wedge gaps at the long ends. Overlap panels a whisker.
- **Gable roofs**: `gableRoof()` (two sloped slabs + pediments). NEVER the
  3-sided-cylinder cone trick — it balloons into a wedge that swallows
  colonnades (broke Zeus, Artemis and the Parthenon in turn).
- **Z-fighting**: no two faces may share a plane. Caps/cladding sit PROUD
  (a few % larger) of the surface beneath (the Giza gold caps interlaced
  until they did).
- **Concave detail**: custom BufferGeometry with `computeVertexNormals()` +
  flat shading reads beautifully in raking light (Khufu's 8 faces).
- **Deterministic jitter** for broken crowns/debris: `rnd(i,k)` sin-hash, so
  every render angle shows the same ruin.
- **Materials**: `stoneLike({color})` for masonry; smooth `GOLD/IVORY/BRONZE`
  for statuary (stone texture on a statue reads as a crate); grade storeys
  bright→worn (winner's trick: `travLt/trav/travWorn`).
- **Performance**: clone shared geometries; total meshes well under ~1500.

## Ruin philosophy (the Captain's law: aged, not blown up)

- Ruins are CENTURIES OF QUARRYING: most upper structure is simply gone;
  what fell lies half-buried CLOSE to the wall it fell from; lower walls
  settle slightly; every surviving stone is weathered darker/rougher (clone
  materials before tinting). Generic `ruinify()` now does this — but a
  DISTINCTIVE ruin form beats generic every time.
- **Self-ruin pattern**: a model whose real ruin is famous builds it itself —
  take the `ruined` param, set `group.userData.selfRuined = true` (callers
  then skip ruinify). Exemplars: the Colosseum (surviving north arc, jagged
  step-down, exposed inner wall, hypogeum + half deck + debris field), Giza
  (STRIPPED CASING: bare cores, no gold, Khafre's summit remnant — pyramids
  never collapsed).
- Ask of every archetype: "what does the real one look like TODAY?" — that,
  not rubble, is the ruin.

## Scene truths

- Water: meanders (CatmullRom + flattened tube), never rectangles ("planks").
  Historic waterways that silted up VANISH in the ruin phase (Giza's Ahramat
  branch).
- Life phases: intact / construction (buildFrac) / burning / ruin / drowning
  (seaLevel). Construction shows honest scaffolding/ramps.
- The Workshop (workshop.html) lists every archetype (`MODELS`) with a real
  representative site (`LIVE_SITES`); new archetypes must join both, plus
  `VALID_MODELS` in scripts/monument-archetype.mjs AND the keyword cascade in
  BOTH panel.ts and monument-archetype.mjs (a parity test enforces the pair).
- "Prefer no 3D to a wrong one": if an archetype would misrepresent a site,
  suppress the site (NO_3D_NAMES, mirrored in both files) or build it right.

## Review gates (all must pass before ship)

`npx tsc --noEmit` · `npx vitest run` (167+) · `npm run build` · renders read
correctly (3q + top + ruin; geo plan on the real site for placed monuments).
