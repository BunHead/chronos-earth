/**
 * Verify the site bake stands on the Captain's traced lines.
 *
 * Loads the live app top-down over the Tower of London and renders the SAME
 * camera three ways: nothing, the traced wall PRIMITIVES only, the baked GLB
 * only. The masonry mask of each is the pixels that differ from the empty
 * frame; if the bake is oriented correctly the two masks land on top of one
 * another, and if it is a quarter-turn out they do not overlap at all.
 *
 *   node verify-site-bake.mjs [outDir]
 */
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = process.argv[2] || './site-bake-out';
const BASE = process.env.RENDER_BASE || 'http://localhost:5173';
const HEADING = process.env.HEADING; // override to try another calibration
const URL = `${BASE}/?time=626&zoom=0&layers=sites&cam=-0.0762,51.5082,300,0,-90`;

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 750, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('  [page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('  [console]', m.text()); });
  // The welcome card is DOM, not canvas, so it never enters the masks — but it
  // dims the globe and its tour can steal the camera. Mark it seen up front.
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('ce_seen_welcome', '1'); } catch { /* ignore */ }
  });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60_000 });

  await page.waitForFunction('!!window.__viewer', { timeout: 60_000 });
  // Park the camera dead over the site, straight down, and let everything load.
  await page.evaluate(() => {
    const v = window.__viewer, C = window.__Cesium;
    v.camera.setView({
      destination: C.Cartesian3.fromDegrees(-0.0762, 51.5082, 300),
      orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
    });
  });
  await page.waitForFunction(
    () => {
      const v = window.__viewer;
      if (!v || !v.scene.globe.tilesLoaded) return false;
      const pc = v.scene.primitives;
      for (let i = 0; i < pc.length; i++) {
        const p = pc.get(i);
        if (p && p.constructor.name === 'Model' && !p.ready) return false;
      }
      return true;
    },
    { timeout: 120_000, polling: 500 },
  );

  // Re-park after every loader has settled: the app's own startup (dive logic,
  // terrain refinement) can move the camera while we are waiting for it.
  await page.evaluate(() => {
    const v = window.__viewer, C = window.__Cesium;
    // THE TRAP that cost an hour here: the app runs Cesium in requestRenderMode,
    // so scene.render() returns immediately unless a repaint was asked for.
    // Every phase then screenshots the SAME frozen frame, all the diffs come out
    // zero, and it reads exactly like "the bake draws nothing".
    v.scene.requestRenderMode = false;
    v.camera.setView({
      destination: C.Cartesian3.fromDegrees(-0.0762, 51.5082, 300),
      orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
    });
    for (let i = 0; i < 30; i++) { v.dataSourceDisplay.update(v.clock.currentTime); v.scene.render(); }
  });

  // HEADING=270 re-aims the bake, to prove the shipped calibration is the peak
  // and not merely "not obviously wrong".
  if (HEADING) {
    await page.evaluate((h) => {
      const v = window.__viewer, C = window.__Cesium;
      const e = v.entities.getById('siteglb|siteplan:tower-of-london@51.508,-0.076');
      const pos = e.position.getValue(v.clock.currentTime);
      e.orientation = new C.ConstantProperty(
        C.Transforms.headingPitchRollQuaternion(pos, new C.HeadingPitchRoll(C.Math.toRadians(+h), 0, 0)),
      );
      for (let i = 0; i < 10; i++) { v.scene.requestRender(); v.dataSourceDisplay.update(v.clock.currentTime); v.scene.render(); }
    }, HEADING);
  }

  const where = await page.evaluate(() => {
    const v = window.__viewer, C = window.__Cesium;
    const cc = C.Cartographic.fromCartesian(v.camera.positionWC);
    return [
      +C.Math.toDegrees(cc.longitude).toFixed(5),
      +C.Math.toDegrees(cc.latitude).toFixed(5),
      Math.round(cc.height),
    ];
  });

  // Shoot the CANVAS ELEMENT, not the WebGL buffer. Cesium renders through its
  // own framebuffer with preserveDrawingBuffer off, so a gl.readPixels on the
  // default framebuffer comes back uniformly blank and every frame compares
  // equal — which reads exactly like "nothing is drawn" and will convince you a
  // perfectly good overlay is invisible. The compositor's own capture is the
  // honest picture.
  const canvas = await page.$('canvas');
  const show = async (phase) => {
    await page.evaluate((n) => {
      const v = window.__viewer;
      const all = v.entities.values.filter((e) => String(e.id).startsWith('siteplan|') || String(e.id).startsWith('siteglb|'));
      for (const e of all) {
        const isGlb = String(e.id).startsWith('siteglb|');
        const isWall = /\|(5|8|10|11|12)$/.test(String(e.id));
        if (n === 'live') break; // the app's own state — touch nothing
        if (n === 'empty') e.show = false;
        else if (n === 'primitives') e.show = isWall;
        else if (n === 'baked') e.show = isGlb;
        else e.show = true; // 'both' — the stale-glb failure mode, for contrast
      }
      for (let i = 0; i < 10; i++) { v.scene.requestRender(); v.dataSourceDisplay.update(v.clock.currentTime); v.scene.render(); }
    }, phase);
    const buf = await canvas.screenshot({ type: 'png' });
    await writeFile(join(OUT, `site-${phase}.png`), buf);
    return buf.toString('base64');
  };

  // 'live' LAST and first: capture the app's own computed state before any
  // flag is meddled with, then again at the end to prove nothing stuck.
  const shots = {};
  for (const phase of ['live', 'empty', 'primitives', 'baked', 'empty2', 'both']) {
    shots[phase] = await show(phase === 'empty2' ? 'empty' : phase);
    console.log('shot', phase);
  }

  // Decode and compare back inside the page — no image library needed.
  const result = await page.evaluate(async (s) => {
    const load = (b64) =>
      new Promise((res) => {
        const im = new Image();
        im.onload = () => {
          const c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          const x = c.getContext('2d');
          x.drawImage(im, 0, 0);
          res({ d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height });
        };
        im.src = 'data:image/png;base64,' + b64;
      });
    const [e1, pr, bk, e2] = await Promise.all([load(s.empty), load(s.primitives), load(s.baked), load(s.empty2)]);
    const W = e1.w, H = e1.h, T = 18;
    const mask = (a, b) => {
      const m = new Uint8Array(W * H); let n = 0;
      for (let i = 0; i < W * H; i++) {
        const j = i * 4;
        const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]));
        if (d > T) { m[i] = 1; n++; }
      }
      return { m, n };
    };
    const drift = mask(e1.d, e2.d).n;
    const A = mask(e1.d, pr.d), B = mask(e1.d, bk.d);
    let inter = 0, uni = 0;
    for (let i = 0; i < W * H; i++) { if (A.m[i] || B.m[i]) uni++; if (A.m[i] && B.m[i]) inter++; }
    const cent = (m) => {
      let sx = 0, sy = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { sx += x; sy += y; n++; }
      return n ? [Math.round(sx / n), Math.round(sy / n)] : null;
    };
    return {
      W, H, baselineDrift: drift,
      wallPx: A.n, bakedPx: B.n, intersect: inter, union: uni,
      iou: +(inter / Math.max(1, uni)).toFixed(3),
      coverOfWall: +(inter / Math.max(1, A.n)).toFixed(3),
      centWall: cent(A.m), centBaked: cent(B.m),
    };
  }, shots);
  console.log(JSON.stringify({ camera: where, ...result }, null, 2));

  // A battlement is a SILHOUETTE. Top-down proves it stands on the right line
  // and nothing else — these two low angles are what show whether the teeth
  // actually read as a castle from where a visitor flies.
  for (const [name, lon, lat, h, heading, pitch] of [
    ['oblique-ne', -0.0735, 51.5068, 90, 315, -18],
    ['oblique-sw', -0.0790, 51.5096, 80, 140, -14],
  ]) {
    await page.evaluate((c) => {
      const v = window.__viewer, C = window.__Cesium;
      v.camera.setView({
        destination: C.Cartesian3.fromDegrees(c[1], c[2], c[3]),
        orientation: { heading: C.Math.toRadians(c[4]), pitch: C.Math.toRadians(c[5]), roll: 0 },
      });
      for (let i = 0; i < 20; i++) { v.scene.requestRender(); v.dataSourceDisplay.update(v.clock.currentTime); v.scene.render(); }
    }, [name, lon, lat, h, heading, pitch]);
    await writeFile(join(OUT, `site-${name}.png`), await canvas.screenshot({ type: 'png' }));
    console.log('shot', name);
  }
} finally {
  await browser.close();
}
