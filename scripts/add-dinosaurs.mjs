/**
 * add-dinosaurs.mjs — more dinosaurs, placed and dated by the fossil record.
 *
 * WHY. "Would like to see more dinosaurs" (the Captain, 26 Sept 2026). The
 * prehistoric layer had 51 hand-made animals, 25 of them dinosaurs.
 *
 * WHAT IS OURS AND WHAT IS NOT. The name, the one-line blurb and the emoji are
 * written here. WHERE each animal stands and WHEN are not: they come from the
 * Paleobiology Database (paleobiodb.org — free, open, CC BY 4.0, no key). For
 * each genus we take its fossil occurrences, pick the locality with the most
 * of them (grouped to a 1° cell), and use that locality's own age range and
 * place name. So the pin is a real place where it was dug up, dated by the
 * rocks it came out of.
 *
 * Then run scripts/fetch-fauna-paleo.mjs, which adds each animal's `track`
 * (where that site sat on the moving continents) from the GPlates service.
 *
 * Idempotent: an id already in fauna.json is left alone.
 *
 *   node scripts/add-dinosaurs.mjs [--check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'fauna.json');
const CHECK_ONLY = process.argv.includes('--check');
const UA = 'ChronosEarth-educational-app/1.0 (personal history-teaching project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = '🦖'; // meat-eaters and their feathered kin
const P = '🦕'; // plant-eaters

/** [id, genus for PBDB, display name, emoji, Wikipedia title, blurb, country?]
 * The optional country (ISO code) keeps the pin at the classic locality when
 * a stray attributed find elsewhere would otherwise win: without it Oviraptor
 * stood in Kazakhstan and Mamenchisaurus in Mongolia. */
export const DINOSAURS = [
  ['carnotaurus', 'Carnotaurus', 'Carnotaurus', T, 'Carnotaurus', 'A fast, bull-horned hunter from Patagonia, with arms even tinier than T. rex\'s.'],
  ['pachycephalosaurus', 'Pachycephalosaurus', 'Pachycephalosaurus', P, 'Pachycephalosaurus', 'A two-legged plant-eater with a massively thickened, domed skull.'],
  ['edmontosaurus', 'Edmontosaurus', 'Edmontosaurus', P, 'Edmontosaurus', 'A big duck-billed dinosaur; "mummified" skeletons still carry impressions of its skin.'],
  ['maiasaura', 'Maiasaura', 'Maiasaura', P, 'Maiasaura', 'The "good mother lizard": its Montana nesting grounds show parents caring for their young.'],
  ['protoceratops', 'Protoceratops', 'Protoceratops', P, 'Protoceratops', 'A sheep-sized horned dinosaur of the Gobi, famously found locked in a fight with a Velociraptor.', 'MN'],
  ['oviraptor', 'Oviraptor', 'Oviraptor', T, 'Oviraptor', 'A beaked, toothless feathered dinosaur. Named "egg thief", but its relatives were later found brooding their own nests.', 'MN'],
  ['deinonychus', 'Deinonychus', 'Deinonychus', T, 'Deinonychus', 'A sickle-clawed hunter whose discovery in the 1960s recast dinosaurs as active, bird-like animals.'],
  ['styracosaurus', 'Styracosaurus', 'Styracosaurus', P, 'Styracosaurus', 'A horned dinosaur with a crown of long spikes around its frill.'],
  ['corythosaurus', 'Corythosaurus', 'Corythosaurus', P, 'Corythosaurus', 'A duck-bill with a tall hollow crest like a helmet, probably used for booming calls.'],
  ['albertosaurus', 'Albertosaurus', 'Albertosaurus', T, 'Albertosaurus', 'A lighter cousin of T. rex; one bonebed holds over twenty of them, hinting that they lived in groups.'],
  ['tarbosaurus', 'Tarbosaurus', 'Tarbosaurus', T, 'Tarbosaurus', 'Asia\'s giant tyrannosaur and a close relative of T. rex.', 'MN'],
  ['majungasaurus', 'Majungasaurus', 'Majungasaurus', T, 'Majungasaurus', 'Madagascar\'s top predator, with a single horn-like knob on its skull.'],
  ['saltasaurus', 'Saltasaurus', 'Saltasaurus', P, 'Saltasaurus', 'A small sauropod with bony armour in its skin — the first armoured sauropod discovered.'],
  ['alamosaurus', 'Alamosaurus', 'Alamosaurus', P, 'Alamosaurus', 'One of the last giant long-necked dinosaurs of North America, alive until the asteroid struck.'],
  ['borealopelta', 'Borealopelta', 'Borealopelta', P, 'Borealopelta', 'An armoured nodosaur preserved so well that its armour plates and even traces of its skin colour survive.'],
  ['carcharodontosaurus', 'Carcharodontosaurus', 'Carcharodontosaurus', T, 'Carcharodontosaurus', 'The "shark-toothed lizard", a North African giant rivalling T. rex in length.', 'MA'],
  ['ouranosaurus', 'Ouranosaurus', 'Ouranosaurus', P, 'Ouranosaurus', 'A plant-eater from the Sahara with a tall sail or hump along its back.'],
  ['suchomimus', 'Suchomimus', 'Suchomimus', T, 'Suchomimus', 'A crocodile-snouted fish-eater from the Sahara, a close relative of Baryonyx.'],
  ['baryonyx', 'Baryonyx', 'Baryonyx', T, 'Baryonyx', 'Found in a Surrey clay pit in 1983 with fish scales in its stomach — proof of a fish-eating dinosaur.'],
  ['mantellisaurus', 'Mantellisaurus', 'Mantellisaurus', P, 'Mantellisaurus', 'A lighter relative of Iguanodon, well known from the Isle of Wight.'],
  ['utahraptor', 'Utahraptor', 'Utahraptor', T, 'Utahraptor', 'The largest raptor known — several metres long, with a huge sickle claw on each foot.'],
  ['psittacosaurus', 'Psittacosaurus', 'Psittacosaurus', P, 'Psittacosaurus', 'The "parrot lizard", known from hundreds of skeletons; one preserves long bristles on its tail.'],
  ['microraptor', 'Microraptor', 'Microraptor', T, 'Microraptor', 'A crow-sized dinosaur with feathered wings on both its arms and its legs.'],
  ['yutyrannus', 'Yutyrannus', 'Yutyrannus', T, 'Yutyrannus', 'A nine-metre tyrannosaur covered in long feathery filaments — the largest feathered animal known.'],
  ['sinosauropteryx', 'Sinosauropteryx', 'Sinosauropteryx', T, 'Sinosauropteryx', 'The first dinosaur found with feathers (1996); pigment shows its tail was banded.'],
  ['amargasaurus', 'Amargasaurus', 'Amargasaurus', P, 'Amargasaurus', 'A sauropod with two rows of long spines running down its neck.'],
  ['muttaburrasaurus', 'Muttaburrasaurus', 'Muttaburrasaurus', P, 'Muttaburrasaurus', 'One of Australia\'s best-known dinosaurs, a large plant-eater with a bulging snout.'],
  ['apatosaurus', 'Apatosaurus', 'Apatosaurus', P, 'Apatosaurus', 'The "deceptive lizard", long confused with Brontosaurus — one of the heaviest animals of the Jurassic.'],
  ['camarasaurus', 'Camarasaurus', 'Camarasaurus', P, 'Camarasaurus', 'The commonest long-necked giant of North America\'s Jurassic.'],
  ['ceratosaurus', 'Ceratosaurus', 'Ceratosaurus', T, 'Ceratosaurus', 'A Jurassic hunter with a blade-like horn on its nose and a row of bony plates down its back.'],
  ['mamenchisaurus', 'Mamenchisaurus', 'Mamenchisaurus', P, 'Mamenchisaurus', 'A Chinese sauropod with one of the longest necks of any animal that ever lived.', 'CN'],
  ['giraffatitan', 'Giraffatitan', 'Giraffatitan', P, 'Giraffatitan', 'A towering long-necked giant from Tanzania; its skeleton in Berlin is among the tallest mounted anywhere.'],
  ['kentrosaurus', 'Kentrosaurus', 'Kentrosaurus', P, 'Kentrosaurus', 'A spiky African cousin of Stegosaurus, with long spikes on its hips and tail.'],
  ['cryolophosaurus', 'Cryolophosaurus', 'Cryolophosaurus', T, 'Cryolophosaurus', 'The "frozen crested lizard": a crested Jurassic predator dug out of Antarctica\'s mountains.'],
  ['scelidosaurus', 'Scelidosaurus', 'Scelidosaurus', P, 'Scelidosaurus', 'An early armoured dinosaur from the Dorset coast, one of the first near-complete dinosaurs ever found.'],
  ['heterodontosaurus', 'Heterodontosaurus', 'Heterodontosaurus', P, 'Heterodontosaurus', 'A small South African dinosaur with three kinds of teeth, including tusks.'],
  ['massospondylus', 'Massospondylus', 'Massospondylus', P, 'Massospondylus', 'An early long-necked plant-eater whose nests hold some of the oldest dinosaur embryos known.'],
  ['eoraptor', 'Eoraptor', 'Eoraptor', T, 'Eoraptor', 'One of the earliest dinosaurs of all, a small two-legged animal from Argentina\'s Triassic.'],
  ['guanlong', 'Guanlong', 'Guanlong', T, 'Guanlong', 'An early tyrannosaur relative from China, with a thin crest along its snout.'],
];

const countryName = (() => {
  try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return (cc) => (cc ? d.of(cc) ?? cc : ''); }
  catch { return (cc) => cc ?? ''; }
})();

async function occurrences(genus) {
  const url = `https://paleobiodb.org/data1.2/occs/list.json?base_name=${encodeURIComponent(genus)}&show=coords,loc&vocab=pbdb&limit=all`;
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return (await r.json()).records ?? [];
    } catch { /* retry */ }
    await sleep(2000 * 2 ** a);
  }
  return null;
}

/** The locality with the most occurrences, its own age range and place name. */
export function placeFrom(records, cc) {
  const cells = new Map();
  for (const o of records) {
    if (cc && o.cc !== cc) continue;
    const lat = Number(o.lat), lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(o.max_ma > 0)) continue;
    const k = `${Math.round(lat)}|${Math.round(lng)}`;
    (cells.get(k) ?? cells.set(k, []).get(k)).push(o);
  }
  let best = null;
  for (const list of cells.values()) if (!best || list.length > best.length) best = list;
  if (!best) return null;
  const mean = (f) => best.reduce((s, o) => s + Number(o[f]), 0) / best.length;
  // The site's TYPICAL dating, not its extremes: one loosely dated find
  // stretched Protoceratops (c. 75-71 Ma) to 100.5-66.
  const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const fromMa = median(best.map((o) => Number(o.max_ma)));
  const toMa = Math.min(fromMa, median(best.map((o) => Number(o.min_ma))));
  const where = [best[0].state, countryName(best[0].cc)].filter(Boolean).join(', ');
  return {
    lat: +mean('lat').toFixed(2), lon: +mean('lng').toFixed(2),
    fromMa: +fromMa.toFixed(1), toMa: +toMa.toFixed(1), region: where, finds: best.length,
  };
}

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const have = new Set(doc.fauna.map((a) => a.id));
  let added = 0;
  for (const [id, genus, name, emoji, wiki, blurb, cc] of DINOSAURS) {
    if (have.has(id)) continue;
    const recs = await occurrences(genus);
    if (!recs) { console.log(`  ${name}: PBDB did not answer — skipped`); continue; }
    const place = placeFrom(recs, cc);
    if (!place) { console.log(`  ${name}: no dated, located occurrence — skipped`); continue; }
    const { finds, ...where } = place;
    doc.fauna.push({ id, name, emoji, ...where, blurb, wiki });
    added++;
    console.log(`  + ${name.padEnd(20)} ${where.fromMa}–${where.toMa} Ma  ${where.region} (${finds} finds at this site, ${recs.length} in all)`);
    await sleep(400);
  }
  console.log(`${added} dinosaurs added; ${doc.fauna.length} animals in all`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (added) await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
