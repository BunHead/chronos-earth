// Chronos Earth — export the fleet to .glb for the globe (Stage E).
//
// Drives export-models.html headless over the marquee monuments and saves
// binary glTF files + a manifest of native footprints (for true-metre
// scaling on the globe). Zero-cost: the .glb files are committed and served
// as static data.
//
//   RENDER_BASE=http://localhost:5173 node scripts/export-models.mjs
import puppeteer from 'puppeteer';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import gltfPipeline from 'gltf-pipeline';
const { processGlb } = gltfPipeline;

const BASE = (process.env.RENDER_BASE ?? 'http://localhost:5173') + '/export-models.html';
const OUT = 'public/models';

// The MVP fleet — model archetype + the title that unlocks its exact fit.
// Whole-site temples (scripts/build-meso-site.mjs) — each with a ruin variant.
const MESO = JSON.parse(readFileSync(new URL('../src/data/meso-temples.json', import.meta.url), 'utf8'));

const FLEET = [
  ...MESO.map((t) => [t.model, t.title]),
  ['giza', 'Giza Pyramids'],
  // The Giza pyramids one by one, in true metres (Monument3D buildGizaPart).
  ['giza-khufu', 'Pyramid of Khufu'],
  ['giza-khafre', 'Pyramid of Khafre'],
  ['giza-menkaure', 'Pyramid of Menkaure'],
  ['giza-queen', 'Pyramid G1-a'],
  ['giza-queen-step', 'Pyramid G3-b'],
  ['amphitheatre', 'Colosseum'],
  ['greek-temple', 'Parthenon'],
  ['stonehenge', 'Stonehenge'],
  // Stonehenge as a whole site over time, true metres (stonehengeSite.ts).
  ['stonehenge-site', 'Stonehenge'],
  ['round-barrow', 'Round barrow'],
  // The Palace of Westminster over time (westminsterSite.ts).
  ['westminster-site', 'Palace of Westminster'],
  ['cathedral', 'Notre-Dame de Paris'],
  ['westminster', 'Palace of Westminster'],
  ['buckingham', 'Buckingham Palace'],
  // Buckingham Palace over time (buckinghamSite.ts).
  ['buckingham-site', 'Buckingham Palace'],
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
  // Mapped by two sites in panel.ts (Gunung Padang, Pumapunku) and listed in
  // the workshop — but never exported, so the globe asked for a megalith.glb
  // that had never existed and both sites came up empty. Added 2026-09-18.
  ['megalith', 'Newgrange'],
  ['settlement', 'Ancient Settlement'],
  ['castle', 'Castle'],
  ['mansion', 'Mansion'],
  ['temple-tower', 'Temple Tower'],
  ['ziggurat', 'Eridu'],
  ['angkor', 'Angkor Wat'],
  ['pagoda', 'Pagoda'],
  ['lighthouse', 'Lighthouse'],
  // (The impact crater is built by scripts/build-impact-crater.mjs.)
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
  ['machu-picchu', 'Machu Picchu'],
  ['terracotta-army', 'Terracotta Army'],
];

// Ruin variants — only for monuments that genuinely stand as ruins today,
// so the timeline can swap them at their historical ruin date.
const RUINS = [
  ...MESO.map((t) => [t.model, t.title]),
  ['giza', 'Giza Pyramids'],
  ['giza-khufu', 'Pyramid of Khufu'],
  ['giza-khafre', 'Pyramid of Khafre'],
  ['giza-menkaure', 'Pyramid of Menkaure'],
  ['amphitheatre', 'Colosseum'],
  ['greek-temple', 'Parthenon'],
  ['stonehenge', 'Stonehenge'],
  ['stonehenge-site', 'Stonehenge'],
  ['machu-picchu', 'Machu Picchu'],
  // Not a ruin but an EXCAVATION: the open pit as shown since 1974.
  ['terracotta-army', 'Terracotta Army'],
];

// Construction stages — building-over-time. Only monuments whose buildModel
// honours a build fraction (currently giza). Each → {model}-b30/-b60/-b90.
const BUILD_STAGES = [
  ['giza', 'Giza Pyramids', [30, 60, 90]],
  ['giza-khufu', 'Pyramid of Khufu', [30, 60, 90]],
  ['giza-khafre', 'Pyramid of Khafre', [30, 60, 90]],
  ['giza-menkaure', 'Pyramid of Menkaure', [30, 60, 90]],
  ['stonehenge', 'Stonehenge', [30, 60, 90]],
  // b15 ditch & bank · b35 bluestones in the Aubrey holes · b60 sarsens · b80 Heel Stone ditch (Avenue draped)
  ['stonehenge-site', 'Stonehenge', [15, 20, 35, 60, 80]],
  // b10 Rufus's Hall 1097 · b30 hammerbeam roof 1393 · b45 the 1834 fire · b60 Barry rising 1840
  // · b75 Lords 1847 / Commons 1852 · b90 Elizabeth Tower 1859 · '' Victoria Tower 1860, today
  ['westminster-site', 'Palace of Westminster', [10, 30, 45, 60, 75, 90]],
  // b10 Buckingham House 1703 · b35 Nash's palace 1837 · b60 Blore's East Front 1850
  // · b85 Victoria Memorial & gates 1911 · '' Webb's Portland-stone front 1913, today
  ['buckingham-site', 'Buckingham Palace', [10, 35, 60, 85]],
  ['amphitheatre', 'Colosseum', [30, 60, 90]],
  // (The impact's five frames — b15/b30/b50/b72 + base — are built
  // procedurally by scripts/build-impact-crater.mjs, 16 Oct 2026.)
  // Eridu's temple levels — only those with a plan distinct enough to build:
  // b15 Levels XVIII–XVII (one room), b25 XVI (altar recess), b35 XI (first
  // platform), b48 VIII–VII (tripartite), b62 VI (finest Ubaid temple), b78 the
  // Uruk terrace; the base glb is Amar-Sin's ziggurat, c. 2050 BCE. The mound
  // grows through the sequence. Dates live in STAGE_TABLE (lib/stageTable.ts).
  ['ziggurat', 'Eridu', [15, 25, 35, 48, 62, 78]],
  // The Tower of London as dated fortress phases: b15 timber corner-fort,
  // b35 the White Tower alone, b55 the inner ward, b80 the concentric outer
  // ward + wet moat; the base glb is the modern drained-moat plan.
  ['tower-of-london', 'Tower of London', [15, 35, 55, 80]],
];

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
// Seed from the existing manifest so a partial (ONLY=…) run keeps every other
// model's footprint instead of blanking it.
const manifest = await readFile(join(OUT, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => ({}));
const ALL_JOBS = [
  ...FLEET.map(([model, title]) => [model, title, model, '']),
  ...RUINS.map(([model, title]) => [model, title, `${model}-ruin`, '&ruin=1']),
  // Plato's Atlantis, imagined: a light build for phones / no-GPU machines.
  ['rings', 'Atlantis', 'rings-lite', '&lite=1'],
  ...BUILD_STAGES.flatMap(([model, title, stages]) =>
    stages.map((s) => [model, title, `${model}-b${s}`, `&frac=${s / 100}`]),
  ),
];
// ONLY=london-eye,giza re-exports just those archetypes (all their stages/ruins);
// omit to export the whole fleet. Manifest merges with the existing one so a
// partial run doesn't drop other models' footprints.
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const JOBS = ONLY.length ? ALL_JOBS.filter(([model]) => ONLY.includes(model)) : ALL_JOBS;

// ── SITE PLANS (queue item 11) ────────────────────────────────────────────────
// The Captain's own traced surveys, baked into masonry by lib/siteBake.ts. The
// keys come straight from the review file, so a site he traces tomorrow is
// exported tomorrow with no list to maintain here. The OUTPUT FILENAME is NOT
// derived here: the page reports it via window.__siteName, from the same
// siteGlbName() the globe uses to look the file up — one slug function, so the
// exporter and the globe can never drift apart over a punctuation rule.
// ONLY=sites runs just these.
const SITE_KEYS = await readFile('public/data/model-review.json', 'utf8')
  .then((t) => Object.keys(JSON.parse(t)).filter((k) => k.startsWith('siteplan:')))
  .catch(() => []);
const SITE_JOBS = ONLY.length && !ONLY.includes('sites') ? [] : SITE_KEYS;
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
    const raw = Buffer.from(b64, 'base64');
    // Draco-compress the geometry — Cesium decodes it natively (its bundled
    // decoder, no CDN, zero cost), so the globe just loads a much smaller file.
    // Fall back to the raw glb if compression ever throws, so a model is never lost.
    let out = raw;
    try {
      // A landform-sized model (Atlantis: 23 km of plain, 40 km of sea, a
      // 9 m-wide column) needs finer position quantisation than the default
      // 11 bits, which would round it to ~12 m steps.
      const dracoOptions = model === 'rings'
        ? { compressionLevel: 7, quantizePositionBits: 16 }
        : { compressionLevel: 7 };
      const { glb } = await processGlb(raw, { dracoOptions });
      if (glb && glb.length) out = Buffer.from(glb);
    } catch (e) {
      console.error(`${outName}: Draco failed (${e.message}) — writing uncompressed`);
    }
    await writeFile(join(OUT, `${outName}.glb`), out);
    manifest[outName] = { footprint: +(+footprint).toFixed(3), kb: Math.round(out.length / 1024) };
    console.log(`${outName.padEnd(20)} ${String(Math.round(raw.length / 1024)).padStart(5)}→${String(Math.round(out.length / 1024)).padStart(5)} KB  footprint ${(+footprint).toFixed(1)}u`);
    await page.close();
  }

  for (const key of SITE_JOBS) {
    const page = await browser.newPage();
    await page.goto(`${BASE}?siteplan=${encodeURIComponent(key)}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__glb || window.__glbError', { timeout: 60_000 });
    const err = await page.evaluate('window.__glbError');
    if (err) {
      // A site with nothing bakeable is a normal outcome, not a failure: the
      // mason has one recipe so far, and a plan of towers and moat simply has
      // no work for him. Say so plainly and move on.
      console.error(`${key}: not baked — ${err}`);
      await page.close();
      continue;
    }
    const outName = await page.evaluate('window.__siteName');
    const meta = await page.evaluate('window.__siteMeta');
    const raw = Buffer.from(await page.evaluate('window.__glb'), 'base64');
    let out = raw;
    try {
      const { glb } = await processGlb(raw, { dracoOptions: { compressionLevel: 7 } });
      if (glb && glb.length) out = Buffer.from(glb);
    } catch (e) {
      console.error(`${outName}: Draco failed (${e.message}) — writing uncompressed`);
    }
    await writeFile(join(OUT, `${outName}.glb`), out);
    // A site bake stands at scale 1 (it is authored in true metres), so the
    // globe never divides by this footprint — it is recorded for eyeballing a
    // size regression. `parts` is what the renderer stands down.
    manifest[outName] = {
      footprint: +(+(await page.evaluate('window.__footprint'))).toFixed(3),
      kb: Math.round(out.length / 1024),
      site: key,
      parts: meta?.partIndices ?? [],
      ...(meta?.fromYear != null ? { fromYear: meta.fromYear } : {}),
      ...(meta?.toYear != null ? { toYear: meta.toYear } : {}),
    };
    console.log(`${String(outName).padEnd(20)} ${String(Math.round(raw.length / 1024)).padStart(5)}→${String(Math.round(out.length / 1024)).padStart(5)} KB  site ${key} (${meta?.partIndices?.length ?? 0} parts)`);
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json written (${Object.keys(manifest).length} models). done.`);
