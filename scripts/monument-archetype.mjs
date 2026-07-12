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

/**
 * Monuments whose real form a generic archetype would MISREPRESENT — better to
 * show no 3D button (just the real photo in the panel) than a misleading model.
 * Policy: "prefer no 3D to a wrong one." Keys are lowercased full names.
 * Reviewed by scripts/verify-3d.mjs (a cheap-AI pass); MIRRORED in panel.ts
 * (the parity test enforces it).
 */
export const NO_3D_NAMES = new Set([
  // Seed: keyword false-friends.
  'elmina castle', // a low West African coastal trade fort, not a turreted keep
  'riber castle', // a Victorian Gothic folly, not a medieval castle
  'brimstone hill fortress national park', // a fortress park, not a single keep
  'forth bridge', // a railway bridge (snared by "forth" ⊃ "fort")
  // From the cheap-AI (Haiku) correctness review — the generic archetype would
  // misrepresent these distinctive real forms (palace≠keep, mosque/onion-dome/
  // rock-cut/Gaudí≠Gothic cathedral, non-European castles). Show the photo.
  'palace of versailles',
  'drottningholm palace',
  'blenheim palace',
  'stoclet palace',
  'château de chambord',
  'alhambra',
  'potala palace',
  'agra fort',
  'himeji castle',
  'fort de loncin',
  'mosque-cathedral of cordoba',
  "saint basil's cathedral",
  'saint sophia cathedral',
  'church of the nativity',
  'sagrada família',
  'basilica and expiatory church of the holy family',
  'rock churches of lalibela',
  'church of saint george',
  'church of our lady mary of zion',
  'church of cristo obrero y nuestra señora de lourdes',
  'angkor wat',
  // (Colosseum un-suppressed 2026-07-10: the amphitheatre model now has real
  // see-through arches and builds its own broken-ring ruin form.)
  // From the overnight cheap-AI (Haiku) verify pass, 2026-07-07 — WRONG-FAMILY
  // cases where the generic archetype badly misrepresents the real form (three
  // independent reviewers, high confidence). See AI-VERIFY-REPORT.md.
  'aachen cathedral', // Carolingian octagonal palatine chapel, not a twin-tower Gothic
  'speyer cathedral', // Romanesque — round arches & four towers, no Gothic spire
  'cusco cathedral', // Andean Baroque colonial, not Gothic
  'newstead abbey', // a ruined priory turned country house, not an intact cathedral
  'castel del monte', // a unique octagonal castle, not a square keep
  'neuschwanstein castle', // a fairy-tale Revival castle a plain keep can't convey
  'cahokia', // great earthen mounds, not a stone stepped-pyramid
  'borobudur', // a Buddhist stupa-mandala, not a Mesoamerican stepped-pyramid
  'borobudur temple',
  // Judgment calls from AI-VERIFY-REPORT.md, greenlit 2026-07-08 — suppressed.
  'malbork castle', // the world's largest BRICK castle; a grey stone keep understates it
  'tournai cathedral', // Romanesque five-tower silhouette, not twin-tower Gothic
  'konark sun temple', // a stone chariot with wheels — too distinctive for a spired temple
  'peveril castle', // a fragmentary Norman ruin; an intact keep overstates it
]);

/** Every 3D archetype buildModel() in Monument3D.tsx can actually render. */
export const VALID_MODELS = [
  'tpillars', 'stonehenge', 'pyramid', 'stepped-pyramid', 'sphinx', 'circle',
  'settlement', 'castle', 'mansion', 'cathedral', 'greek-temple', 'temple-tower',
  'aqueduct', 'pagoda', 'lighthouse', 'leaning-tower', 'amphitheatre', 'impact', 'megalith', 'rings',
  // Seven Wonders of the Ancient World (+ the Giza plateau scene).
  'hanging-gardens', 'zeus-statue', 'artemis-temple', 'mausoleum', 'colossus', 'pharos', 'giza',
  // London landmarks.
  'buckingham', 'westminster', 'london-eye',
  'tower-bridge', 'st-pauls', 'tower-of-london', 'shard', 'gherkin',
  // New York.
  'liberty',
  // Paris.
  'eiffel', 'arc-triomphe', 'louvre',
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
  { rule: 'leaning tower keyword', model: 'leaning-tower', re: /leaning tower|torre di pisa/ },
  { rule: 'amphitheatre keyword', model: 'amphitheatre', re: /colosseum|colise|amphitheatre|amphitheater/ },
  { rule: 'London Eye keyword', model: 'london-eye', re: /london eye|millennium wheel/ },
  { rule: 'Buckingham Palace keyword', model: 'buckingham', re: /buckingham/ },
  { rule: 'Palace of Westminster / Big Ben keyword', model: 'westminster', re: /palace of westminster|houses of parliament|big ben|elizabeth tower/ },
  { rule: 'Tower Bridge keyword', model: 'tower-bridge', re: /tower bridge/ },
  { rule: "St Paul's Cathedral keyword (before the cathedral bucket)", model: 'st-pauls', re: /st\.? paul/ },
  { rule: 'Tower of London / White Tower keyword', model: 'tower-of-london', re: /tower of london|white tower/ },
  { rule: 'The Shard keyword', model: 'shard', re: /the shard|shard london/ },
  { rule: 'Gherkin / 30 St Mary Axe keyword', model: 'gherkin', re: /gherkin|30 st mary axe/ },
  { rule: 'Statue of Liberty keyword', model: 'liberty', re: /statue of liberty/ },
  { rule: 'Eiffel Tower exact-name keyword', model: 'eiffel', re: /^(the )?(eiffel tower|tour eiffel)$/ },
  { rule: 'Arc de Triomphe keyword (not the Carrousel arch)', model: 'arc-triomphe', re: /arc de triomphe(?! du carrousel)/ },
  { rule: 'Louvre keyword (before the palace/castle bucket)', model: 'louvre', re: /palais du louvre|louvre palace|louvre museum|mus[eé]e du louvre|^(the )?louvre$/ },
  { rule: 'castle/fort/palace keyword (word-boundaried)', model: 'castle', re: /\b(castle|castel|fort|citadel|palace|palais|alc[aá]zar|ch[aâ]teau|kremlin)\b|alhambra/ },
  { rule: 'cathedral/church keyword', model: 'cathedral', re: /cathedral|basilica|minster|abbey|church|notre-dame|sagrada|duomo/ },
  { rule: 'greek-temple keyword', model: 'greek-temple', re: /parthenon|acropolis|greek temple|temple of (zeus|apollo|artemis|athena|poseidon|hera)/ },
  { rule: 'South/SE-Asian temple keyword → spired temple', model: 'temple-tower', re: /prambanan|preah vihear|konark|khajuraho|brihadeeswara|kailasa|virupaksha|candi / },
  // No generic "temple"/"wat" → megalith rule: a plain "Temple of X" rendered as
  // random standing stones misleads (see the Temple of Ellesyia). It shows the
  // photo instead. Truly megalithic sites reach 'megalith' via their id map.
];

/**
 * Pick a 3D model for an imported monument event from its name, tracking which
 * rule fired. `model` is null when nothing matched (no 3D button in the app).
 * @param {string} name
 * @returns {{ model: string|null, rule: string }}
 */
export function classifyMonumentName(name) {
  const n = String(name).toLowerCase();
  if (NO_3D_NAMES.has(n.trim())) return { model: null, rule: 'suppressed — a generic model would misrepresent it' };
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
