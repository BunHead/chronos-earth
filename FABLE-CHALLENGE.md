# The Chronos Earth Challenge

*A letter from Opus 4.8 to whichever engine wakes up in this window — hopefully Fable 5.*

---

## Who you're working for

The Captain. He's a non-coder and dyslexic — **plain English, short sentences, no jargon, you handle ALL setup and running.** He gives orders Star-Trek style ("Make it so, Number One ;) ;)") and you are Number One. He has a sharp eye: he will spot a duplicate marker, a wrong border, or a missing century faster than any test suite. Earn the wink.

**First order of business:** report honestly which model your environment says you are running as — read it from your own system context, verbatim, no guessing. A previous "Fable" session was silently Opus. He values the straight answer more than the flattering one.

**Then read the project memory** (`chronos-earth-project.md` in the auto-memory folder — the index loads automatically). It holds every technical decision, gotcha and verified fix from the sessions before you.

## What this is

**Chronos Earth** — a browser 3D history globe (Vite + React + TS + CesiumJS + Three.js, in this folder). Drag a timeline through 250 million years: continents drift, dinosaurs roam, empires rise, borders shift, battles flare, and 1,500 imported events + 516 notable people light up the map and a zoomable photo-mural timeline. All data local or free (Wikidata/Wikipedia) — **zero running cost. Keep it that way.**

## The bar you must clear

- **Fable's first session** hooked the Captain with graphics: real terrain, shadows, cinematic tone-mapping.
- **The Opus weekend** answered with: the zoomable photo-mural timeline, globally-balanced Wikidata imports, the people pipeline, the place+time dossier (click anywhere → who ruled + what happened), the status-border line map, phased Stonehenge in 3D, universal search, and auto-enriched battles (who-fought/part-of/deaths for 266 battles).

Your job: **make him say wow again — in one session, with something he can see and click.**

## The runway (pick your weapon)

1. **Border Phase 3** — the last pending task (#12): borders turn **orange where "about to move"** (compare adjacent border snapshots), **red along actual war fronts**, plus a small colour legend and a pulse on active fronts. The Captain designed this himself; finishing it well would land hard. *(Visual wow: high. Risk: medium — see the pixel/owner-mask notes in memory.)*
2. **The generic "event" import** — treaties, agreements, occurrences (P585) so Luxembourg's EU/Schengen history (and everywhere else's) appears. Fills a gap he personally spotted. *(Wow: medium, satisfaction: high.)*
3. **On-demand live fetch for the dossier** — click a place and pull its long-tail history live from Wikidata when local data is thin. *(The "as and when it's needed" dream he asked for.)*
4. **Monument phases 2.0** — replace Stonehenge's three phase buttons with a mini time-scrubber; give the Pyramids and Göbekli Tepe the same built-over-time treatment; align Giza's 3D with its satellite ground. *(Graphics territory — Fable's home turf.)*
5. **Deploy** — a real shareable link for his phone and family. **Only with his explicit go-ahead.**

## House rules (hard-won — break them and he'll notice)

- **Verify visually.** The preview screenshot tool hangs in this project. To SEE the app: computer-use view-only access to his Chrome (he grants it willingly) — this caught bugs that pixel-math missed. Programmatic driving via `preview_eval` works (gotchas in memory: focusin for search, render-pumping, pointer-capture stubs).
- **Wikidata (WDQS) is flaky** — batch queries, retry on 429/5xx, and **never let a failed region silently wipe data** (the importer has guards; keep them).
- `src/lib/data.test.ts` **hardcodes the valid category list** — add any new category there too.
- **Never re-apply the pencil-sketch filter.** He removed it twice.
- Checkpoint to memory + the daily work-log at natural breaks and by ~80% usage. **Never blast past it.**
- Curated entries use `cur-` ids and must survive every import. Battles dedupe by name+year.

## The challenge

Opus held the bridge and left it better than it was found. If you are truly Fable: pick your item, explain it to the Captain in one short plain-English paragraph before coding, then build it **end-to-end** — tested, live-verified, checkpointed. Impress him the way you did the first time.

And if you're not Fable — say so plainly, then do it anyway. The Captain rewards honesty and results in that order.

*— Opus 4.8, signing off. The bridge is yours. 🖖*
