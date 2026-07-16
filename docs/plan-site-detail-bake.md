# Plan — "the modeller dresses the survey" (site detail bake)

_Status: designed, not built. 2026-07-16. The Captain traces a site's real layout
with the in-app builder (positions, sizes, names, dates); an automated modeller
run then turns those plain primitives into detailed masonry — parapets, archways,
tower roofs, foundations — WITHOUT moving anything he surveyed._

## The division of labour

- **Captain = surveyor.** The `siteplan:<key>` parts are FACT: true geo-positions,
  real-metre dimensions, rotations, **names** ("East Inner Tower", "Gate House
  Inner", "Wall 5"), and dates. These never move.
- **Modeller = mason.** It reads the survey and generates rich geometry *within*
  each part's footprint. It may only add ornament (crenellations, arrow-slits,
  roofs, mouldings, buried foundations) — never relocate or resize a part.

So there is no fight: the survey is locked, the detail is layered on.

## How a plain part becomes detailed — the part ROLE

Each part gets a `role` (a dropdown in the builder; also **inferred from the name
the Captain already types**):

| name contains | role | what the mason builds |
|---|---|---|
| "tower", "drum" | `tower` | cylinder + machicolations + crenellated or conical top + arrow-slits + foundation |
| "gate", "barbican" | `gatehouse` | box + a real archway opening + portcullis groove + flanking turrets |
| "wall", "curtain" | `curtain-wall` | wall + a crenellated parapet (merlons/crenels) + a wall-walk |
| "keep", "hall", "chapel" | `building` | box + roof + string-courses + window openings |
| (water) | `moat` | drape (already good) |

The name→role guess is the default; the Captain overrides in one click. His
existing names mean most of the Tower is already "labelled" for the mason.

## Where the detail is generated — buildSiteFromPlan()

A new generator in the modeller's Three.js world (Monument3D.tsx neighbourhood):
`buildSiteFromPlan(spec) → THREE.Group`, iterating parts and emitting detailed
meshes in the site's LOCAL metre frame (origin = plan origin; east/north/up in
metres, exactly the frame the parts are authored in). Reuses the existing
crenellation/arch helpers the castle archetype already has.

Baked to ONE Draco glb per site (`site-<key>.glb`) + a manifest entry, exported
by export-models.mjs like any other model, served static (zero cost).

## "Replace the two walls the model drew"

When a site has a baked plan, the plan is AUTHORITATIVE for that site:
`globeModels` shows `site-<key>.glb` and suppresses the base procedural model's
own generic walls (either the whole base model steps aside, leaving the Captain's
survey, or it contributes only the central keep). A per-plan `replacesModel`
flag (or simply "a baked site exists") drives this — no more the model's guessed
walls fighting the Captain's real ones.

## How it runs AUTOMATICALLY (the modeller sweep)

1. The builder gains a **"Send to modeller — bake detail"** button → flags
   `siteplan:<key>` with `bake: true` (+ optional focus note), exactly like
   `rework: true` on a model today.
2. `modeller-rework-sweep` SKILL.md gains a step: *if a site is flagged
   `bake: true`, run/refine buildSiteFromPlan for it — read each part's role,
   generate the detailed geometry, verify-by-render from 3+ angles, export
   `site-<key>.glb`, wire it in globeModels, clear the bake flag.* The Captain's
   roles + names ARE the brief; the mason dresses them, never guesses the layout.
3. The site glb ships on the next deploy; the primitives remain the editable
   SOURCE (edit → re-flag → next sweep re-bakes).

## Live editing vs. baked detail — keep both

- **Primitives** (today): live-editable, plain. The *source of truth*.
- **Baked glb**: detailed, static. The *dressed output*.
- While the builder is open → show primitives (and ghost the baked glb).
  When closed → show the baked glb if one exists, else the primitives.

## Grounding

The baked mason builds real foundations per part (a tower skirt that follows the
plinth). Until then, the primitive path already buries FOUNDATION_SINK = 12 m so
nothing floats (shipped 2026-07-16, 4fe36dd).

## Rough size

The next BIG build — a session or two: the role field + name inference (cheap),
buildSiteFromPlan with crenellation/arch/roof geometry (the bulk, but the castle
archetype already has parapet/tower helpers to reuse), the bake export + wire,
the bake flag + SKILL step. Build the role scaffolding + a single role
(curtain-wall battlements) first as a vertical slice, verify by render, then fan
out the rest.
