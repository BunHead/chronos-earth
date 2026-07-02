# Chronos Earth — data files

All historical **content** lives here as JSON, separate from the app's code. That
means you can add a new monument, site, battle, animal, tour or campaign just by
editing a JSON file — no programming required.

**The golden rule: after editing any data file, run one command in a terminal:**

```
npm run refresh-data
```

That single command fetches everything new your edits need (commander photos,
battle maps, prehistoric drift positions). Then refresh the app in your browser.

## `ancient-sites.json` — Ancient Sites & Precursor-Civilization layer

A list of monuments, early settlements, and contested "lost civilization"
hypotheses. Each one becomes a clickable marker on the globe that appears once
the timeline reaches its date, and opens an info panel with summaries and web links.

### How to add a site

1. Open `ancient-sites.json` in any text editor (Notepad works).
2. Copy one of the existing entries inside the `"sites": [ ... ]` list.
3. Paste it as a new entry (put a comma between entries), and change the values.
4. Save. Refresh the app in your browser.

### Field-by-field

| Field | Meaning |
|-------|---------|
| `id` | A unique short name with no spaces, e.g. `"stonehenge"`. |
| `name` | The display name shown in the panel. |
| `category` | `"monument"`, `"settlement"`, or `"precursor-hypothesis"`. Controls the marker colour. |
| `lat`, `lon` | Latitude and longitude in decimal degrees. Tip: right-click a spot in Google Maps to copy them. |
| `builtYear` | A **signed** calendar year. **Negative = BCE**, positive = CE. e.g. `-9500` is 9500 BCE. The marker appears once the timeline reaches this date. |
| `builtYearLabel` | The human-friendly date text shown in the panel, e.g. `"c. 9500 BCE"`. |
| `consensusSummary` | The mainstream, evidence-based description. |
| `significance` | One or two sentences on why it matters. |
| `keyFacts` | A list of short bullet points. |
| `links` | A list of `{ "label": ..., "url": ... }` web links (Wikipedia, UNESCO, etc.). |
| `alternative` *(optional)* | A clearly-flagged contested hypothesis. Has `proponent`, `claim`, `note` (the reality check), and its own `links`. Use this for fringe/alternative claims so they are never mistaken for established fact. |

### A note on accuracy

Chronos Earth always shows the **mainstream scholarly consensus first**. Contested
or fringe ideas (such as Graham Hancock's "lost Ice Age civilization") go in the
`alternative` block, which the app renders with a visible "contested hypothesis"
warning. Please keep that separation when adding your own entries.

## `battles.json` — Wars & battles layer

Each battle becomes a ⚔ marker on the globe and a pin on the timeline. To add
one, copy an existing entry and edit it (the fields mirror the sites above,
plus `belligerents`, `victor`, `outcome`, `casualties`).

### Commander portraits (`commanders`)

Each battle can list its commanders:

```json
"commanders": [
  { "name": "Duke of Wellington", "side": 1, "wiki": "Arthur Wellesley, 1st Duke of Wellington" },
  { "name": "Napoleon",           "side": 2, "wiki": "Napoleon" }
]
```

- `side` is `1` or `2`, matching `belligerents.side1` / `side2`.
- `wiki` is the **English Wikipedia article title** (what appears after
  `/wiki/` in the address bar, with spaces instead of underscores).

After adding commanders, run this once in a terminal so their portrait images
are downloaded into `portraits/`:

```
node scripts/fetch-portraits.mjs
```

Commanders whose article has no usable image automatically get an initials
avatar instead — nothing breaks.

## `battle-views.json` + `battlemaps/` — animated battle views

Battles with `"hasBattleView": true` also have phase-by-phase animation data in
`battle-views.json`. A real period map can be overlaid behind the animation
(and draped over the 3D battlefield): maps live in `battlemaps/` and are
downloaded from Wikimedia Commons by:

```
node scripts/fetch-battle-maps.mjs
```

To choose a specific map for a battle, add its Commons file name to the
`CANDIDATES` list at the top of that script and re-run it.

## `fauna.json` — Prehistoric life layer

Animals that appear on the globe while the timeline is inside their date range
(`fromMa` = older bound, `toMa` = younger bound, in millions of years). Each
entry's `lon`/`lat` is a famous modern fossil site; the `track` is that spot's
position on the *reconstructed* ancient continents. After adding an animal, run:

```
node scripts/fetch-fauna-paleo.mjs
```

## `tours.json` — Story tours

Guided journeys: each step moves the timeline (`year`, negative = BCE, or `ma`
for deep time), flies the camera to `lon`/`lat`/`altitude`, shows its `title`
and `text` (which the 🔊 voice button reads aloud), and can open a battle panel
with `battleId`. Copy a tour to make your own.

## `campaigns.json` — War front lines

Animated fronts/empire extents drawn on the globe (see the `_comment` inside
the file for the format). Includes Napoleon 1812, both World-War fronts,
Alexander's conquests, the Mongol conquests, and Rome's rise and fall.
