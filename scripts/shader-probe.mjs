/**
 * shader-probe.mjs — count the globe-surface shader variants Cesium compiles
 * while the timeline plays, and how long each one blocked the page.
 *
 *   node scripts/shader-probe.mjs http://localhost:5173 "?time=2600" --speed 4× --secs 60
 *   node scripts/shader-probe.mjs https://bunhead.github.io/chronos-earth "" --secs 240
 *
 * Always the real D3D11 backend (what the Captain's GTX 1070 sees) — the
 * playback freeze is the driver compiling one globe shader per distinct
 * `TEXTURE_UNITS n` (one per imagery-texture count on a tile) and per flag
 * mix; under ANGLE/D3D11 a 25-texture variant can take minutes to compile.
 * Each link is timed at the first LINK_STATUS read, which is where Chrome
 * waits for the GPU process. Prints every globe variant and a summary.
 */
import puppeteer from 'puppeteer';
const [base, query = ''] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const speed = arg('--speed', null);
const secs = +arg('--secs', 90);
const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 600000,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.evaluateOnNewDocument(() => {
  window.__sh = [];
  const src = new WeakMap();
  const attached = new WeakMap();
  const pending = new WeakMap();
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const P = C.prototype;
    const ss = P.shaderSource, at = P.attachShader, lp = P.linkProgram, gp = P.getProgramParameter;
    P.shaderSource = function (s, text) { src.set(s, text); return ss.call(this, s, text); };
    P.attachShader = function (p, s) { (attached.get(p) || attached.set(p, []).get(p)).push(s); return at.call(this, p, s); };
    P.linkProgram = function (p) { pending.set(p, performance.now()); return lp.call(this, p); };
    P.getProgramParameter = function (p, name) {
      const t0 = pending.get(p);
      const r = gp.call(this, p, name);
      if (t0 !== undefined && name === this.LINK_STATUS) {
        pending.delete(p);
        const text = (attached.get(p) || []).map((s) => src.get(s) || '').join('\n');
        const m = /#define TEXTURE_UNITS (\d+)/.exec(text);
        window.__sh.push({ at: Math.round(t0), ms: Math.round(performance.now() - t0), units: m ? +m[1] : null, kb: Math.round(text.length / 1024) });
      }
      return r;
    };
  }
});
const url = base.replace(/\/+$/, '') + '/' + query;
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise((r) => setTimeout(r, 8000));
const limits = await page.evaluate(() => ({
  limit: window.Cesium?.ContextLimits?.maximumTextureImageUnits,
}));
console.log('page', url, 'texture-unit limit seen by Cesium:', limits.limit);
await page.evaluate((speed) => {
  if (speed) {
    const sp = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text === speed));
    // React tracks a select's value, so set it through the native setter.
    if (sp) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sp, [...sp.options].find((o) => o.text === speed).value);
      sp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  [...document.querySelectorAll('button')].find((b) => /Play/.test(b.textContent)).click();
}, speed);
const t0 = Date.now();
let seen = 0, worstLag = 0;
while (Date.now() - t0 < secs * 1000) {
  const ts = Date.now();
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const { sh, yr } = await page.evaluate(() => ({ sh: window.__sh, yr: document.querySelector('.era')?.textContent?.trim().slice(0, 24) }));
    const lag = Date.now() - ts - 2000;
    worstLag = Math.max(worstLag, lag);
    for (const s of sh.slice(seen)) if (s.units !== null || s.ms > 200) console.log(`  +${Math.round((Date.now() - t0) / 1000)}s  ${yr}  TEXTURE_UNITS ${s.units ?? '-'}  ${s.kb} KB  ${s.ms} ms`);
    seen = sh.length;
    if (lag > 1000) console.log(`  page unresponsive for ${lag} ms near ${yr}`);
  } catch (e) { console.log('sample failed:', e.message.slice(0, 100)); }
}
const sh = await page.evaluate(() => window.__sh);
const globe = sh.filter((s) => s.units !== null);
const byUnits = {};
for (const s of globe) byUnits[s.units] = (byUnits[s.units] || 0) + 1;
console.log(JSON.stringify({
  programs: sh.length,
  globeVariants: globe.length,
  maxUnits: Math.max(0, ...globe.map((s) => s.units)),
  byUnits,
  globeMsTotal: globe.reduce((a, s) => a + s.ms, 0),
  globeMsWorst: Math.max(0, ...globe.map((s) => s.ms)),
  worstSampleLagMs: worstLag,
}));
await browser.close();
