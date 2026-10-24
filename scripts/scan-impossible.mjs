// Chronos Earth — impossible-row scan.
//
// A read-only sweep over all the shipped data for rows that cannot be right:
// born after death, an end before its start, lifespans over 110 years, battles
// outside a linked person's life, (0,0) pins, swapped lat/lon, land things in
// the open sea, one Q-id pinned in two far-apart places, and Born / Died lines
// that leak a raw Wikidata blank-node URL. It prints a report and writes JSON
// (default: stdout only). Fixes go in scripts/data/accuracy-fixes.json.
//
//   node scripts/scan-impossible.mjs              # print counts + rows
//   node scripts/scan-impossible.mjs --json out.json
//
// The cheap rules (born after death, end before start, (0,0), swapped lat/lon)
// also run in `npm run lint:data`, so they cannot come back.
import { readFile, writeFile } from 'node:fs/promises';
import { checkImpossibleYears, checkQidCoords, checkSwapped, deathYear } from './lib/data-quality.mjs';
import { handPlacedPins, lookupFromHarvest } from './lib/wikidata-coords.mjs';

const read = (p) => readFile(p, 'utf8').then(JSON.parse);
const [ev, b, s, polity, camp] = await Promise.all([
  read('public/data/imported/events.json'), read('public/data/battles.json'),
  read('public/data/ancient-sites.json'), read('scripts/data/polity-class.json'), read('public/data/campaigns.json'),
]);
const events = ev.events;
const out = [];
const add = (kind, file, r, msg) => out.push({ kind, file, id: r.id, name: r.name, msg });

for (const r of events) for (const f of checkImpossibleYears(r)) add(f.kind, 'imported/events.json', r, f.msg);
for (const r of b.battles) for (const f of checkImpossibleYears({ ...r, startYear: r.year })) add(f.kind, 'battles.json', r, f.msg);
for (const r of s.sites) for (const f of checkImpossibleYears({ ...r, startYear: r.builtYear })) add(f.kind, 'ancient-sites.json', r, f.msg);

// Empires and states: a capital role that ends before it starts, or runs
// past its polity's dissolution; a polity dissolved before its inception; a
// campaign whose keyframes run backwards.
for (const r of events) {
  for (const c of r.capitalOf ?? []) {
    if (c.from != null && c.to != null && c.to < c.from) add('end-before-start', 'imported/events.json', r, `capital of ${c.of} ${c.from} to ${c.to}`);
  }
}
for (const [q, [from, to]] of Object.entries(polity.national)) {
  if (from != null && to != null && to < from) out.push({ kind: 'end-before-start', file: 'polity-class.json', id: q, msg: `inception ${from}, dissolution ${to}` });
}
for (const c of camp.campaigns) {
  const ys = c.keyframes.map((k) => k.year);
  if (ys.some((y, i) => i && y < ys[i - 1])) add('end-before-start', 'campaigns.json', c, `keyframes out of order: ${ys.join(', ')}`);
}

// Lifespans over 110 years (people only).
for (const r of events) {
  if (r.category !== 'person') continue;
  const d = r.endYear ?? deathYear(r);
  if (d != null && d - r.startYear > 110) add('lifespan', 'imported/events.json', r, `lifespan ${d - r.startYear} years (${r.startYear} to ${d})`);
}

// Raw Wikidata blank-node URLs in the Born / Died lines.
for (const r of events) {
  for (const k of ['born', 'died']) {
    if (typeof r[k] === 'string' && /wikidata\.org\/\.well-known\/genid/.test(r[k])) add('genid', 'imported/events.json', r, `${k}: ${r[k]}`);
  }
}

// Battles whose year falls outside the life of a person they link to.
const byWiki = new Map(events.filter((e) => e.category === 'person' && e.wikiTitle).map((e) => [e.wikiTitle, e]));
for (const r of b.battles) {
  for (const l of r.links ?? []) {
    const t = decodeURIComponent(String(l.url ?? '').split('/wiki/')[1] ?? '').replace(/_/g, ' ');
    const p = byWiki.get(t);
    if (!p) continue;
    const d = p.endYear ?? deathYear(p);
    if (r.year < p.startYear || (d != null && r.year > d)) add('outside-life', 'battles.json', r, `${r.year} is outside ${p.name} (${p.startYear} to ${d ?? '?'})`);
  }
}

// Land things in the open sea: every texel within two of the pin (about
// 40 km; one texel is ~19 km) is below sea level on the GEBCO elevation
// raster the globe's sea-level tool uses (metres = (R << 8 | G) - 11000).
const { default: sharp } = await import('sharp');
const { data: px, info } = await sharp('public/data/earth-elev-2048.png').raw().toBuffer({ resolveWithObject: true });
const elev = (x, y) => {
  const i = (Math.min(info.height - 1, Math.max(0, y)) * info.width + ((x + info.width) % info.width)) * info.channels;
  return ((px[i] << 8) | px[i + 1]) - 11000;
};
const openSea = (lat, lon) => {
  const x = Math.floor(((lon + 180) / 360) * info.width);
  const y = Math.floor(((90 - lat) / 180) * info.height);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (elev(x + dx, y + dy) >= 0) return false;
  return true;
};
const LAND = new Set(['person', 'city', 'monument']);
for (const r of events) {
  if (!LAND.has(r.category) || !Number.isFinite(r.lat) || (r.lat === 0 && r.lon === 0)) continue;
  if (openSea(r.lat, r.lon)) add('open-sea', 'imported/events.json', r, `(${r.lat}, ${r.lon}) is in the open sea`);
}
for (const r of s.sites) if (openSea(r.lat, r.lon)) add('open-sea', 'ancient-sites.json', r, `(${r.lat}, ${r.lon}) is in the open sea`);

// Swapped lat/lon and one Q-id in two places (the lint rules, reused).
const pins = handPlacedPins({ battles: b.battles, sites: s.sites, events });
for (const f of checkSwapped(pins, lookupFromHarvest(events))) out.push({ kind: 'swapped', file: f.file, id: f.id, msg: f.msg });
for (const f of checkQidCoords([
  { file: 'battles.json', rows: b.battles }, { file: 'ancient-sites.json', rows: s.sites }, { file: 'imported/events.json', rows: events },
])) out.push({ kind: 'qid-two-places', file: f.file, id: f.id, msg: f.msg });

const counts = {};
for (const f of out) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
for (const f of out) console.log(`${f.kind.padEnd(16)} ${f.file} · ${f.id} ${f.name ?? ''}: ${f.msg}`);
console.log('\n', counts);
const i = process.argv.indexOf('--json');
if (i > 0) await writeFile(process.argv[i + 1], JSON.stringify(out, null, 1));
