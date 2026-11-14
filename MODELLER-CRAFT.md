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
   `BUILD_FRAC=`, `SEA=`, `CAM=bearing,elevation,distance` (an orbit view from
   one compass side, e.g. Edinburgh Castle from Princes Street: `CAM=0,22,0.75`).
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
  STRAIGHT arcades (aqueducts, bridges) are the trivial case: panels face +Z,
  `rotation.y = 0`, still overlap a whisker so pier faces never go coplanar.
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
- **Cliffs on a model's own landform** (Nottingham Castle, Nov 2026): a square
  height grid draws a cliff whose edge runs diagonally across it as a zig-zag
  of pleats. Build the fall as a STRIP that follows the edge line (columns
  stepped along the edge, rows stepped down the fall, heights from the same
  height function), keep the grid only for the top, and pull grid points just
  outside the edge onto it. Colour bare rock in level beds by height.
- **Ashlar is not rubble**: `stoneMat` carries a rough brown rubble texture.
  A smooth dressed-stone building (a mansion, a palace) reads right in a plain
  `MeshStandardMaterial` colour; keep `stoneMat` for medieval walls.
- **One mesh per material** (Chatsworth House, Nov 2026): a house front is
  thousands of small boxes (windows, frames, balusters, steps). Write them
  into one geometry per material (a `put(geo, material, matrix)` that appends
  transformed positions and normals, flushed at the end) and a whole stage is
  about fifteen meshes and a 15–70 KB .glb. Plain colours need no UVs.
- **A window must stand proud of everything on its wall**: a pane thinner
  than the basement band in front of it is simply hidden (Chatsworth's
  basement windows vanished until the panes were made deeper than the band).

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
- Generic-ruin FAILURE SIGNATURES (render the ruin; if you see these, build a
  self-ruin): a roof/cap surviving intact as ground debris ("tents on grass"),
  floating high meshes, a whole tower tilted over in one piece, gallery slabs
  hovering where their support vanished.

## Agent field notes

- The globe lights a model by the DATE on the timeline: the same .glb drew
  its lawn a third darker at 1695 than at 1690 (Chatsworth). Before blaming a
  stage file for a colour change, capture two dates that use the SAME file.
- In a cloud session with no dev tools installed: `PUPPETEER_SKIP_DOWNLOAD=1
  npm ci`, then `PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium` for
  render-model, export-models and verify-app.
- Worktree node_modules junction: Git Bash's `cmd //c mklink /J` mangles the
  paths. Use PowerShell: `New-Item -ItemType Junction -Path node_modules
  -Target "D:\...\ChronosEarth\node_modules"`. If Vite's dep optimizer throws
  ENOENT, recreate the junction and ensure its cache dir exists.

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
- A model that carries its own landform must NOT carry the ground round it:
  the globe does not hide what lies under the real terrain, so a skirt shows
  as a green apron over real streets. If the viewer then needs the landform
  closed down to its flat disc, put that bank in its own mesh with
  `userData.viewerOnly = true`; `export-models.ts` leaves it out of the .glb.
- The satellite photo and a MAP can disagree on a crag: at Nottingham Castle
  Esri's photo and Esri's topo map place the mansion 15–20 m apart. Lay the
  model out on the PHOTO (it is the ground the app shows) and say so.
- A building's ROOF leans in the satellite photo; its walls' feet do not. At
  Chatsworth the roofs sit about 8 m south-east of the walls' feet (the photo
  was taken from the north-west: you can see the west front's face). Esri's
  World Topo Map (z19) draws building outlines on the feet. Lay the model on
  the feet (check the terrace or path at a wall's foot in the photo), and
  expect its roof to sit a little off the photo's roof from straight above.
- Esri's World Topo Map also carries building outlines and 5 m contours when
  OpenStreetMap cannot be reached: read the grey polygons off the tiles.
- A house with a garden: carry the garden's own levels as flat slabs (their
  sides are the real terrace walls), and close them down to the viewer's disc
  with a `viewerOnly` bank. Match the lawn's colour to the photo's lawn.
- When Historic England and OpenStreetMap are blocked, Wikipedia's "Listed
  buildings in <place>" tables carry the list entries' dates and descriptions
  (bays, plan shape, wall heights) with their HE list numbers.
- "Prefer no 3D to a wrong one": if an archetype would misrepresent a site,
  suppress the site (NO_3D_NAMES, mirrored in both files) or build it right.

## Review gates (all must pass before ship)

`npx tsc --noEmit` · `npx vitest run` (167+) · `npm run build` · renders read
correctly (3q + top + ruin; geo plan on the real site for placed monuments).

## Verifying app changes

Read `docs/verifying-the-app.md` before claiming any visual change to the globe
works — the companion to this book, paid for the same way.
