/**
 * shader-trace.mjs — WHICH shader programs does Play compile? (roadmap 13)
 *
 * play-probe counts programs; this names them. It wraps Cesium's shader cache
 * on the dev server (window.__viewer), presses Play from deep time, and lists
 * every program created after the warm-up, by the first lines of its defines
 * — enough to tell globe-surface variants from labels, polylines, models…
 *
 *   node scripts/shader-trace.mjs [--gpu] [--secs 70] [--base http://localhost:5173]
 */
import puppeteer from 'puppeteer';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:5173');
const SECS = Number(arg('--secs', '70'));
const gpu = process.argv.includes('--gpu');
const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 240000,
  args: gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox'] : ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto(`${BASE}/?time=300000000&cam=20,30,15000000,0,-90`, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 12000)); // past the 5 s warm-up
await page.evaluate(() => {
  const cache = window.__viewer.scene.context.shaderCache;
  window.__newShaders = [];
  const orig = cache.getShaderProgram.bind(cache);
  cache.getShaderProgram = (opts) => {
    const n0 = cache._numberOfShaders;
    const sp = orig(opts);
    if (cache._numberOfShaders > n0) {
      const vs = opts.vertexShaderSource;
      const fs = opts.fragmentShaderSource;
      const defs = [...(vs?.defines ?? []), ...(fs?.defines ?? [])].filter((d) => !/^(OUTPUT_DECLARATION|LOG_DEPTH)/.test(d));
      const src = (fs?.sources ?? []).join('').slice(0, 400).replace(/\s+/g, ' ');
      const kind = /TEXTURE_UNITS|u_dayTextures/.test(src + defs.join(' ')) ? 'globe-surface' : (src.match(/czm_\w+|v_\w+/)?.[0] ?? 'other');
      window.__newShaders.push({ t: Math.round(performance.now() / 1000), kind, defs: defs.slice(0, 8).join(' ') });
    }
    return sp;
  };
  [...document.querySelectorAll('button')].find((b) => /Play/.test(b.textContent)).click();
});
await new Promise((r) => setTimeout(r, SECS * 1000));
const list = await page.evaluate(() => window.__newShaders);
await browser.close();
const byKind = {};
for (const s of list) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
console.log(`${list.length} programs compiled during ${SECS}s of Play:`, JSON.stringify(byKind));
for (const s of list) console.log(`  t=${s.t}s ${s.kind}: ${s.defs}`);
