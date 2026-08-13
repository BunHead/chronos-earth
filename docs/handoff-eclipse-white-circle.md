# Handoff — the eclipse umbra draws WHITE while sweeping

_Written 2026-08-10 by the Opus session that spent a day on this. Read this
before touching `src/components/eclipseShadow.ts`._

## The one job

**The Captain sees a white flashing circle where the umbra should be, during a
play-through only.** Standing still, the shadow is correctly black.

The umbra's texture is a near-black radial gradient
(`rgba(2,2,6,0.93)` at the centre). Nothing in it is white. A white ellipse
means Cesium is drawing the geometry with its **default material** because the
image texture is not bound yet.

Why it only happens while sweeping: `show()` writes new `ConstantProperty`
values for position and both axes on **every** frame (20 fps). Constant
properties put the entity on Cesium's **static geometry path**, which rebuilds
the primitive. Each rebuild renders untextured — white — until the canvas
texture uploads. Standing still there is time; at 20 fps there never is.

### The evidence that was in front of me and misread

Mid-sweep readings at the umbra's own screen centre, against a disc average of
about 74:

```
+3.2s  centre = 156.3
+4.8s  centre = 111.1
+9.6s  centre =  99.5
```

**Brighter** than the surrounding ground. I wrote this off as "the shadow
crossing bright ocean" and — worse — enshrined that wrong explanation in a
comment at the top of `eclipseShadow.ts` telling the next person not to be
fooled by it. **That comment is wrong. Delete it.**

### The fix to try first

Reinstate the `CallbackProperty` geometry. Every geometry property becomes a
non-constant `CallbackProperty` (and `CallbackPositionProperty` for position)
reading from a small mutable `ShadowShape` object. That sends the entity down
Cesium's **dynamic path**, rebuilt synchronously each frame, which should keep
the material bound.

It is in the git history: written and then reverted within commit `cb6348a`.
I reverted it because an A/B "showed identical readings" — but that A/B sampled
points I later proved were **off the visible disc**, so it could not tell the
two apart. The revert was wrong. Recover the diff, do not rewrite it from
scratch.

Fallback if white persists: bake the two gradients to **data-URI PNGs** instead
of live `HTMLCanvasElement`s, so there is nothing to upload late.

## How to verify — do not skip this

`scripts/verify-app.mjs` drives the real app in a **foreground** headless
Chromium. Start the dev server first.

```bash
node scripts/verify-app.mjs --base http://localhost:5179 \
  --url "?time=9&zoom=1&cam=50,20,9000000,0,-90" --size 1200x800 --wait 12000 \
  --menu "Sky and Weather" \
  --eval "(async()=>{ /* seek, then click .sky-eclipse-play */ })()" \
  --film "8x2500" --film-out ./film
```

`--film` writes a PNG per frame plus each frame's shadow position in degrees
AND pixels. `--eval` runs before any capture; `--eval-wait` sets the settle.

**Assertions the next test MUST make** — every wrong conclusion this session
came from omitting one of them:

1. **The sample point is on the visible disc.** Being inside the canvas is not
   enough. The canvas is wide and short (measured 900×468), so the globe's disc
   radius is set by the HEIGHT — about 234 px from centre. A point at (828, 418)
   is ~420 px out: past the limb, in space. Use `EllipsoidalOccluder` plus a
   distance-from-disc-centre check.
2. **The baseline is bright, sunlit ground** — assert > 60 luminance before
   trusting any ratio. An eclipse only happens where the sun is up, so the
   shadow's own centre must be on lit ground. Measuring a dark pixel and calling
   it a shadow is how the whole day went wrong.
3. **The shadow reads DARKER, not merely different.** A white-circle bug fails
   this instantly. `Math.abs(difference)` would have hidden it for another day.
4. **A/B the SAME pixel, entities hidden vs shown** — never a spatial ring of
   neighbours. Near the limb the ring straddles ground and space and reports
   90%+ darkening for ordinary nightfall.

## Traps that cost real time

- **The agent Browser pane is a HIDDEN tab.** No rAF, so the globe is frozen;
  `setInterval` throttled to ~1/minute after five minutes; camera flights never
  advance (tweens run from `scene.initializeFrame()`); the WebGL buffer reads
  back BLANK outside the frame that drew it. Use `verify-app.mjs` instead.
- **Read the WebGL canvas only inside `postRender`.** Anywhere else gives a
  cleared buffer.
- **Do NOT hide entities in `preRender` to A/B them.** `preRender` fires AFTER
  Cesium has synced entities into primitives, so the change lands a frame late
  and both captures show the shadow. This produced a blank difference image that
  "proved" the shadow was absent when it was plainly there.
- **Vite strips comments in its dev transform.** Grepping a served module for a
  comment string always returns 0. Grep an identifier.
- **Sample consecutive FRAMES, not consecutive seconds.** Readings seconds apart
  during a sweep jump about wildly for honest reasons (different ground) and
  read exactly like a flicker.

## Landed and live today

`cb6348a` `431be2c` `163ebdc` `720b3d8` `ead94c2` — all deployed, tests green.

- Eclipse finder no longer searches from 0°N 0°E when the globe is zoomed out
  (it was answering for the Gulf of Guinea from the app's own opening view).
- The sweep runs the umbra's **track**, not the full penumbral window, so it no
  longer opens on six seconds of nothing. Pinned to NASA's published contact
  times for 2017.
- The camera flies to where the shadow actually **is**, not to the centreline.
- The camera **follows** the shadow during a sweep (hard bound, not an easing).
- Three look-alike play buttons given distinct jobs; timeline era ribbon
  anchored to the bottom.
- Solar clock reference pinned, so the terminator stops chasing the camera.
- Timeline region filter is a great-circle **circle**, not a bounding box.
- Harvester auto-deepens its notability floor instead of running out of work.

## Still open, after the white circle

1. **`followShadow`'s bound uses the geometric horizon**, which assumes the whole
   globe fits on screen. On a short canvas it does not — so the bound can park
   the shadow past the visible edge. Compute it from the frustum's vertical
   extent or the drawn disc instead. _(Suspected, not yet proven.)_
2. **The dial does not carry the shadow.** `setEclipseShadow` is issued once, in
   `onGoToEclipse`, and never re-issued — so spinning the dial moves the sun and
   leaves the moon's shadow frozen.
3. Roadmap items 10, 11, 12. Item 12 explicitly wants the Captain's live eye on
   pacing — build the flagged engine, then stop.

## The standing lesson

Four times today I declared something fixed on a measurement that could not
distinguish the two outcomes. The Captain found the actual bug by *looking at
it* and saying "white flashing circle". Before claiming a visual thing works,
make the instrument prove it can tell right from wrong — then run it.
