// Chronos Earth — the Monument & Battle Auditor.
//
// A "harvester for correctness": it sweeps every monument and every battle in
// the data, works out which 3D archetype / battle template each one falls into
// and HOW, then flags the ones that are wrong-looking, generic, anachronistic,
// or frozen in time. It writes a plain-English worksheet to AUDIT-REPORT.md.
//
//   Run it:  npm run audit      (or: node scripts/audit.mjs)
//
// It changes NO app data — it only reads and reports. Nothing here costs money
// or touches the network; it reads the JSON already in the repo.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  classifyMonumentName, classifySite, ANCIENT_STONE_MODELS,
} from './monument-archetype.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const PRESENT_YEAR = 2026;

// ── Load the data ──────────────────────────────────────────────────────────
const sites = readJson('public/data/ancient-sites.json').sites;
const events = readJson('public/data/imported/events.json').events;
const battles = readJson('public/data/battles.json').battles;
const battleViews = readJson('public/data/battle-views.json').battleViews;
const curatedViewIds = new Set(Object.keys(battleViews));

const monumentEvents = events.filter((e) => e.category === 'monument');
const battleEvents = events.filter((e) => e.category === 'battle');

// ── Flag definitions (worst first) ───────────────────────────────────────────
// Each flag carries a weight; a monument's rank = sum of its flag weights.
const FLAG = {
  SUSPICIOUS_KEYWORD: { w: 100, label: '🔴 False-friend keyword (probably the wrong model)' },
  ANACHRONISM:        { w:  90, label: '🔴 Anachronism (modern thing wearing ancient stone)' },
  SHARED_CASTLE:      { w:  70, label: '🟠 Castle/fort → generic "settlement" boxes (all identical)' },
  GENERIC_MEGALITH:   { w:  50, label: '🟠 Generic "megalith" fallback (a nondescript stone pile)' },
  SHOULD_BE_PHASED:   { w:  40, label: '🟡 Known to have been destroyed/rebuilt — deserves phases over time' },
  NO_3D:              { w:  15, label: '⚪ No 3D model at all (panel only, no "View in 3D")' },
  BAD_COORDS:         { w:  35, label: '🟣 Missing or out-of-range coordinates' },
  MISSING_DATE:       { w:  30, label: '🟣 Missing / non-numeric date' },
};

// Institutional / modern words that, when they land on a monument MODEL, almost
// always mean the keyword matched a false friend (e.g. "Temple University").
const SUSPICIOUS_WORDS = /\b(university|college|school|museum|hotel|resort|station|stadium|arena|airport|hospital|library|theatre|theater|opera|concert|factory|mine|cemetery|gallery|market|prison|jail|bank|zoo|observatory|hall|company|club|park|garden|studios?|airfield|barracks|academy)\b/i;

// A small, honest SEED list of monuments whose real history involves being
// destroyed / burnt / rebuilt — so a single static model can't tell their
// story. The Captain can extend this; it is not meant to be exhaustive.
const REBUILT_WATCHLIST = [
  'notre-dame', 'nottingham castle', 'parthenon', 'colosseum', 'hagia sophia',
  "st paul", "st. paul", 'london bridge', 'crystal palace', 'reichstag',
  'frauenkirche', 'coventry cathedral', 'york minster', 'windsor castle',
  'warsaw', 'dresden', 'palmyra', 'bamiyan', 'mostar', 'pharos', 'alexandria',
  'temple of jerusalem', 'second temple', 'globe theatre',
];

const validYear = (y) => typeof y === 'number' && Number.isFinite(y);
const validCoord = (lat, lon) =>
  typeof lat === 'number' && typeof lon === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lon) &&
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
  !(lat === 0 && lon === 0);

// ── Audit one monument ───────────────────────────────────────────────────────
function auditMonument(name, year, lat, lon, source, cls) {
  const flags = [];
  const { model, rule } = cls;
  const lname = String(name).toLowerCase();

  if (model && SUSPICIOUS_WORDS.test(name)) flags.push('SUSPICIOUS_KEYWORD');
  if (model && ANCIENT_STONE_MODELS.has(model) && validYear(year) && year > 1500)
    flags.push('ANACHRONISM');
  if (model === 'settlement' && rule.startsWith('castle')) flags.push('SHARED_CASTLE');
  if (model === 'megalith' && /DEFAULT|temple.*bucket|megalith bucket/i.test(rule))
    flags.push('GENERIC_MEGALITH');
  if (model === null) flags.push('NO_3D');
  if (REBUILT_WATCHLIST.some((w) => lname.includes(w))) flags.push('SHOULD_BE_PHASED');
  if (!validCoord(lat, lon)) flags.push('BAD_COORDS');
  if (!validYear(year)) flags.push('MISSING_DATE');

  const score = flags.reduce((s, f) => s + (FLAG[f]?.w || 0), 0);
  return { name, year, lat, lon, source, model, rule, flags, score };
}

const monuments = [
  ...sites.map((s) =>
    auditMonument(s.name, s.builtYear, s.lat, s.lon, 'curated site', classifySite(s))),
  ...monumentEvents.map((e) =>
    auditMonument(e.name, e.startYear, e.lat, e.lon, 'imported event', classifyMonumentName(e.name))),
];

// ── Audit battles ────────────────────────────────────────────────────────────
const namedBattles = battles.map((b) => ({
  name: b.name, year: b.year, id: b.id,
  curated: curatedViewIds.has(b.id) || b.hasBattleView === true,
}));
const genericNamed = namedBattles.filter((b) => !b.curated);

// ── Tallies ──────────────────────────────────────────────────────────────────
const modelCounts = {};
for (const m of monuments) {
  const k = m.model || '(none)';
  modelCounts[k] = (modelCounts[k] || 0) + 1;
}
const flagCounts = {};
for (const m of monuments) for (const f of m.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;

const fmtYear = (y) =>
  !validYear(y) ? '??' : y < 0 ? `${-y} BCE` : `${y} CE`;

// ── Build the report ─────────────────────────────────────────────────────────
const L = [];
const p = (s = '') => L.push(s);
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

p('# Chronos Earth — Monument & Battle Audit');
p('');
p(`_Generated ${now} by \`npm run audit\`. Reads only; changes nothing._`);
p('');
p('This is the worksheet for the "old template" problem. It lists every monument');
p('and battle, the 3D archetype the app hands it, **how** it got that archetype,');
p('and every entry that looks wrong, generic, out-of-period, or frozen in time.');
p('');

// Summary
p('## At a glance');
p('');
p(`- **Monuments checked:** ${monuments.length}  (${sites.length} curated sites + ${monumentEvents.length} imported)`);
p(`- Monuments with a 3D model: **${monuments.filter((m) => m.model).length}** · with no 3D button: **${monuments.filter((m) => !m.model).length}**`);
p(`- **Battles checked:** ${namedBattles.length + battleEvents.length}  (${namedBattles.length} named + ${battleEvents.length} imported)`);
p(`- Battles with hand-crafted phased choreography: **${namedBattles.filter((b) => b.curated).length}** · running the generic template: **${genericNamed.length + battleEvents.length}**`);
p('');
p('### Flags raised (monuments)');
p('');
p('| Count | Flag |');
p('|------:|------|');
for (const [f, def] of Object.entries(FLAG)) {
  if (flagCounts[f]) p(`| ${flagCounts[f]} | ${def.label} |`);
}
p('');

// Worst offenders
const ranked = monuments.filter((m) => m.score > 0).sort((a, b) => b.score - a.score);
p('## Worst offenders (top 40)');
p('');
p('The entries most worth fixing first, hardest-first by severity.');
p('');
p('| Monument | Date | Source | Model | How it was chosen | Problems |');
p('|----------|------|--------|-------|-------------------|----------|');
for (const m of ranked.slice(0, 40)) {
  const probs = m.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join('; ');
  p(`| ${m.name} | ${fmtYear(m.year)} | ${m.source} | ${m.model || '—'} | ${m.rule} | ${probs} |`);
}
p('');

// Per-flag full lists
p('## Full lists by problem');
p('');
for (const [f, def] of Object.entries(FLAG)) {
  const hits = monuments.filter((m) => m.flags.includes(f));
  if (!hits.length) continue;
  p(`### ${def.label} — ${hits.length}`);
  p('');
  for (const m of hits.sort((a, b) => (a.year ?? 0) - (b.year ?? 0))) {
    p(`- **${m.name}** (${fmtYear(m.year)}, ${m.source}) → \`${m.model || 'no model'}\` — _${m.rule}_`);
  }
  p('');
}

// Model distribution
p('## How many monuments wear each archetype');
p('');
p('A model carrying a big share of very different buildings is a template doing');
p('too much work (this is why every castle looks the same).');
p('');
p('| Model | Count |');
p('|-------|------:|');
for (const [k, n] of Object.entries(modelCounts).sort((a, b) => b[1] - a[1])) {
  p(`| ${k} | ${n} |`);
}
p('');

// Time-pass
p('## Over-time pass (the "watch it get built / burnt / rebuilt" check)');
p('');
p('Right now the timeline year does **not** change any monument\'s appearance.');
p('Only **Stonehenge** offers phases, and only via a manual selector inside its');
p('own 3D viewer — nothing rebuilds itself as you scrub time. So every monument');
p('below renders one fixed archetype from the moment it appears to the present.');
p('');
const phaseHits = monuments.filter((m) => m.flags.includes('SHOULD_BE_PHASED'));
p(`**${phaseHits.length}** monuments in the data are on the destroyed/rebuilt seed`);
p('watchlist — these are the first candidates for a phase-over-time treatment');
p('(built → altered → destroyed → rebuilt), the same idea as Stonehenge\'s phases:');
p('');
for (const m of phaseHits.sort((a, b) => (a.year ?? 0) - (b.year ?? 0))) {
  p(`- **${m.name}** (${fmtYear(m.year)}) → currently a static \`${m.model || 'no model'}\``);
}
if (!phaseHits.length) p('- _(none of the seed names are present in the current data)_');
p('');
p('_The watchlist is a hand-seeded starting point, not exhaustive — extend it in');
p('`scripts/monument-archetype.mjs`\'s neighbour `scripts/audit.mjs`._');
p('');

// Battles
p('## Battles — choreography coverage');
p('');
p(`Of ${namedBattles.length} named battles, **${namedBattles.filter((b) => b.curated).length}** have real phase-by-phase`);
p(`choreography; **${genericNamed.length}** named battles + **${battleEvents.length}** imported battles use the`);
p('generic "two lines meet in the middle" template. These named battles are the');
p('best candidates for hand-authored, historically accurate movement next:');
p('');
for (const b of genericNamed.sort((a, b) => a.year - b.year)) {
  p(`- **${b.name}** (${fmtYear(b.year)}) — id \`${b.id}\``);
}
p('');

writeFileSync(join(ROOT, 'AUDIT-REPORT.md'), L.join('\n'), 'utf8');

// ── Console summary ──────────────────────────────────────────────────────────
console.log('Monument & Battle audit complete → AUDIT-REPORT.md');
console.log('');
console.log(`Monuments: ${monuments.length}  (${monuments.filter((m) => m.model).length} with 3D, ${monuments.filter((m) => !m.model).length} without)`);
for (const [f, def] of Object.entries(FLAG)) {
  if (flagCounts[f]) console.log(`  ${String(flagCounts[f]).padStart(4)}  ${def.label}`);
}
console.log('');
console.log(`Battles: ${namedBattles.length + battleEvents.length} total, ${namedBattles.filter((b) => b.curated).length} with phased choreography, ${genericNamed.length + battleEvents.length} generic.`);
