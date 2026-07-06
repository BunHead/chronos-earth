// Chronos Earth — monument archetype classifier (shared, dependency-free).
//
// This MIRRORS the app's real logic in src/lib/panel.ts (monumentModelForName,
// MODEL_BY_ID, resolveMonumentModel). It is kept in plain ESM so BOTH a plain
// `node` script (the auditor) and the test suite can import it. A parity test
// (src/lib/audit.test.ts) asserts this file agrees with panel.ts on every name
// in the live data, so the two can never silently drift apart.
//
// The rule-tracked variants (classifyMonumentName / classifySite) return not
// just the chosen 3D model but WHICH branch chose it — that "how" is the whole
// point of the audit report.

/** Every 3D archetype buildModel() in Monument3D.tsx can actually render. */
export const VALID_MODELS = [
  'tpillars', 'stonehenge', 'pyramid', 'stepped-pyramid', 'sphinx', 'circle',
  'settlement', 'cathedral', 'greek-temple', 'aqueduct', 'pagoda', 'lighthouse',
  'impact', 'megalith',
];

/** Ancient-stone archetypes — believable only for genuinely ancient things.
 * A monument dated to the modern era wearing one of these is an anachronism. */
export const ANCIENT_STONE_MODELS = new Set([
  'tpillars', 'stonehenge', 'pyramid', 'stepped-pyramid', 'sphinx', 'circle',
  'megalith', 'impact',
]);

/** Curated ancient-site id → model, verbatim from panel.ts MODEL_BY_ID. */
export const MODEL_BY_ID = {
  'gobekli-tepe': 'tpillars',
  'karahan-tepe': 'tpillars',
  catalhoyuk: 'settlement',
  'nabta-playa': 'circle',
  stonehenge: 'stonehenge',
  'giza-pyramids': 'pyramid',
  'great-sphinx': 'sphinx',
  pumapunku: 'megalith',
  'gunung-padang': 'megalith',
  'younger-dryas-impact': 'impact',
};

// The keyword cascade, expressed as ordered {rule, re, model} rows so the
// auditor can report which row fired. The order and patterns are identical to
// panel.ts monumentModelForName — keep them in lock-step (the parity test will
// shout if they diverge).
const KEYWORD_RULES = [
  { rule: 'mesoamerican/temple-mountain keyword', model: 'stepped-pyramid', re: /teotihuac|tikal|chich[eé]n|taj[ií]n|monte alb|borobudur|angkor|ziggurat|uxmal|cop[aá]n|caracol|cahokia|templo mayor|step pyramid/ },
  { rule: '"sphinx" keyword', model: 'sphinx', re: /sphinx/ },
  { rule: '"pyramid"/"giza" keyword', model: 'pyramid', re: /pyramid|giza/ },
  { rule: '"stonehenge" keyword', model: 'stonehenge', re: /stonehenge/ },
  { rule: 'stone-circle keyword', model: 'circle', re: /henge|stone circle|carnac|avebury/ },
  { rule: '"aqueduct" keyword', model: 'aqueduct', re: /aqueduct|pont du gard/ },
  { rule: '"pagoda" keyword', model: 'pagoda', re: /pagoda/ },
  { rule: 'lighthouse keyword', model: 'lighthouse', re: /lighthouse|pharos/ },
  { rule: 'castle/fort/palace keyword → generic settlement', model: 'settlement', re: /castle|fort|citadel|palace|alham|kremlin/ },
  { rule: 'cathedral/church keyword', model: 'cathedral', re: /cathedral|basilica|minster|abbey|church|notre-dame|sagrada|duomo/ },
  { rule: 'greek-temple keyword', model: 'greek-temple', re: /parthenon|acropolis|greek temple|temple of (zeus|apollo|artemis|athena|poseidon|hera)/ },
  { rule: 'generic "temple"/"wat" → megalith bucket', model: 'megalith', re: /temple|wat / },
];

/**
 * Pick a 3D model for an imported monument event from its name, tracking which
 * rule fired. `model` is null when nothing matched (no 3D button in the app).
 * @param {string} name
 * @returns {{ model: string|null, rule: string }}
 */
export function classifyMonumentName(name) {
  const n = String(name).toLowerCase();
  for (const row of KEYWORD_RULES) {
    if (row.re.test(n)) return { model: row.model, rule: row.rule };
  }
  return { model: null, rule: 'no keyword matched → no 3D button' };
}

/** Plain form matching panel.ts monumentModelForName exactly (for parity test). */
export function monumentModelForName(name) {
  return classifyMonumentName(name).model;
}

/**
 * Resolve a curated ancient-site to a model, tracking how, matching panel.ts
 * resolveMonumentModel (explicit .model → id map → category → megalith default).
 * @param {{id?:string, model?:string, category?:string}} site
 * @returns {{ model: string, rule: string }}
 */
export function classifySite(site) {
  if (site.model) return { model: site.model, rule: 'explicit .model field' };
  if (MODEL_BY_ID[site.id]) return { model: MODEL_BY_ID[site.id], rule: `hand-mapped by id (${site.id})` };
  if (site.category === 'settlement') return { model: 'settlement', rule: 'category = settlement' };
  if (site.category === 'precursor-hypothesis') return { model: 'impact', rule: 'category = precursor-hypothesis' };
  return { model: 'megalith', rule: 'DEFAULT — no rule matched, generic megalith' };
}

/** Plain form matching panel.ts resolveMonumentModel exactly (for parity test). */
export function resolveMonumentModel(site) {
  return classifySite(site).model;
}
