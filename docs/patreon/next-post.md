# Patreon — next dispatch + page sync

_Staging file. The Friday `patreon-dispatch-draft` routine OVERWRITES this file
with the next dev-log, so **paste the post below before Friday** and action the
checklist this week. After that, the file returns to its normal weekly cadence._

**Status:** the maiden post — _"The maiden voyage of the support ship 🚢"_ — is
already **published** (the Captain, launch day). So L4's "first post" is done;
what follows is the **second** post (a launch-week feature spotlight, public, to
help the launch reach convert) and a **page-sync checklist**.

---

## Post to publish next (public)

> **Watch the Moon's shadow cross the real Earth 🌑**
>
> A thing to try on Chronos Earth this week: open **Sky and Weather**, ask it
> for a solar eclipse — anywhere on Earth, any year — and press _watch the
> shadow cross_. The Moon's umbra sweeps the actual globe along its real path,
> the sky dims to a corona, and the monuments beneath it go dark.
>
> Stand under the 2017 eclipse over Wyoming and it's spot-on. Ask for an ancient
> one — the eclipse Thales is said to have predicted, 585 BCE — and it still
> finds it, but wears an honest label: the date is certain, the ground it
> crossed is an estimate, because Earth's spin has slowed unevenly since. The
> globe would rather tell you what it doesn't know than fake a confident line
> across Anatolia.
>
> The site's free and stays free — bunhead.github.io/chronos-earth. If you're
> enjoying it, sharing it with one person who'd love it is worth as much as a
> pledge. And if you'd like to keep the crew building, the ship's manifest is
> open: the first 20 aboard wear a founding star. ⚓

_(Why this post: it's honest, it shows off genuinely new work, and it's public
so it aids the launch-week reach rather than sitting behind the paywall. No
patron numbers are claimed — there's nothing to inflate yet, and pretending
otherwise would break the whole honesty pitch.)_

**Alternate, if you'd rather lead softer** — a "drain the oceans" post:
> **Walk the coastline your ancestors actually walked 🌊** — Chronos Earth lets
> you drop the sea level and watch the Ice Age land bridges surface: Britain
> joined to Europe, Asia to Alaska. Free, no account: bunhead.github.io/chronos-earth ⚓

---

## Page-sync checklist (verify the live page matches the kit)

I couldn't read the live tier prices automatically — Patreon renders them with
JavaScript, so a scraper sees an empty page. **Please eyeball these against
`docs/patreon/launch-kit.md` and fix any that drifted** (each is ~30 seconds in
the Patreon editor):

- [ ] **Tier prices.** The kit specifies **£3 · £6 · £12**. An earlier read of
      the live page hinted at **£3.50** for the entry tier — if the bottom tier
      isn't £3, either lower it to match the kit or update the kit to match the
      page (pick one so they can't disagree). The names should be **Time
      Traveller / Navigator / Maker's Circle**.
- [ ] **£3 tier cadence wording.** The dev-log line must promise **"dispatches
      as they land"**, NEVER "weekly" or any fixed cadence — missing a schedule
      you didn't need to set is the #1 cause of patron churn. (This is already
      on your 5-minute list.)
- [ ] **Founding-star line.** The £3 tier must say the **first 20 aboard wear a
      founding star ⭐ forever** — that's the scarcity hook, and it's now real:
      the app's ship's manifest renders the star on the first 20 names (L1).
- [ ] **Welcome note.** Settings → Welcome note should match the kit's welcome
      text ("Welcome aboard, and thank you — truly…").
- [ ] **About section.** Should match the kit's About ("The whole of history, on
      one spinning globe…"). Confirm it mentions free-forever + the AI-crew.
- [ ] **The ❤ Support link is now live in the app** (About panel + ⋯ menu →
      `patreon.com/cw/ChronosEarth`) and the **ship's manifest** shows the empty
      "be the first name aboard" state — so the £3 perk is real from day one.
      Nothing to do here; just so you know the promise is now backed by the app.

Once the tiers match the kit, the £3 perk (name on the manifest, founding star)
is fully deliverable — add a patron's display name to
`public/data/supporters.json` and it appears on the next deploy.
