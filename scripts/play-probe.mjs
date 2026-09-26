/**
 * play-probe.mjs — press Play and watch the main thread, every 2 seconds.
 *
 * verify-app.mjs looks at a still page; this one watches the timeline MOVE,
 * which is where the globe does its heaviest work. Each sample reports frames
 * drawn, long tasks (main-thread blocks over 50 ms), heap and entity count.
 *
 *   node scripts/play-probe.mjs http://localhost:5173 "?time=3000&cam=20,40,6000000,0,-90"
 *   node scripts/play-probe.mjs https://bunhead.github.io/chronos-earth "" --gpu --speed 4×
 *
 * --gpu uses the real D3D11 backend (what the Captain sees); without it,
 * software GL — whose frame rate means nothing, but whose long tasks do.
 * A sample that times out is itself the finding: on 26 Sept 2026 the page
 * stopped answering for minutes mid-playback, and pausing the JS engine then
 * showed no script running — the block was in the graphics driver (globe
 * shaders compiling for D3D), not in our code.
 */
import puppeteer from 'puppeteer';
const [base, query = ''] = process.argv.slice(2);
const gpu = process.argv.includes('--gpu');
const si = process.argv.indexOf('--speed');
const speed = si > 0 ? process.argv[si + 1] : null;
const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 240000,
  args: gpu
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
page.on('pageerror', (e) => console.log('[page error]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.evaluateOnNewDocument(() => {
  window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  window.__frames = 0;
  const tick = () => { window.__frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.goto(base.replace(/\/+$/, '') + '/' + query, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 9000));
const sample = () => page.evaluate(() => {
  const now = performance.now();
  const lt = window.__lt.filter(([s]) => s > now - 2000);
  const yr = document.querySelector('.timeline-year, .tl-year, [class*=year]')?.textContent?.trim().slice(0, 30);
  return { t: Math.round(now / 1000), frames: window.__frames, ltMs: Math.round(lt.reduce((a, [, d]) => a + d, 0)), ltMax: Math.round(Math.max(0, ...lt.map(([, d]) => d))), yr, heap: Math.round(performance.memory.usedJSHeapSize / 1e6), ents: window.__viewer?.entities.values.length };
});
console.log('idle', JSON.stringify(await sample()));
await page.evaluate((speed) => {
  if (speed) {
    const sp = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.text === speed));
    if (sp) { sp.value = [...sp.options].find((o) => o.text === speed).value; sp.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  [...document.querySelectorAll('button')].find((b) => /Play/.test(b.textContent)).click();
}, speed);
let prevFrames = 0;
for (let i = 0; i < 12; i++) {
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const s = await sample();
    const lag = Date.now() - t0 - 2000;
    console.log(JSON.stringify({ ...s, fps: Math.round((s.frames - prevFrames) / ((Date.now() - t0) / 1000)), evalLagMs: lag }));
    prevFrames = s.frames;
  } catch (e) { console.log('sample failed:', e.message.slice(0, 100)); }
}
await browser.close();
