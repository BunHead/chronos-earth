// Chronos Earth — export the fleet to .glb for the globe (Stage E).
//
// Drives export-models.html headless over the marquee monuments and saves
// binary glTF files + a manifest of native footprints (for true-metre
// scaling on the globe). Zero-cost: the .glb files are committed and served
// as static data.
//
//   RENDER_BASE=http://localhost:5173 node scripts/export-models.mjs
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = (process.env.RENDER_BASE ?? 'http://localhost:5173') + '/export-models.html';
const OUT = 'public/models';

// The MVP fleet — model archetype + the title that unlocks its exact fit.
const FLEET = [
  ['giza', 'Giza Pyramids'],
  ['amphitheatre', 'Colosseum'],
  ['greek-temple', 'Parthenon'],
  ['stonehenge', 'Stonehenge'],
  ['cathedral', 'Notre-Dame de Paris'],
  ['westminster', 'Palace of Westminster'],
  ['buckingham', 'Buckingham Palace'],
  ['london-eye', 'London Eye'],
  ['liberty', 'Statue of Liberty'],
  ['leaning-tower', 'Leaning Tower of Pisa'],
  ['aqueduct', 'Pont du Gard'],
  ['rings', 'Atlantis'],
  // The generic archetypes — so ANY harvested site can stand on the globe.
  ['tpillars', 'Göbekli Tepe'],
  ['pyramid', 'Pyramid'],
  ['stepped-pyramid', 'Stepped Pyramid'],
  ['sphinx', 'Great Sphinx'],
  ['circle', 'Stone Circle'],
  ['settlement', 'Ancient Settlement'],
  ['castle', 'Castle'],
  ['mansion', 'Mansion'],
  ['temple-tower', 'Temple Tower'],
  ['pagoda', 'Pagoda'],
  ['lighthouse', 'Lighthouse'],
  ['impact', 'Impact Crater'],
  ['hanging-gardens', 'Hanging Gardens of Babylon'],
  ['zeus-statue', 'Statue of Zeus at Olympia'],
  ['artemis-temple', 'Temple of Artemis'],
  ['mausoleum', 'Mausoleum at Halicarnassus'],
  ['colossus', 'Colossus of Rhodes'],
  ['pharos', 'Lighthouse of Alexandria'],
  // The Paris trio.
  ['eiffel', 'Eiffel Tower'],
  ['arc-triomphe', 'Arc de Triomphe'],
  ['louvre', 'Louvre'],
  // The London expansion.
  ['tower-bridge', 'Tower Bridge'],
  ['st-pauls', "St Paul's Cathedral"],
  ['tower-of-london', 'Tower of London'],
  ['shard', 'The Shard'],
  ['gherkin', '30 St Mary Axe (The Gherkin)'],
  ['opera-house', 'Sydney Opera House'],
];

// Ruin variants — only for monuments that genuinely stand as ruins today,
// so the timeline can swap them at their historical ruin date.
const RUINS = [
  ['giza', 'Giza Pyramids'],
  ['amphitheatre', 'Colosseum'],
  ['greek-temple', 'Parthenon'],
  ['stonehenge', 'Stonehenge'],
];

// Construction stages — building-over-time. Only monuments whose buildModel
// honours a build fraction (currently giza). Each → {model}-b30/-b60/-b90.
const BUILD_STAGES = [
  ['giza', 'Giza Pyramids', [30, 60, 90]],
  ['stonehenge', 'Stonehenge', [30, 60, 90]],
  ['amphitheatre', 'Colosseum', [30, 60, 90]],
];

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const manifest = {};
const JOBS = [
  ...FLEET.map(([model, title]) => [model, title, model, '']),
  ...RUINS.map(([model, title]) => [model, title, `${model}-ruin`, '&ruin=1']),
  ...BUILD_STAGES.flatMap(([model, title, stages]) =>
    stages.map((s) => [model, title, `${model}-b${s}`, `&frac=${s / 100}`]),
  ),
];
try {
  for (const [model, title, outName, extra] of JOBS) {
    const page = await browser.newPage();
    await page.goto(`${BASE}?model=${encodeURIComponent(model)}&title=${encodeURIComponent(title)}${extra}`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForFunction('window.__glb || window.__glbError', { timeout: 60_000 });
    const err = await page.evaluate('window.__glbError');
    if (err) {
      console.error(`${model}: FAILED — ${err}`);
      await page.close();
      continue;
    }
    const b64 = await page.evaluate('window.__glb');
    const footprint = await page.evaluate('window.__footprint');
    const buf = Buffer.from(b64, 'base64');
    await writeFile(join(OUT, `${outName}.glb`), buf);
    manifest[outName] = { footprint: +(+footprint).toFixed(3), kb: Math.round(buf.length / 1024) };
    console.log(`${outName.padEnd(20)} ${String(Math.round(buf.length / 1024)).padStart(5)} KB  footprint ${(+footprint).toFixed(1)}u`);
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json written (${Object.keys(manifest).length} models). done.`);
