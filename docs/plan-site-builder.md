# Plan — in-app site builder / footprint tracer (Feature 1)

_Status: designed, not built. Written 2026-07-15. A non-coder composes an accurate
site on the satellite globe (e.g. Tower of London: keep + inner ward + moat +
outer ward) instead of tracing in Google Earth and hand-coding polygons._

## The key insight that makes this tractable

**Cesium already draws parametric geometry in geo-space natively** — `BoxGraphics`,
`CylinderGraphics`, and `PolygonGraphics` (with `extrudedHeight`) all position by
lon/lat, clamp/rest on the ground, and are editable live. So the MVP needs **no
glb pipeline at all**: a site is a list of primitives rendered straight as Cesium
entities from a saved spec. (Generating a procedural Three.js model from the same
spec is a later stretch — see below.)

## The site spec (the saved artefact)

A georeferenced JSON blob, one per site, persisted through the **existing review
plumbing** (`saveReview` in `src/lib/review.ts` → `public/data/model-review.json`),
under a new key namespace `siteplan:<id>`:

```jsonc
{
  "id": "tower-of-london",
  "origin": { "lat": 51.5081, "lon": -0.0759 },   // local frame anchor
  "parts": [
    { "type": "box",      "lat": .., "lon": .., "widthM": 36, "lengthM": 32,
      "heightM": 27, "rotationDeg": 8, "material": "#d8d2c4" },   // White Tower
    { "type": "cylinder", "lat": .., "lon": .., "radiusM": 5, "heightM": 14 },
    { "type": "polygon",  "verts": [[lat,lon],…], "heightM": 12, "thicknessM": 4,
      "fill": false }                                              // curtain wall
  ]
}
```

- **box** — square building: place, drag, rotate (heading), scale per axis, extend one side.
- **cylinder** — round tower/drum: place, scale radius & height.
- **polygon / path** — click vertices over the satellite to trace an outline; then
  either **extrude to a wall** (`thicknessM` + `heightM`, `fill:false`) or **fill as
  a platform** (`fill:true`). Moat = a filled polygon at negative height / water material.

## Rendering

Each part → a Cesium entity, positioned from its lat/lon (walls use the polygon's
own vertices). The whole site rides the existing site placement so **move / turn /
scale / height reins already move it as one**, and it obeys the timeline gate like
any monument. Reuse `ensurePlacement` for the group anchor.

## Editing flow (reachable from the placement panel — a new "Build site" button)

1. **Place** — pick a primitive, click the satellite ground; it drops at that
   lon/lat at a default size.
2. **Select** — click a placed part; its handles + a mini panel (the existing
   move/turn/scale/height reins, scoped to that part) appear.
3. **Trace** — polygon mode: click to add vertices over the satellite, double-click
   / Enter to close; toggle wall-vs-platform + set height/thickness.
4. **Snap** — vertices/edges snap to nearby parts so walls meet cleanly.
5. **Save** — writes the `siteplan:<id>` spec via `saveReview` (published) +
   localStorage (device-local, key-free — same as placements today).

## Watch-outs

- **Coordinate math**: metres → degrees needs the cos(lat) longitude scale; reuse
  the helpers the placement reins already use for east/north metre nudges.
- **Ground clamp vs. height**: boxes/cylinders sit on terrain via `heightReference`;
  extruded polygons need a base height. Test on sloping ground (the Tower is near-flat).
- **Selection/hit-testing** over the satellite imagery — Cesium `drillPick` on the
  entities, not the globe surface.
- **Don't fight the placement panel**: the site-group transform stays the outer
  frame; part edits are in the group's local metre frame.

## Stretch (later, not MVP)

- A `buildModel` case that reads a `siteplan` spec and emits the same geometry as
  Three.js meshes, so a traced site can also be exported to a glb and Draco-packed
  like the rest of the fleet. The spec is designed to make this a mechanical map.

## Rough size

A real feature — the primitive-drawing + select/edit/trace UI is the bulk (a few
days of focused, visually-verified work). Best built as a dedicated session with
live globe verification, not rushed. The spec + Cesium-native rendering is the
foundation to build first; the polygon tracer is the richest single piece.
