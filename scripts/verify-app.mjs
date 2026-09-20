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
 *   --film <n>x<ms>  capture n globe frames every ms — a TIME SERIES. Each
 *                    frame is saved as <--film-out>-NN.png and reported with
 *                    the shadow entities' pixel positions AND the measured
 *                    screen luminance at the umbra's own pixel against a ring
 *                    of reference pixels around it. This is how you find out
 *                    whether a moving thing is actually on screen, rather than
 *                    inferring it from a still.
 *   --film-out <p>   filename stem for --film (default ./film)
 *   --frames <ms>    measure frame timing ONLY (no profiler overhead) —
 *                    the instrument for "is it smoother", where --profile is
 *                    the instrument for "what is slow". Run it several times.
 *   --profile <ms>   record a real CPU profile for this long and print the
 *                    heaviest functions and files by SELF time, alongside the
 *                    frame timings measured over the same seconds. Use this
 *                    instead of guessing which layer is slow — ablation was
 *                    tried on the playback stutter and gave a clean negative.
 *   --profile-out <f> also write the raw .cpuprofile (opens in DevTools)
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

// SwiftShader (software WebGL) by default: reliable everywhere, and identical
// from run to run. But it is NOT the machine the Captain is looking at, and
// some faults only exist on a real GPU — a texture that uploads late will look
// perfect in software and flash white on hardware. `--gpu` switches to the real
// D3D11 backend for exactly those.
const browser = await puppeteer.launch({
  headless: 'new',
  args: has('--gpu')
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  // --cpu <n> throttles the processor n-fold, and --net slow-3g the connection.
  // This is how you test the Captain’s parents’ laptop without driving to
  // their house: a modern dev machine will run almost anything, which is
  // exactly why "works for me" is worthless as a performance claim.
  const cpu = +val("--cpu", 1);
  const slowNet = has("--net");
  if (cpu > 1 || slowNet) {
    const cdp = await page.createCDPSession();
    if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    if (slowNet)
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 300,
        downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
      });
    console.log(`throttled: cpu x${cpu}${slowNet ? ", slow 3G" : ""}`);
  }
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

  // --profile <ms> records a REAL CPU profile of whatever the app is doing
  // right now, and summarises it here. This exists because ablation — turning
  // layers off one at a time — gave a clean negative on the playback stutter:
  // 150-195 ms frames showed up in every configuration including borders-only.
  // A sampling profile does not care what you believe; it tells you which
  // function actually held the main thread.
  //
  //   node scripts/verify-app.mjs --cpu 6 --click ".btn.primary" --profile 8000
  //
  // --profile-out writes the raw .cpuprofile, loadable in Chrome DevTools'
  // Performance tab if you want the flame graph as well as the leaderboard.
  // --frames <ms> measures FRAME TIMING ONLY, with no profiler attached.
  //
  // Separate from --profile on purpose. The sampling profiler is what tells you
  // WHICH function is slow, but it costs something to run, so it is the wrong
  // instrument for answering "is it smoother now". This one just watches rAF.
  // Run it several times: over a short window the run-to-run spread on this
  // machine is larger than most effects you will be trying to measure, and a
  // single run has fooled at least two sessions of this project already.
  //
  //   node scripts/verify-app.mjs --base http://localhost:4173 --cpu 6 \
  //        --click ".btn.primary" --frames 20000
  const framesMs = +val('--frames', 0);
  if (framesMs) {
    console.log(`measuring frames for ${framesMs}ms…`);
    const stats = await page.evaluate((ms) => new Promise((resolve) => {
      const gaps = [];
      let prev = performance.now();
      const started = prev;
      const step = (t) => {
        gaps.push(t - prev);
        prev = t;
        if (t - started < ms) requestAnimationFrame(step);
        else {
          const g = gaps.slice(1); // first gap straddles the start
          const sorted = [...g].sort((a, b) => a - b);
          const pc = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
          const mean = g.reduce((a, b) => a + b, 0) / (g.length || 1);
          resolve({
            seconds: +((t - started) / 1000).toFixed(1),
            frames: g.length,
            fps: +(1000 / mean).toFixed(1),
            medianMs: +pc(50).toFixed(1),
            p95Ms: +pc(95).toFixed(1),
            p99Ms: +pc(99).toFixed(1),
            worstMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
            over50ms: g.filter((x) => x > 50).length,
            over100ms: g.filter((x) => x > 100).length,
          });
        }
      };
      requestAnimationFrame(step);
    }), framesMs);
    console.log(JSON.stringify(stats));
  }

  const profileMs = +val('--profile', 0);
  if (profileMs) {
    const cdp = await page.createCDPSession();
    await cdp.send('Profiler.enable');
    // 100 µs sampling: fine enough to catch a 3 ms layout, cheap enough not to
    // distort the thing being measured.
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 });

    // Long-task and frame timing measured IN THE PAGE alongside the profile, so
    // "the profile says X is hot" and "frames were janky" describe the same
    // seconds rather than two different runs.
    await page.evaluate(() => {
      window.__long = [];
      window.__frameGaps = [];
      try {
        window.__lo = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__long.push(Math.round(e.duration));
        });
        window.__lo.observe({ entryTypes: ['longtask'] });
      } catch { /* longtask unsupported — the profile still stands alone */ }
      let prev = performance.now();
      const step = (t) => {
        window.__frameGaps.push(+(t - prev).toFixed(1));
        prev = t;
        window.__rafId = requestAnimationFrame(step);
      };
      window.__rafId = requestAnimationFrame(step);
    });

    console.log(`profiling ${profileMs}ms…`);
    await cdp.send('Profiler.start');
    await sleep(profileMs);
    const { profile } = await cdp.send('Profiler.stop');

    const live = await page.evaluate(() => {
      cancelAnimationFrame(window.__rafId);
      window.__lo?.disconnect();
      const g = window.__frameGaps.slice(1);
      const sorted = [...g].sort((a, b) => a - b);
      const pc = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
      return {
        frames: g.length,
        fps: g.length ? +(1000 / (g.reduce((a, b) => a + b, 0) / g.length)).toFixed(1) : 0,
        medianMs: pc(50), p95Ms: pc(95), worstMs: sorted[sorted.length - 1] ?? 0,
        stutters50: g.filter((x) => x > 50).length,
        longTasks: window.__long.length,
        longTaskMs: window.__long.sort((a, b) => b - a).slice(0, 8),
      };
    });

    const out = val('--profile-out', null);
    if (out) await save(out, Buffer.from(JSON.stringify(profile)));

    // Self time per node, from samples x timeDeltas. hitCount would weight
    // every sample equally; timeDeltas is the real wall clock between them.
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    let total = 0;
    const { samples = [], timeDeltas = [] } = profile;
    for (let i = 0; i < samples.length; i++) {
      const d = timeDeltas[i] || 0;
      if (d < 0) continue;
      total += d;
      self.set(samples[i], (self.get(samples[i]) || 0) + d);
    }
    const strip = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '') || '(native)';
    const key = new Map();
    const file = new Map();
    let idle = 0;
    for (const [id, us] of self) {
      const f = byId.get(id)?.callFrame || {};
      const name = f.functionName || '(anonymous)';
      if (name === '(idle)' || name === '(program)') { idle += us; continue; }
      const url = strip(f.url);
      const k = `${name}  ${url}:${(f.lineNumber ?? -1) + 1}`;
      key.set(k, (key.get(k) || 0) + us);
      file.set(url, (file.get(url) || 0) + us);
    }
    const busy = total - idle;
    const ms = (us) => (us / 1000).toFixed(0).padStart(6);
    const share = (us) => `${((100 * us) / (busy || 1)).toFixed(1).padStart(5)}%`;
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

    console.log('\n=== FRAMES (measured live, same seconds as the profile) ===');
    console.log(JSON.stringify(live));
    console.log(`\n=== CPU: ${(total / 1000).toFixed(0)}ms sampled, ${(busy / 1000).toFixed(0)}ms busy, ${(100 * busy / (total || 1)).toFixed(0)}% on the main thread ===`);
    console.log('\n-- heaviest FUNCTIONS by self time --');
    for (const [k, us] of top(key, 25)) console.log(`${ms(us)}ms ${share(us)}  ${k}`);
    console.log('\n-- heaviest FILES by self time --');
    for (const [k, us] of top(file, 15)) console.log(`${ms(us)}ms ${share(us)}  ${k}`);
  }

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

  // --eval runs BEFORE any capture: it is how you put the app into the state
  // you want to photograph.
  const expr = val('--eval', null);
  if (expr) {
    console.log(JSON.stringify(await page.evaluate(expr), null, 1));
    await sleep(+val('--eval-wait', 3000));
  }

  // A TIME SERIES of the globe. The single most useful thing here: a still
  // frame cannot tell you whether a moving overlay is being drawn, and every
  // wrong conclusion about the eclipse sweep came from trying.
  const film = val('--film', null);
  if (film) {
    const [count, everyMs] = film.split('x').map(Number);
    const stem = val('--film-out', './film');
    await page.evaluate(() => {
      // Copy the canvas AND measure it inside the same postRender, the only
      // moment the WebGL buffer holds anything.
      window.__grab = () => new Promise((res) => {
        const v = window.__viewer, C = window.__Cesium;
        if (!v) return res(null);
        const off = v.scene.postRender.addEventListener(() => {
          off();
          const cv = document.createElement('canvas');
          cv.width = v.scene.canvas.width;
          cv.height = v.scene.canvas.height;
          const g = cv.getContext('2d');
          g.drawImage(v.scene.canvas, 0, 0);
          const lum = (x, y, r = 4) => {
            x = Math.round(x); y = Math.round(y);
            if (x < r + 1 || y < r + 1 || x > cv.width - r - 2 || y > cv.height - r - 2) return null;
            const d = g.getImageData(x - r, y - r, 2 * r + 1, 2 * r + 1).data;
            const n = (2 * r + 1) ** 2;
            let s = 0;
            for (let i = 0; i < n; i++) s += 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
            return +(s / n).toFixed(1);
          };
          const t = v.clock.currentTime;
          const ents = v.entities.values.filter((e) => e.ellipse);
          const seen = ents.map((e, i) => {
            const pos = e.position?.getValue(t);
            const gp = pos ? C.Cartographic.fromCartesian(pos) : null;
            const scr = pos ? C.SceneTransforms.worldToWindowCoordinates(v.scene, pos) : null;
            const at = scr ? lum(scr.x, scr.y) : null;
            // A ring of reference points 90 px out — ground the shadow is NOT
            // sitting on, so "is it darker here than around here" is answerable
            // without a second render.
            const around = scr
              ? [[90, 0], [-90, 0], [0, 90], [0, -90]]
                  .map(([dx, dy]) => lum(scr.x + dx, scr.y + dy))
                  .filter((n2) => n2 !== null)
              : [];
            const ref = around.length ? around.reduce((a, b) => a + b, 0) / around.length : null;
            return {
              which: i === 0 ? 'penumbra' : 'umbra',
              show: e.show,
              lon: gp ? +C.Math.toDegrees(gp.longitude).toFixed(1) : null,
              lat: gp ? +C.Math.toDegrees(gp.latitude).toFixed(1) : null,
              radiusKm: Math.round(e.ellipse.semiMinorAxis.getValue(t) / 1000),
              screen: scr ? [Math.round(scr.x), Math.round(scr.y)] : null,
              onScreen: !!(scr && scr.x >= 0 && scr.y >= 0 && scr.x < cv.width && scr.y < cv.height),
              lumAtCentre: at,
              lumAround: ref === null ? null : +ref.toFixed(1),
              darkerPct: at !== null && ref ? Math.round(100 * (1 - at / ref)) : null,
            };
          });
          const cam = v.camera.positionCartographic;
          res({
            url: cv.toDataURL('image/png'),
            clock: C.JulianDate.toIso8601(t).slice(11, 19),
            camKm: Math.round(cam.height / 1000),
            canvas: [cv.width, cv.height],
            camLon: +C.Math.toDegrees(cam.longitude).toFixed(1),
            camLat: +C.Math.toDegrees(cam.latitude).toFixed(1),
            frames: window.__frames,
            live: document.querySelector('.sky-eclipse-live')?.innerText ?? null,
            seen,
          });
        });
        v.scene.requestRender();
      });
    });
    for (let i = 0; i < count; i++) {
      const f = await page.evaluate(() => window.__grab());
      if (!f) { console.error('no __viewer — --film needs the dev server'); break; }
      const name = `${stem}-${String(i).padStart(2, '0')}.png`;
      await save(name, Buffer.from(f.url.split(',')[1], 'base64'));
      delete f.url;
      console.log(JSON.stringify({ frame: i, ...f }));
      if (i < count - 1) await sleep(everyMs);
    }
  }

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
