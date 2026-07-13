// One-off: re-export just tower-of-london.glb and patch its manifest entry in place.
import puppeteer from 'puppeteer';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = (process.env.RENDER_BASE ?? 'http://localhost:5173') + '/export-models.html';
const OUT = 'public/models';
const MODEL = 'tower-of-london';
const TITLE = 'Tower of London';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.goto(`${BASE}?model=${encodeURIComponent(MODEL)}&title=${encodeURIComponent(TITLE)}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__glb || window.__glbError', { timeout: 60_000 });
  const err = await page.evaluate('window.__glbError');
  if (err) { console.error(`FAILED — ${err}`); process.exit(1); }
  const b64 = await page.evaluate('window.__glb');
  const footprint = await page.evaluate('window.__footprint');
  const buf = Buffer.from(b64, 'base64');
  await writeFile(join(OUT, `${MODEL}.glb`), buf);

  const manifestPath = join(OUT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest[MODEL] = { footprint: +(+footprint).toFixed(3), kb: Math.round(buf.length / 1024) };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${MODEL}: ${Math.round(buf.length / 1024)} KB, footprint ${(+footprint).toFixed(3)}u — manifest patched.`);
} finally {
  await browser.close();
}
