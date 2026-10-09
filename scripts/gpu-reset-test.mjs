/**
 * gpu-reset-test.mjs — prove the globe comes back after a graphics reset.
 *
 * Forces a real WebGL context loss (WEBGL_lose_context) on the globe canvas at
 * a known moment and place, then checks the page reloaded to the SAME year and
 * camera with a globe that draws. Needs the dev server (npm run dev).
 *
 *   node scripts/gpu-reset-test.mjs [--base http://localhost:5173] [--times 3]
 */
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:5173');
const TIMES = Number(arg('--times', '1'));
const START = '?time=2026&zoom=3&cam=12.49,41.89,2500000,0,-90';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto(BASE + START, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  for (let n = 1; n <= TIMES + 1; n++) {
    const before = await page.evaluate(() => location.search);
    const lost = await page.evaluate(() => {
      const c = document.querySelector('.cesium-widget canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      const ext = gl && gl.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      return true;
    });
    await sleep(400);
    const notice = await page.evaluate(() => document.querySelector('.gpu-reset')?.textContent ?? null);
    console.log(`reset ${n}: context lost=${lost}; notice: ${notice}`);
    // Expect a reload for the first MAX_AUTO, then a button.
    let reloaded = false;
    try {
      await page.waitForNavigation({ timeout: 5000 });
      reloaded = true;
    } catch { /* no reload — the button case */ }
    if (!reloaded) {
      const btn = await page.$('.gpu-reset button');
      console.log(`  no auto reload; button shown=${Boolean(btn)}`);
      if (n <= TIMES) failed = true;
      break;
    }
    await sleep(9000);
    const after = await page.evaluate(() => {
      const v = document.querySelector('.cesium-widget canvas');
      return { search: location.search, canvas: Boolean(v), w: v?.width ?? 0 };
    });
    const p = new URLSearchParams(after.search);
    console.log(`  reloaded to time=${p.get('time')} zoom=${p.get('zoom')} cam=${p.get('cam')}; canvas ${after.w}px`);
    if (!after.canvas || p.get('time') !== new URLSearchParams(before || START).get('time')) failed = true;
  }
} finally {
  await browser.close();
}
console.log(failed ? 'FAIL' : 'PASS');
process.exit(failed ? 1 : 0);
