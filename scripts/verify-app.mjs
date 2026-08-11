/**
 * verify-app.mjs — LOOK AT THE REAL APP, in a browser that is actually running.
 *
 * The companion to `render-model.mjs`: that one verifies a monument, this one
 * verifies the app around it.
 *
 * WHY THIS EXISTS, and it cost a whole day to learn. The agent's Browser pane
 * runs the page as a HIDDEN tab, and a hidden tab lies about almost everything
 * that matters here:
 *
 *   • requestAnimationFrame never fires, so Cesium's render loop never runs and
 *     the globe is frozen at whatever it last drew.
 *   • setInterval is throttled to ~1/s, and after five minutes hidden to
 *     ~1/minute — so a thirty-second play-through takes ten hours.
 *   • The WebGL buffer reads back BLANK outside the frame that drew it, which
 *     is a very convincing way to conclude a working overlay is invisible.
 *   • Camera flights never advance, because tweens are driven from
 *     `scene.initializeFrame()` which only the render loop calls.
 *
 * A headless Chromium page is a FOREGROUND page: real rAF, real timers, real
 * flights. Every conclusion this script reports is one you can trust.
 *
 * Needs the dev server running (npm run dev). Then:
 *
 *   node scripts/verify-app.mjs --shot out.png
 *   node scripts/verify-app.mjs --url "?time=9&zoom=1&cam=-106.3,42.85,9000000,0,-90" \
 *        --click ".app-menu-btn" --menu "Sky and Weather" --shot sky.png
 *   node scripts/verify-app.mjs --probe --shot globe.png     # raw globe canvas
 *
 * Flags:
 *   --base <url>     dev server (default http://localhost:5173, or PORT env)
 *   --url <query>    query string appended to the base (share-link params)
 *   --size WxH       viewport, default 1400x900
 *   --wait <ms>      settle time after load, default 9000 (tiles must stream)
 *   --click <sel>    click a selector (repeatable, in order)
 *   --menu <text>    open the ⋯ menu and click the item matching this text
 *   --eval <js>      evaluate an expression in the page and print the result
 *   --probe          print globe diagnostics (camera, entities, clock, frames)
 *   --shot <file>    screenshot the whole page
 *   --globe <file>   screenshot the RAW Cesium canvas only (no UI over it)
 *   --hold <ms>      extra wait before capturing (let a flight or sweep run)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import puppeteer from 'puppeteer';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const all = (f) => args.map((a, i) => (a === f ? args[i + 1] : null)).filter(Boolean);

const BASE = val('--base', process.env.VERIFY_BASE || `http://localhost:${process.env.PORT || 5173}`);
const QUERY = val('--url', '');
const [W, H] = val('--size', '1400x900').split('x').map(Number);
const WAIT = +val('--wait', 9000);
const HOLD = +val('--hold', 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = async (file, buf) => {
  await mkdir(dirname(file), { recursive: true }).catch(() => {});
  await writeFile(file, buf);
  console.log('wrote', file);
};

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('  [page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('  [console]', m.text()); });

  const url = QUERY ? `${BASE}/${QUERY.startsWith('?') ? QUERY : `?${QUERY}`}` : `${BASE}/`;
  console.log('loading', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(WAIT); // the globe must stream its imagery before it means anything

  // Count real frames, so "the globe is frozen" is a measurement not a guess.
  await page.evaluate(() => {
    window.__frames = 0;
    window.__viewer?.scene.postRender.addEventListener(() => { window.__frames++; });
    document.querySelector('.welcome-go')?.click();
  });
  await sleep(600);

  const menu = val('--menu', null);
  if (menu) {
    await page.evaluate(() => document.querySelector('.app-menu-btn')?.click());
    await sleep(500);
    const ok = await page.evaluate((text) => {
      const item = [...document.querySelectorAll('.app-menu-item')]
        .find((b) => b.textContent.includes(text));
      if (item) { item.click(); return true; }
      return false;
    }, menu);
    console.log(`menu "${menu}":`, ok ? 'clicked' : 'NOT FOUND');
    await sleep(1200);
  }

  for (const sel of all('--click')) {
    const ok = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (el) { el.click(); return true; }
      return false;
    }, sel);
    console.log(`click ${sel}:`, ok ? 'ok' : 'NOT FOUND');
    await sleep(1500);
  }

  if (HOLD) { console.log(`holding ${HOLD}ms…`); await sleep(HOLD); }

  if (has('--probe')) {
    const p = await page.evaluate(() => {
      const v = window.__viewer, C = window.__Cesium;
      if (!v) return { error: 'no __viewer — dev probes only exist on the dev server, not a production build' };
      const c = v.camera.positionCartographic;
      const ents = v.entities.values.filter((e) => e.ellipse);
      return {
        frames: window.__frames,
        requestRenderMode: v.scene.requestRenderMode,
        camera: {
          lon: +C.Math.toDegrees(c.longitude).toFixed(2),
          lat: +C.Math.toDegrees(c.latitude).toFixed(2),
          km: Math.round(c.height / 1000),
        },
        clock: C.JulianDate.toIso8601(v.clock.currentTime).slice(0, 19),
        lighting: v.scene.globe.enableLighting,
        tilesLoaded: v.scene.globe.tilesLoaded,
        shadowEntities: ents.map((e) => {
          const pos = e.position?.getValue(v.clock.currentTime);
          const g = pos ? C.Cartographic.fromCartesian(pos) : null;
          const scr = pos ? C.SceneTransforms.worldToWindowCoordinates(v.scene, pos) : null;
          return {
            show: e.show,
            lon: g ? +C.Math.toDegrees(g.longitude).toFixed(1) : null,
            lat: g ? +C.Math.toDegrees(g.latitude).toFixed(1) : null,
            screen: scr ? [Math.round(scr.x), Math.round(scr.y)] : null,
            radiusKm: Math.round(e.ellipse.semiMinorAxis.getValue(v.clock.currentTime) / 1000),
          };
        }),
      };
    });
    console.log(JSON.stringify(p, null, 1));
  }

  const expr = val('--eval', null);
  if (expr) console.log(JSON.stringify(await page.evaluate(expr), null, 1));

  const shot = val('--shot', null);
  if (shot) await save(shot, await page.screenshot());

  // The RAW globe, copied on postRender — the ONLY moment the WebGL buffer is
  // readable, since Cesium does not ask for preserveDrawingBuffer. Read it a
  // frame later and you get a cleared buffer and a false conclusion.
  const globeShot = val('--globe', null);
  if (globeShot) {
    const dataUrl = await page.evaluate(() => new Promise((res) => {
      const v = window.__viewer;
      if (!v) return res(null);
      const off = v.scene.postRender.addEventListener(() => {
        const cv = document.createElement('canvas');
        cv.width = v.scene.canvas.width;
        cv.height = v.scene.canvas.height;
        cv.getContext('2d').drawImage(v.scene.canvas, 0, 0);
        off();
        res(cv.toDataURL('image/png'));
      });
      v.scene.requestRender();
    }));
    if (dataUrl) await save(globeShot, Buffer.from(dataUrl.split(',')[1], 'base64'));
    else console.error('no __viewer — --globe needs the dev server');
  }
} finally {
  await browser.close();
}
