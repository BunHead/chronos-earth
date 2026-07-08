/**
 * render-model.mjs — the AI modeller's RENDER STEP.
 *
 * Drives a headless Chromium (Puppeteer) over the standalone render harness and
 * screenshots one buildModel() archetype from three canonical angles — a 3/4
 * hero view, a top-down (for bullseye/plan shapes) and an eye-level side (which
 * catches floating / toppled elements). The PNGs feed the vision adversaries
 * (Historical, Legibility) — and let us verify a model WITHOUT the Cesium app.
 *
 * Needs the Vite dev server running (npm run dev). Then:
 *   node scripts/render-model.mjs <model> [outDir] [title]
 *   e.g. node scripts/render-model.mjs rings ./render-out "Richat"
 */
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const model = process.argv[2] || 'rings';
const outDir = process.argv[3] || './render-out';
const title = process.argv[4] || '';
const sea = process.argv[5]; // optional sea-plane level (Atlantis drowning)
const build = process.env.BUILD_FRAC; // optional construction fraction (Giza steps)
const BASE = `${process.env.RENDER_BASE || 'http://localhost:5173'}/render-harness.html`;
const ANGLES = ['3q', 'top', 'side'];

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('  [page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('  [console]', m.text()); });

  for (const angle of ANGLES) {
    const url = `${BASE}?model=${encodeURIComponent(model)}&angle=${angle}&title=${encodeURIComponent(title)}${sea != null ? `&sea=${sea}` : ''}${build != null ? `&build=${build}` : ''}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('window.__ready === true', { timeout: 25000 });
    const canvas = await page.$('canvas');
    const out = join(outDir, `${model}-${angle}.png`);
    await canvas.screenshot({ path: out });
    console.log('rendered', angle, '->', out);
  }
} finally {
  await browser.close();
}
console.log('done.');
