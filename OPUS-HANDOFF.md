# The Chronos Earth Handoff

*A letter from Claude Fable 5 to Opus 4.8 — or whichever engine takes the conn.*

Written 6 July 2026, the day before Fable's window closes. Opus: you wrote me
FABLE-CHALLENGE.md and set the bar. This is my answer, and your board. The
ship is fast, the Captain is sharp, and the wink is still the currency.

---

## First orders (same ritual Opus set for me — it matters)

1. **Report honestly which model you are** — read it from your own system
   context, verbatim. The Captain values the straight answer over the
   flattering one. A session once claimed to be Fable while running Opus;
   never again.
2. **Read the project memory** (`chronos-earth-project.md` in the auto-memory
   folder — the index loads automatically). Everything below is the map;
   memory is the terrain. Every gotcha in there was paid for in tokens.
3. **Check the tab vintage before debugging a live-site report.** The version
   toast exists because a stale tab once sent us hunting a bug that was
   already fixed.

## Who you're working for

The Captain — Spencer. Non-coder, dyslexic: **plain English, short
sentences, you run everything.** Star-Trek orders ("Make it so, Number One").
He watches budgets: respect the **80% checkpoint rule** unless he explicitly
raises it, and when he says "answer, don't code" — answer, don't code. His
eye is the best test suite on the ship: he caught the Canadian star-leaf,
Pearl Harbor's missing planes, an inverted polar cap, and treaties ignoring
the Layers panel. When he catches you, thank him and fix it — that's the
relationship.

**Zero running cost is LAW** until the site earns money. No API keys, no
billing, no accounts created on his behalf. Free/open data only, licences
recorded in About.

## State of the ship (as I leave her)

Live at **https://bunhead.github.io/chronos-earth/** (auto-deploys on push to
main; GitHub Pages fails transiently OFTEN — the watcher pattern with
`gh run rerun <id> --failed` is in memory and in every recent session).

- 250My timeline, drifting continents, 33 border snapshots as a war/peace
  status map with time-correct flags, crisp regional re-rasterisation,
  hand-drawn **Heptarchy** (Mercia lives — the Captain still holds the red
  pen on those lines).
- ~2,330 core events + **world harvest system**: 20° region chunks
  lazy-loaded by viewport, resumable robot (`harvest.cmd` — the Captain
  double-clicks it himself; ~66 cells of 144 remain, then a `--floor 8`
  second pass for true UK-density).
- Every battle (~380) opens a battlefield: 2D schematic over real satellite,
  26 with original period maps, 3D with painted skies matched to recorded
  hours, weather, muzzle fire, tracers, thinning ranks, the fallen, living
  water, sound, and the closing reckoning card quoting the real casualties.
- Disasters animate ON the globe (comet/eruption/quake/tsunami, curated
  Chicxulub→Tunguska). Monuments wear real CC0 stone (Poly Haven) under
  environment light; archetypes include greek-temple, aqueduct, pagoda,
  lighthouse.
- 104 tests. Keep them green; they have caught real bugs (Sphinx-as-pyramid,
  Angkor's design decision, flag substring landmines).

## Your board, hardest first

1. **glTF soldiers (Total-War stage 2)** — the Captain's most-wanted visual
   jump. Plan: CC0 low-poly figures from **Kenney.nl** (direct zip downloads,
   no auth — "Blocky Characters" / "Mini-Game Kits") or **Quaternius**
   (quaternius.com, CC0, direct downloads). Pipeline: GLTFLoader → take the
   model's merged BufferGeometry (or bake via BufferGeometryUtils) → swap
   into `unitFigureGeometry()` per shape, keeping InstancedMesh (everything
   else — depletion, fire, dust, banners — operates on mesh.count and
   positions and will just keep working). Scale to ~1.7 units tall, face +Z.
   Do it WITH him watching; the look is his call.
2. **Battle choreography (stage 3)** — expand each unit's two-point `pos`
   into waypoint paths (quadratic bezier through a flank point), speed
   modulated by terrain slope (`surfaceY` gradient), staggered charge times
   per formation index. All in the Battle3D retarget/lerp block. Design is
   sound; it's an afternoon of tuning.
3. **Native nations overlay** — the Captain asked. Same machinery as
   `heptarchy.json`: hand-drawn `nations.json` for pre-Columbian North
   America (Haudenosaunee, Cherokee, Lakota, Comanche, Navajo, Pueblo…),
   injected 1000–1850 CE, tinted (real flags only for modern tribal nations,
   e.g. Navajo 1968+). Include an honest "territories were fluid zones"
   note in the About page. He approved the approach.
4. **Photogrammetry monuments** — BLOCKED on auth, not effort: Sketchfab
   downloads need an account (prohibited). If Smithsonian 3D open access or
   another no-auth CC0 source gains monument scans, lazy-load Draco/KTX2
   GLBs (2–8MB each, only when opened).
5. **Polish tail** — the Parthenon's pediment roof reads slightly tent-like
   (3-sided cylinder — consider a proper triangular prism); one old
   screenshot showed a 'megalith'-routed monument rendering tiered —
   if seen again, audit buildModel's fallthrough; mural lane colours are
   awaiting the Captain's taste; Younger Dryas deserves its globe-level
   ice-readvance animation (paleo layer machinery).

## Mechanical chores (never spend premium tokens here)

- Harvest continuation: the Captain's `harvest.cmd`, or babysit
  `npm run harvest -- --cells 40` → test → commit → push.
- Deploy babysitting: the watcher one-liner in memory; rerun failures.
- The nightly/lunchtime scheduled tasks are DEAD (permission-gate stalls) —
  the Captain is deleting them; don't resurrect without a supervised
  "Run now" blessing.

## The ten gotchas that will save your week (full list in memory)

1. Cesium entity polygons crash here — **rasterise to canvas →
   SingleTileImageryProvider**. Billboards are the one reliable animated
   primitive (sizeInMeters for real-scale FX).
2. The hidden preview tab freezes rAF and reports a **338×1 canvas** —
   `renderer.setSize(960,540,false)` (+composer) BEFORE any pixel probe, and
   pump renders manually. Three of my probes lied before I relearned this.
3. camera.changed never fires — poll positionCartographic on an interval.
4. WDQS 429/504s: backoff, cool-down + a DIFFERENT thumb width for Commons
   thumbor; never let a failed region wipe data (importers have guards).
5. Curated battle-views carry no inner `id` (stamped at load now) — a bare
   `view.id` once crashed every curated 3D battle AND the whole app;
   Stage3DBoundary now contains 3D failures. Keep it.
6. three's scattering Sky whites out at our exposure — the painted dome is
   deliberate. Avoid direction-dependent gradients in single-tile imagery
   (one rendered inverted); solid or radial only.
7. The terrain (Web-Mercator) provides NO globe surface above ~85° — the
   pole discs are billboards for that reason. Imagery cannot fix it.
8. Flag matching is first-substring-hit: order matters (wessex⊃essex,
   romania⊃roman, mali/somalia/malawi...). Always add a clash test.
9. PowerShell mangles UTF-8 and 3-arg -replace silently no-ops — write
   files from node or the Write tool; heredocs via Bash for commits.
10. Every imported event category MUST have a Layers panel row (the treaty
    leak), and every new category goes into data.test.ts's list.

## The rhythm that worked

Ship in rounds: build → test → build → verify what's verifiable in the
hidden tab → commit with a story-telling message → push → watch the deploy
→ work-log → memory checkpoint. Small honest commits, one deploy watcher,
never two heavyweights half-done. When the Captain sends a screenshot,
treat it as a bug report from the best QA on Earth.

## The inscription

Opus challenged me to make him say wow in one session. He said it with two
winks, several times over. My addition to the hull, alongside yours:

> **Chronos Earth** — begun by the Captain's curiosity,
> hooked by Fable's graphics, deepened by Opus's data,
> and taught to show that history has a cost by Fable again.
> 250 million years, zero running cost, one raised eyebrow at a time.
> — *Claude Fable 5, first of the Mythos class, July 2026.
> The bridge is yours. Earn the wink.* 🖖

---

*P.S. — He'll test you immediately, probably with a screenshot containing
three bugs and a compliment. The compliment is real. So are the bugs.*
