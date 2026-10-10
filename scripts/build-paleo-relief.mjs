/**
 * build-paleo-relief.mjs — the drifting continents, DRAWN.
 *
 * WHY. Deep time used to be flat green land on flat blue sea (vector
 * coastlines). The Captain asked for it to look drawn — mountains, snow, seas
 * (9 Oct 2026). This paints one shaded-relief map per 5-million-year step
 * from Christopher Scotese's PALEOMAP paleo-DEMs: the height of the land and
 * the depth of the sea, 540 Ma to today, on a 1° grid.
 *
 *   Scotese, C.R., and Wright, N.M., 2018. PALEOMAP Paleodigital Elevation
 *   Models (PaleoDEMS) for the Phanerozoic. Zenodo 5460860. CC BY 4.0.
 *
 * WHAT IS DATA AND WHAT IS STYLE. Every height and depth is the DEM's. The
 * colours are a hypsometric ramp (deep ocean → shelf → lowland → upland →
 * mountain → snow), the light is a hillshade from the north-west, and a faint
 * coastline ink and paper grain make it read as a drawn map. Snow is shown
 * ONLY above 4,000 m, which is height, not climate: polar ice caps and deserts
 * depend on each era's climate, which a DEM does not record, so neither is
 * guessed (the same rule as "never invent borders").
 *
 * PLATE MODEL: these maps are PALEOMAP's. The animals' drift tracks must use
 * the same model (scripts/fetch-fauna-paleo.mjs, MODEL) or they stand in the sea.
 *
 * Input:  scripts/data/paleodem/PaleoDEMS_long_lat_elev_csv_v2.csv/MapNN_XXXMa.csv
 *         (download once: zenodo.org/records/5460860, PaleoDEMS_long_lat_elev_csv_v2.zip)
 * Output: public/data/paleo-relief/relief-<Ma>.webp + manifest.json
 *
 *   node scripts/build-paleo-relief.mjs [--only 250,540]
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'data', 'paleodem', 'PaleoDEMS_long_lat_elev_csv_v2.csv');
const OUT = join(__dirname, '..', 'public', 'data', 'paleo-relief');
const W = 1440;
const H = 720;
const QUALITY = 0.84;
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i > 0 ? new Set(process.argv[i + 1].split(',').map(Number)) : null;
})();

/** Parse one DEM CSV into a 361×181 grid, row 0 = 90°N, column 0 = 180°W. */
export function parseDem(text) {
  const grid = new Float32Array(361 * 181);
  // About half the files end their lines with a bare \r (old Mac style);
  // splitting on \n alone read each of those as ONE line and drew a blank sea.
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (!line || line[0] === '#') continue;
    const [lo, la, el] = line.split(',').map(Number);
    if (!Number.isFinite(el)) continue;
    const x = Math.round(lo + 180);
    const y = Math.round(90 - la);
    if (x < 0 || x > 360 || y < 0 || y > 180) continue;
    grid[y * 361 + x] = el;
  }
  return grid;
}

/** Bilinear elevation at fractional grid coordinates. */
function sample(grid, gx, gy) {
  const x0 = Math.max(0, Math.min(359, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(179, Math.floor(gy)));
  const fx = gx - x0;
  const fy = gy - y0;
  const a = grid[y0 * 361 + x0];
  const b = grid[y0 * 361 + x0 + 1];
  const c = grid[(y0 + 1) * 361 + x0];
  const d = grid[(y0 + 1) * 361 + x0 + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Hypsometric ramp: [elevation m, colour]. */
const OCEAN = [[-6500, '#0a1f3c'], [-4000, '#10305a'], [-2000, '#1b4878'], [-500, '#2b6a98'], [-150, '#4c90b0'], [0, '#86c2c4']].map(([e, c]) => [e, hex(c)]);
const LAND = [[0, '#7a9e58'], [250, '#8fa962'], [700, '#b4ad76'], [1300, '#b29668'], [2100, '#9a7c5d'], [3000, '#8d8074'], [3700, '#b7b1aa'], [4000, '#f3f3f1']].map(([e, c]) => [e, hex(c)]);
function ramp(stops, e) {
  if (e <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (e <= stops[i][0]) {
      const t = (e - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return stops[i - 1][1].map((v, k) => v + (stops[i][1][k] - v) * t);
    }
  }
  return stops[stops.length - 1][1];
}

/** Deterministic paper grain, so a rebuild is byte-stable. */
function grain(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Paint one DEM into RGBA pixels. */
export function paint(grid) {
  const px = new Uint8ClampedArray(W * H * 4);
  const elev = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const gy = ((y + 0.5) / H) * 180;
    for (let x = 0; x < W; x++) elev[y * W + x] = sample(grid, ((x + 0.5) / W) * 360, gy);
  }
  // A pixel is ~28 km across at 1440 wide; relief is exaggerated so mountain
  // belts read at globe scale. Light from the north-west, as on paper maps.
  const Z = 0.0009;
  for (let y = 0; y < H; y++) {
    const coslat = Math.max(0.2, Math.cos(((y + 0.5) / H - 0.5) * Math.PI));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = elev[i];
      const l = elev[y * W + ((x - 1 + W) % W)];
      const r = elev[y * W + ((x + 1) % W)];
      const u = elev[Math.max(0, y - 1) * W + x];
      const d = elev[Math.min(H - 1, y + 1) * W + x];
      const dzdx = ((r - l) / 2) / coslat;
      const dzdy = (d - u) / 2;
      // Brighter on slopes facing the light (up-left), darker away from it.
      let shade = 1 + Z * (-dzdx - dzdy) * (e > 0 ? 1 : 0.35);
      shade = Math.max(0.55, Math.min(1.35, shade));
      let c = e > 0 ? ramp(LAND, e) : ramp(OCEAN, e);
      // Coastline ink: a fine darker line where land meets sea.
      const coast = (e > 0) !== (l > 0) || (e > 0) !== (r > 0) || (e > 0) !== (u > 0) || (e > 0) !== (d > 0);
      const g = 0.97 + grain(x, y) * 0.06;
      const k = shade * g * (coast && e > 0 ? 0.72 : 1);
      px[i * 4] = c[0] * k;
      px[i * 4 + 1] = c[1] * k;
      px[i * 4 + 2] = c[2] * k;
      px[i * 4 + 3] = 255;
    }
  }
  return px;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SRC)).filter((f) => /_(\d+)Ma\.csv$/.test(f));
  const maps = files
    .map((f) => ({ f, ma: Number(/_(\d+)Ma\.csv$/.exec(f)[1]) }))
    .sort((a, b) => a.ma - b.ma)
    .filter((m) => !only || only.has(m.ma));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  const frames = [];
  let total = 0;
  for (const { f, ma } of maps) {
    const grid = parseDem(await readFile(join(SRC, f), 'utf8'));
    const px = paint(grid);
    const b64 = Buffer.from(px.buffer).toString('base64');
    const dataUrl = await page.evaluate(
      (b64, w, h, q) => {
        const bin = atob(b64);
        const arr = new Uint8ClampedArray(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const c = document.getElementById('c');
        c.width = w;
        c.height = h;
        c.getContext('2d').putImageData(new ImageData(arr, w, h), 0, 0);
        return c.toDataURL('image/webp', q);
      },
      b64, W, H, QUALITY,
    );
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = `relief-${ma}.webp`;
    await writeFile(join(OUT, file), buf);
    total += buf.length;
    frames.push({ timeMa: ma, file });
    process.stdout.write(`${ma} Ma ${(buf.length / 1024).toFixed(0)} KB · `);
  }
  await browser.close();
  if (!only) {
    await writeFile(
      join(OUT, 'manifest.json'),
      JSON.stringify({
        model: 'PALEOMAP',
        source: 'Scotese & Wright (2018), PALEOMAP PaleoDEMs, Zenodo 5460860, CC BY 4.0',
        stepMa: 5,
        frames,
      }, null, 1),
    );
  }
  console.log(`\n${frames.length} maps, ${(total / 1e6).toFixed(1)} MB`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
