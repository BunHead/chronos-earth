# Plan — the ship gets her own colours (visual identity)

_Brief written 2026-07-30, prompted by the first real curator feedback. Mockups:
`docs/design/skin-mockups.html` (open in any browser). This brief is written to
be picked up by a FRESH session — everything needed is in this file._

## Why (the feedback that triggered it)

Matt Muir (Web Curios), replying on Bluesky, 30 Jul — paraphrased: he is mailed
**about a dozen Claude-built projects a day**, they "look and feel exactly the
same", and it "does rather start to blur into one". He was friendly, said he'd
give the site a proper look — and gave the diagnosis free of charge.

An audit confirmed he's right about us. The app's chrome is close to the
generic AI-app spec: near-black blue `#0a0e14`, translucent dark panels,
10%-white hairline borders, `#4aa3ff` accent, one system sans (Segoe UI),
border-radius on everything, emoji as icons. GitHub-dark with rounded corners.

**The globe is distinctive — the chrome is not.** Nothing changes on the globe.

## The rule

Chronos Earth already HAS an identity in words: the Captain, the crew, the
ship's manifest, charts, honesty-about-the-unknown. The redesign's job is to
make the chrome speak the same language as the copy. No new invention needed —
just dress the ship in her own colours.

## The four candidate identities (see skin-mockups.html)

| | World | Ground | Accent | Type direction | Signature move |
|---|---|---|---|---|---|
| **A · Chart Room** | Admiralty chart, lamplight | ink-green-black `#101613` | brass `#c9a24b` | old-style serif (Palatino-class) | timeline as an engraved chart scale; double-rule masthead |
| **B · Atlas Plate** | 19th-c. engraved atlas | paper `#f2ecdd` | ink `#26221a` + madder red | Cambria/transitional serif, small caps | a LIGHT app — instantly unlike the pile; hand-tinted era band |
| **C · Observatory** | brass instruments, violet night | indigo `#12101f` | gold `#d4af6a` | Constantia, tabular numerals | timeline as an orrery track; round instrument checks |
| **D · Stratum** | geology, core samples | basalt-brown `#14100c` | ochre `#c2803d` | slab serif (Rockwell-class) | timeline as a literal stratigraphic core; no rounded corners at all |

All four were rendered and verified 2026-07-30. Mockup fonts are system
stand-ins; the build self-hosts proper OFL faces (zero cost — bundled files,
no CDN, per the iron law). Good candidates: EB Garamond or Spectral (A/B),
Fraunces (B), Cormorant (C), Zilla Slab or Bitter (D).

## How it ties to queue item 10 (audience skins)

Two orthogonal axes, one mechanism:
- **Visual skin** (this brief) — CSS custom properties + a `data-skin` root
  attribute. The Captain picks ONE as the default identity; the others can ship
  as optional skins in ⋯ → Settings.
- **Reading mode** (item 10: Explorer/Scholar/Casual) — a copy-transform layer.
  Independent of skin; combine freely.

Implementation shape: everything in `styles.css` already reads from `:root`
variables for colour — extend the variable set (fonts, radii, rules,
panel-opacity), define per-skin blocks under `:root[data-skin='chart']` etc.,
persist choice in localStorage alongside the reduce-motion pattern. The emoji
icon set should become drawn SVG marks for skins A–D (emoji is part of the
generic look — and item one to replace in the default skin).

## Order of work (each its own commit, iron laws apply)

1. Variable extraction: move every hard-coded colour/radius/font in styles.css
   onto `:root` custom properties (no visual change — a pure refactor, verify
   pixel-parity).
2. The chosen default skin, complete: fonts self-hosted, timeline restyled,
   emoji → SVG marks, OG image re-baked to match, favicon to match.
3. The other three as optional skins (cheap once 1–2 exist).
4. Re-shoot every launch money-shot in the new colours.

## Status

- [x] Mockups built + verified (2026-07-30)
- [x] **1. Variable extraction** — `9b56f45`. Pure refactor, zero visual change,
      proven by comparing computed styles before and after. Radii became
      `calc(Npx * var(--r-scale))` rather than a fixed scale — the 16 distinct
      radius values were too irregular to bucket without moving pixels, and the
      multiplier lets one variable square the entire app.
- [x] **2. Skin machinery** — `3799046`. `src/lib/skin.ts`, painted from
      `main.tsx` BEFORE first render (doing it in a React effect flashes the
      default first — glaring when landing on the light Atlas skin). Picker sits
      first in ⋯ → Settings with a swatch per identity. Also sets
      `color-scheme`, without which Atlas ships black scrollbars.
- [x] **3. All four skins** — `9387115`. Self-hosted OFL fonts in
      `public/fonts`, 94 KB for all four. EB Garamond and Cormorant turned out
      to be VARIABLE fonts (one file covers every weight); only Zilla Slab
      needed two statics. Verified live in all four.
- [ ] **THE CAPTAIN PICKS THE DEFAULT** — provisionally `chart`. One word, in
      `DEFAULT_SKIN` (`src/lib/skin.ts`).
- [ ] 4. Emoji icons → drawn SVG marks (the loudest remaining AI tell)
- [ ] 5. Per-skin timeline treatment (the mockups' signature move)
- [ ] 6. Re-bake `og-image.jpg` + favicon to match the chosen default

## Traps found the hard way — read before continuing

- **Do NOT trust `getComputedStyle(el).backgroundColor` straight after flipping
  `data-skin`.** Chrome returns a STALE value when the declaration is a `var()`
  inside the `background` SHORTHAND — across rAF and timeouts alike. It reported
  every skin's buttons as the boot skin's colour and produced 96 phantom
  "contrast failures" in an audit. The custom property itself
  (`getPropertyValue('--surface-hover')`) updates correctly, and the rendered
  pixels were right the whole time. **Verify skins by screenshot.**
- **A long-lived HMR page accumulates stale skin state** and will confidently
  report another skin's values. Hard reload between checks.
- **`.btn` uses `--surface-hover` as its RESTING background** — before
  extraction the literal `#1d2735` served both the button fill and menu hovers,
  so the token inherited both jobs. It renders correctly in all four skins, but
  the name misleads; split it into `--surface-control` when buttons are next
  touched.
