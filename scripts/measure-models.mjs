/**
 * measure-models.mjs — how fast do the 3D monuments appear?
 *
 * Two parts, the same every run so before/after numbers compare:
 *
 *  1. FILES (no browser): total bytes of public/models/*.glb, split by kind —
 *     base build, each build-stage variant (-b15, -b30, -b50, -b72 …), -ruin,
 *     -lite — and how they are compressed (Draco, meshopt, texture bytes).
 *
 *  2. BROWSER (needs `npm run build` first): serves dist/ with vite preview,
 *     opens each monument in headless Chrome and records every model request
 *     (order, start, finish), the requests that must finish before them
 *     (manifest, review file), and when each model was actually DRAWN, from
 *     the page's own window.__chronosModelLog (lib/modelLoadWatch).
 *     The page opens straight at the monument (a shared link) and nobody
 *     touches it: after ~20 s the globe stops drawing on its own (on-demand
 *     rendering), which is exactly when a half-built model used to stall.
 *
 *   node scripts/measure-models.mjs            # files + browser
 *   node scripts/measure-models.mjs --files    # files only
 *   node scripts/measure-models.mjs --json out.json
 *   node scripts/measure-models.mjs --url https://bunhead.github.io/chronos-earth
 *
 * Software GL in headless Chrome is slower than a real graphics card, and the
 * sandbox may block outside tile servers, so read the numbers side by side
 * (before vs after on the same machine), not as the live site's own.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};

// ── 1. files ────────────────────────────────────────────────────────────────
const MODELS = 'public/models';

/** The kind of a model file from its name: base, a build stage (b30), ruin, lite… */
function variantOf(name) {
  const stem = name.replace(/\.glb$/, '');
  const stage = stem.match(/-(b\d+)$/);
  if (stage) return stage[1];
  const tail = stem.match(/-(ruin|lite|site|step)$/);
  return tail ? tail[1] : 'base';
}

function glbInfo(path) {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
  let textureBytes = 0;
  for (const im of json.images ?? []) {
    if (im.bufferView != null) textureBytes += json.bufferViews[im.bufferView].byteLength;
  }
  return { bytes: b.length, extensions: json.extensionsUsed ?? [], textureBytes, images: (json.images ?? []).length };
}

function measureFiles() {
  const files = readdirSync(MODELS).filter((f) => f.endsWith('.glb'));
  const byVariant = {};
  const compression = { draco: 0, meshopt: 0, none: 0 };
  let total = 0;
  let textureBytes = 0;
  for (const f of files) {
    const info = glbInfo(join(MODELS, f));
    total += info.bytes;
    textureBytes += info.textureBytes;
    const v = variantOf(f);
    byVariant[v] ??= { files: 0, bytes: 0 };
    byVariant[v].files++;
    byVariant[v].bytes += info.bytes;
    if (info.extensions.includes('KHR_draco_mesh_compression')) compression.draco++;
    else if (info.extensions.includes('EXT_meshopt_compression')) compression.meshopt++;
    else compression.none++;
  }
  return { files: files.length, totalBytes: total, textureBytes, compression, byVariant };
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

const report = { files: measureFiles() };
const F = report.files;
console.log(`MODEL FILES  ${F.files} glb, ${mb(F.totalBytes)} (textures ${mb(F.textureBytes)})`);
console.log(`  compression: draco ${F.compression.draco}, meshopt ${F.compression.meshopt}, none ${F.compression.none}`);
for (const [v, s] of Object.entries(F.byVariant).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${v.padEnd(6)} ${String(s.files).padStart(3)} files  ${mb(s.bytes)}`);
}

// ── 2. browser ──────────────────────────────────────────────────────────────
const SITES = [
  { name: 'Giza', lon: 31.1342, lat: 29.9792 },
  { name: 'Stonehenge', lon: -1.8262, lat: 51.1789 },
  { name: 'Westminster', lon: -0.1273, lat: 51.4994 },
];
const WAIT_MS = Number(opt('--wait', 90_000));

async function startPreview() {
  if (!existsSync('dist/index.html')) throw new Error('no dist/ — run `npm run build` first');
  const port = 4179;
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.ok) return { url: `http://localhost:${port}`, stop: () => proc.kill() };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error('vite preview did not start');
}

async function visit(browser, base, site) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const t0 = Date.now();
  const reqs = new Map();
  page.on('request', (r) => {
    const u = r.url();
    if (/\/models\/|model-review\.json/.test(u)) reqs.set(r, { url: u.replace(/^.*\/(models|data)\//, '$1/').replace(/\?.*$/, ''), start: Date.now() - t0, end: null });
  });
  const done = (r) => { const q = reqs.get(r); if (q) q.end = Date.now() - t0; };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  // ?perf=high: the desktop path, so a software-GL sandbox is not measured as a phone.
  const q = `?perf=high&time=0&cam=${site.lon},${site.lat},1500,0,-35`;
  await page.goto(`${base.replace(/\/+$/, '')}/${q}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const from = Date.now();
  let log = [];
  while (Date.now() - from < WAIT_MS) {
    log = await page.evaluate(() => (window.__chronosModelLog ?? []).map((r) => ({ ...r })));
    if (log.length && log.every((r) => r.readyMs != null || r.failed)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const navStart = await page.evaluate(() => performance.timeOrigin);
  const off = navStart - t0; // page clock → our clock
  const shift = (ms) => (ms == null ? null : Math.round(ms + off));
  const models = log.map((r) => ({ uri: r.uri.replace('./models/', ''), shownMs: shift(r.shownMs), readyMs: shift(r.readyMs), failed: !!r.failed }));
  const requests = [...reqs.values()].sort((a, b) => a.start - b.start);
  await page.close();
  const ready = models.filter((m) => m.readyMs != null).map((m) => m.readyMs);
  return {
    site: site.name,
    glbRequests: requests.filter((r) => r.url.endsWith('.glb')).length,
    requests,
    models,
    firstModelMs: ready.length ? Math.min(...ready) : null,
    allModelsMs: ready.length === models.length && ready.length ? Math.max(...ready) : null,
    stillLoading: models.filter((m) => m.readyMs == null && !m.failed).length,
  };
}

if (!flag('--files')) {
  const { default: puppeteer } = await import('puppeteer');
  const preview = opt('--url') ? { url: opt('--url'), stop: () => {} } : await startPreview();
  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 240_000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  report.visits = [];
  try {
    {
      for (const site of SITES) {
        const v = await visit(browser, preview.url, site);
        report.visits.push(v);
        const s = (ms) => (ms == null ? `not in ${WAIT_MS / 1000} s` : `${(ms / 1000).toFixed(1)} s`);
        console.log(`\n${v.site}  glb requests ${v.glbRequests}  first model ${s(v.firstModelMs)}  all ${s(v.allModelsMs)}${v.stillLoading ? `  still loading ${v.stillLoading}` : ''}`);
        for (const r of v.requests) console.log(`  ${String(r.start).padStart(6)} → ${String(r.end ?? '—').padStart(6)} ms  ${r.url}`);
        for (const m of v.models) console.log(`  shown ${String(m.shownMs).padStart(6)}  drawn ${String(m.readyMs ?? '—').padStart(6)} ms  ${m.uri}${m.failed ? '  FAILED' : ''}`);
      }
    }
  } finally {
    await browser.close();
    preview.stop();
  }
}

if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(report, null, 2) + '\n');
