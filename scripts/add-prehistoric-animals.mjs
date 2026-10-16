/**
 * add-prehistoric-animals.mjs — more prehistoric animals, each with a Wikidata
 * Q-id and a find site taken from Wikidata.
 *
 * WHY. Daytime job, 16 Oct 2026 ("more dinosaurs and fossil sites"). The 12
 * dinosaurs that job named were already in fauna.json (see #6), so these are
 * NEW animals: one or more per continent, Triassic to Ice Age.
 *
 * WHERE. `lon`/`lat` are the Wikidata P625 point of the find site
 * (`locality`, the animal's P189 "location of discovery", or the classic
 * quarry where that is the better-known item). Never a guess.
 *
 * WHEN. `fromMa`/`toMa` are the age range on the animal's Wikipedia page,
 * in millions of years before present.
 *
 * DRIFT. Every animal in fauna.json needs a `track` (where its site sat on the
 * moving continents), filled by scripts/fetch-fauna-paleo.mjs from the GPlates
 * web service. An animal younger than 2 million years gets its track here, at
 * today's spot: the plates have moved less than 1° since. For older animals
 * this script adds them, runs fetch-fauna-paleo, and takes back out any that
 * still have no track — so a run without GPlates leaves the file valid, and a
 * later run with GPlates adds the rest.
 *
 * Idempotent: an id already in fauna.json is left alone.
 *
 *   node scripts/add-prehistoric-animals.mjs [--check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'public', 'data', 'fauna.json');
const CHECK_ONLY = process.argv.includes('--check');
/** Younger than this, today's position is the track (plates moved < 1°). */
const MODERN_MA = 2;

const a = (id, name, emoji, wikidata, locality, lat, lon, fromMa, toMa, region, wiki, blurb) => ({
  id, name, emoji, wikidata, locality, lat, lon, fromMa, toMa, region, wiki, blurb,
});

export const NEW_ANIMALS = [
  a('tanystropheus', 'Tanystropheus', '🦎', 'Q131782', 'Q16648', 45.91667, 8.95, 247, 227,
    'Monte San Giorgio, Switzerland/Italy', 'Tanystropheus',
    'A Triassic reptile with a stiff neck longer than its body, probably used to snatch fish from the shallows.'),
  a('anchiornis', 'Anchiornis', '🦖', 'Q18511041', 'Q7800263', 41.3, 119.2, 161, 158,
    'Tiaojishan Formation, Liaoning (China)', 'Anchiornis',
    'A crow-sized feathered dinosaur — the first whose colours were worked out: black-and-white wings and a reddish crest.'),
  a('liopleurodon', 'Liopleurodon', '🐊', 'Q287975', 'Q81997', 50.72556, 1.61389, 166, 157,
    'Boulogne-sur-Mer, France', 'Liopleurodon',
    'A big-headed sea reptile of the Jurassic seas, a top predator with jaws over a metre long.'),
  a('concavenator', 'Concavenator', '🦖', 'Q131715', 'Q2421893', 40.08972, -1.89778, 129, 125,
    'Las Hoyas, Cuenca (Spain)', 'Concavenator',
    'A Spanish meat-eater with a strange tall hump over its hips.'),
  a('irritator', 'Irritator', '🦖', 'Q131211', 'Q1710549', -7.2, -39.3, 113, 110,
    'Santana Formation, Ceará (Brazil)', 'Irritator',
    'A fish-eating spinosaur. Its skull was faked up with plaster before it was sold; the name comes from the irritation of the scientists who had to undo it.'),
  a('sarcosuchus', 'Sarcosuchus', '🐊', 'Q131134', 'Q5367335', 16.83333, 9.41667, 125, 112,
    'Elrhaz Formation, Gadoufaoua (Niger)', 'Sarcosuchus',
    '"SuperCroc": a crocodile relative about 11 metres long that lived in the rivers of what is now the Sahara.'),
  a('archelon', 'Archelon', '🐢', 'Q632618', 'Q7192447', 44.395, -100.412, 80.5, 74,
    'Pierre Shale, South Dakota (USA)', 'Archelon',
    'The biggest turtle ever found — about 4.5 metres long — swimming the inland sea that split North America in two.'),
  a('antarctopelta', 'Antarctopelta', '🦕', 'Q134176', 'Q1022143', -64.16667, -57.75, 75, 70,
    'James Ross Island, Antarctica', 'Antarctopelta',
    'An armoured plant-eater, and the first dinosaur ever found in Antarctica (1986), back when it was forested.'),
  a('diprotodon', 'Diprotodon', '🦛', 'Q131563', 'Q7981344', -32.62083, 148.93806, 1.77, 0.04,
    'Wellington Caves, New South Wales (Australia)', 'Diprotodon',
    'The largest marsupial that ever lived: a wombat relative the size of a hippo, alive when the first people reached Australia.'),
];

async function main() {
  const doc = JSON.parse(await readFile(FILE, 'utf8'));
  const have = new Set(doc.fauna.map((x) => x.id));
  const deep = [];
  let added = 0;
  for (const animal of NEW_ANIMALS) {
    if (have.has(animal.id)) continue;
    const { locality, ...row } = animal;
    if (row.fromMa <= MODERN_MA) {
      row.track = [
        { ma: row.toMa, lon: row.lon, lat: row.lat },
        { ma: row.fromMa, lon: row.lon, lat: row.lat },
      ];
    } else {
      deep.push(row.id);
    }
    doc.fauna.push(row);
    added++;
    console.log(`  + ${row.name.padEnd(16)} ${row.fromMa}–${row.toMa} Ma  ${row.region}  (${row.wikidata}, site ${locality})`);
  }
  console.log(`${added} animals added; ${doc.fauna.length} in all`);
  if (CHECK_ONLY) { console.log('(--check: nothing written)'); return; }
  if (!added) return;
  await writeFile(FILE, JSON.stringify(doc, null, 2) + '\n');
  if (!deep.length) return;

  // Drift tracks for the older animals; then drop any GPlates could not place.
  try {
    execFileSync(process.execPath, [join(__dirname, 'fetch-fauna-paleo.mjs')], { stdio: 'inherit' });
  } catch (err) {
    console.log(`fetch-fauna-paleo failed: ${err.message}`);
  }
  const after = JSON.parse(await readFile(FILE, 'utf8'));
  const missing = after.fauna.filter((x) => deep.includes(x.id) && !(x.track?.length));
  if (missing.length) {
    after.fauna = after.fauna.filter((x) => !missing.includes(x));
    await writeFile(FILE, JSON.stringify(after, null, 2) + '\n');
    console.log(`No drift track yet (GPlates did not answer), taken back out: ${missing.map((x) => x.name).join(', ')}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
