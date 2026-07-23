# 🌍 Chronos Earth

An interactive 3D globe for exploring **250 million years of Earth and human history** in your web browser. Drag a timeline from the age of Pangea to today and watch:

- **Continents drift, split and collide** (real plate-reconstruction data).
- **Empires and borders rise, shift and fall** across recorded history.
- **Famous battles** appear at the right time and place — click to read about them, or open an animated **2D battle map**, or a full **3D battlefield** (for Hastings and Waterloo).
- **Ancient monuments** like Göbekli Tepe, with mainstream facts and clearly-labelled alternative theories.

Built with CesiumJS (globe), Three.js (3D battles), React, TypeScript and Vite. **No account, API key, or payment is required** — it runs entirely for free.

---

## 🖥️ Part 1 — Run it on your own computer

You only need **Node.js** installed (a free program that runs the website locally).

### One-time setup

1. **Install Node.js** if you don't have it: go to <https://nodejs.org> and install the "LTS" version. (You already have it if `node --version` prints a number in a terminal.)
2. Open a **terminal / PowerShell** in this project folder:
   `D:\SkyDrive\Pen Drive\WEBSITES\ChronosEarth`
   *(Tip: in Windows File Explorer, type `powershell` in the address bar while inside the folder.)*
3. Type this once and press Enter (it downloads the building blocks — takes a minute):
   ```
   npm install
   ```

### Every time you want to use it

1. In that terminal, type:
   ```
   npm run dev
   ```
2. It prints a link like **http://localhost:5173** — open it in Chrome, Firefox or Edge.
3. To stop it, click the terminal and press **Ctrl + C**.

That's it. Drag the timeline at the bottom, press **▶ Play**, click battle markers and the ⚔ pins, toggle layers on the right, and use the search box at the top.

---

## ☁️ Part 2 — Put it online for free

First, build the finished website:

```
npm run build
```

This creates a **`dist`** folder containing the complete website. Now pick one of these free hosts:

### Option A — Netlify (easiest, no coding)

1. Go to <https://app.netlify.com/drop>.
2. Drag the **`dist`** folder onto the page.
3. Netlify gives you a public link within seconds. Done!

### Option B — Vercel

1. Put this project on GitHub (see below), then go to <https://vercel.com> and "Import" the repository.
2. Vercel auto-detects Vite. Click **Deploy**.

### Option C — GitHub Pages

1. Create a free account at <https://github.com> and make a new repository.
2. Upload this project to it (GitHub's website has an "upload files" button, or use GitHub Desktop).
3. In the repo: **Settings → Pages**, and either use a GitHub Action for Vite, or push the contents of the `dist` folder to a branch named `gh-pages`.

> The project is already configured with `base: './'` so it works in a sub-folder, which is what GitHub Pages needs.

---

## ✍️ Part 3 — Add your own history (no coding needed)

All the historical content lives as **plain text JSON files** in the **`public/data`** folder. You can edit these in Notepad. After saving, refresh the browser to see changes.

### Add a battle

Open `public/data/battles.json`, copy one of the entries inside `"battles": [ ... ]`, paste it as a new entry (with a comma between entries), and change the values:

```json
{
  "id": "my-battle",
  "name": "Battle of Somewhere",
  "year": 1500,                       // negative number = BCE, e.g. -216
  "dateLabel": "1500 CE",
  "lat": 48.8, "lon": 2.3,            // from Google Maps (right-click → copy)
  "belligerents": { "side1": "Army A", "side2": "Army B" },
  "victor": "Army A victory",
  "outcome": "What happened in one line.",
  "significance": "Why it mattered, in a sentence or two.",
  "casualties": "~1,000 dead (estimate)",
  "links": [ { "label": "Wikipedia", "url": "https://en.wikipedia.org/wiki/..." } ]
}
```

It will automatically appear as a ⚔ marker on the globe and a pin on the timeline.

### Add an ancient site / monument

Open `public/data/ancient-sites.json` and follow the same copy-paste pattern. The full field guide is in **`public/data/README.md`**.

### Give a battle an animated battle map

1. In `battles.json`, add `"hasBattleView": true` to the battle.
2. In `public/data/battle-views.json`, add an entry whose key matches the battle's `id`, with `phases` (narration) and `units` (positions). Copy an existing one to see the format. The on-screen coordinates run 0–100 left-to-right and 0–70 top-to-bottom.

### Add an animated war front line

`public/data/campaigns.json` holds the moving front lines (Napoleon 1812, the
World Wars). Each campaign has dated `keyframes`; each keyframe has a `front`
(the bright line) and an `area` (the shaded controlled territory) as lists of
`[longitude, latitude]` points. As you scrub the timeline through the war's
years, the globe snaps to the nearest keyframe, so the front appears to move.
Copy a campaign and edit the dates and coordinates to add your own.

### Change the eras on the timeline

Era labels (Triassic, Bronze Age, Medieval…) live in code at `src/lib/timeScale.ts` in the `ERAS` list — each has a name, start/end (in years before present) and a colour.

---

## 🔄 Part 4 — Refresh the map data (optional, advanced)

The continental-drift frames and historical borders are **already downloaded** into `public/data`. If you ever want to re-fetch or change them:

```
node scripts/fetch-paleo.mjs      # continental drift frames (GPlates)
node scripts/fetch-borders.mjs    # historical borders (historical-basemaps)
```

These need an internet connection. The app works offline using the bundled copies.

---

## 🧪 Tests

```
npm test
```

This checks the timeline math (date ↔ scrubber position) and validates that the data files are well-formed.

---

## 📚 Data sources & credits

See the in-app **About** panel (the "ℹ About & sources" button in the Layers box) for full credits, including the GPlates Web Service, the historical-basemaps dataset, Natural Earth imagery, CesiumJS and Three.js.

---

## ⚖️ Copyright & licence

© 2026 Spencer Austin.

The **software** — the app, the harvest scripts, the model workshop — is released under the
[Apache License 2.0](LICENSE). Use it, change it, build on it, sell it if you like; just keep the
licence and the credits with it.

The **historical data** bundled under `public/data/` is a separate matter. It arrives under the
licences its makers chose, and this project neither can nor tries to relicense it. Most notably the
historical borders dataset is **ODbL**, which is *share-alike*: if you improve that data and pass it
on, it has to stay open on the same terms. Wikipedia article text is CC BY-SA and is linked to
rather than copied.

Every source and its licence is listed in [NOTICE](NOTICE), and again inside the app on the About
panel — so a visitor can see it without reading the repository.

---

## Project structure (for the curious)

```
public/data/          ← all historical content (JSON) — edit these
  battles.json
  ancient-sites.json
  battle-views.json
  paleo/              ← continental drift frames
  borders/            ← historical border snapshots
src/
  lib/timeScale.ts    ← the logarithmic timeline math (+ tests)
  lib/data.ts         ← loads the JSON files
  components/         ← Globe, Timeline, InfoPanel, BattleView, Battle3D…
scripts/              ← one-off data download scripts
```
