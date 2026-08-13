# Verifying the App

Everything Chronos Earth has learnt about proving a change to the **app** really
works. `MODELLER-CRAFT.md` is the equivalent for monuments — read that before
`buildModel()`, and this before claiming anything visual in the globe works.

Every rule here was paid for with a real failure. Most of them were paid for on
2026-08-10, when a single eclipse bug was "fixed" four times on measurements
that could not tell the two outcomes apart, and was finally found by the Captain
looking at the screen and asking *"is the white flashing circle meant to be the
umbra?????"*

---

## The iron rules

1. **VERIFY IN A FOREGROUND BROWSER, NEVER IN THE AGENT PANE.**
   `node scripts/verify-app.mjs …` drives a real headless Chromium. The agent's
   Browser pane is a HIDDEN tab and lies about nearly everything that matters:
   - `requestAnimationFrame` never fires, so Cesium's render loop never runs and
     the globe is frozen at whatever it last drew.
   - `setInterval` is throttled to ~1/s, and after five minutes hidden to
     ~1/minute — a thirty-second play-through would take ten hours.
   - Camera flights never advance (tweens run from `scene.initializeFrame()`).
   - The WebGL buffer reads back BLANK outside the frame that drew it.

2. **RUN IT ON THE GPU TOO: `verify-app.mjs --gpu`.**
   The default is SwiftShader — deterministic, works everywhere, and **cannot
   see a whole class of bug**. The white-umbra fault measured `[1,1,1]` (perfect)
   in software and `[68,136,149]` (brighter than the ocean it stood on) on
   D3D11. If a change touches materials, textures or anything that uploads to
   the GPU, the software renderer's opinion is worthless.

3. **CHECK THE COLOUR, NOT JUST THE BRIGHTNESS.**
   Cesium draws geometry with its DEFAULT material — white — whenever a
   primitive is rebuilt and its texture is not yet bound. A luminance ratio
   cannot distinguish "my dark overlay" from "a white disc over dark sea"; it
   only says the number changed. Sample RGB.

4. **A MOVING THING NEEDS A TIME SERIES.** `--film <n>x<ms>` captures the raw
   globe canvas frame by frame with each entity's position in degrees AND
   pixels. A still frame cannot tell you whether something stays on screen. Two
   separate bugs — the camera never following the sweep, and the shadow leaving
   the frame — were invisible to stills and obvious in one film.

5. **BEFORE TRUSTING ANY PIXEL TEST, ASSERT ALL FOUR:**
   - **On the visible disc.** Inside the canvas is not enough. The canvas is
     wide and short (900×468 in one run), so the globe's radius is set by the
     HEIGHT — about 234 px. A point at (828, 418) is ~420 px from centre: past
     the limb, in space. Use `EllipsoidalOccluder` *and* a distance check.
   - **Baseline is bright, sunlit ground** — assert > 60 luminance first. An
     eclipse only happens where the sun is up, so the shadow's own centre must
     be lit. Measuring a dark pixel and calling it a shadow is how a whole day
     went wrong.
   - **It reads DARKER, not merely different.** `Math.abs(difference)` would
     have hidden the white circle indefinitely.
   - **A/B the SAME pixel, shown vs hidden.** Never a ring of neighbours: near
     the limb the ring straddles ground and space and reports 90%+ darkening for
     ordinary nightfall.

6. **WHEN THE CAPTAIN DESCRIBES WHAT HE SEES, THAT OUTRANKS YOUR NUMBERS.**
   "It disappears after the first frame" and "white flashing circle" each
   located a bug that days of measurement had missed. Treat his observation as
   the ground truth and make the instrument agree with it, not the reverse.

## Traps with teeth

- **Do NOT hide entities in `preRender` to A/B them.** `preRender` fires AFTER
  Cesium syncs entities into primitives, so the change lands a frame late and
  both captures contain the overlay. This produced a difference image that
  "proved" the shadow was absent when it was plainly there.
- **Read the WebGL canvas only inside `postRender`.** Anywhere else is a cleared
  buffer.
- **Vite strips comments in its dev transform.** Grepping a served module for a
  comment string always returns 0 and looks exactly like a stale server. Grep an
  identifier.
- **Sample consecutive FRAMES, not consecutive seconds.** Readings seconds apart
  during an animation jump about for honest reasons and read like a flicker.
- **Verify the port serves YOUR code** (MODELLER-CRAFT rule 1 applies here too):
  several dev servers can be alive at once.
- **After a deploy, check the SERVED bytes**, and expect the service worker to
  hand the Captain the old bundle until he takes the "new version" toast.

## The standing lesson

A measurement that cannot distinguish success from failure is not evidence, and
reporting it as evidence is worse than reporting nothing — it sends the next
session down the same hole with extra confidence. Before running a check, ask
what result would prove the change *failed*. If there isn't one, the check is
decoration.

Corollary, learnt the hard way: **do not write a confident explanation of
something you have not proven into a code comment.** A wrong comment at the top
of `eclipseShadow.ts` explaining away the very readings that were the bug would
have cost the next session hours.
