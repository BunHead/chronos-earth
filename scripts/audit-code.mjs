/**
 * audit-code.mjs — find code nothing uses, scripts nothing runs, and helpers
 * written more than once. Report only; it changes nothing.
 *
 * Written for the full audit the Captain asked for (26 Sept 2026): "errors,
 * orphan states, duplicate code, redundancies". Deliberately dependency-free
 * (a regex import graph, not a TypeScript program), so it can over-report a
 * little — every finding is a lead to check, not a verdict.
 *
 *   node scripts/audit-code.mjs            # human report
 *   node scripts/audit-code.mjs --json     # machine-readable, for the diagram
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const SRC = walk(join(ROOT, 'src')).filter((p) => /\.(tsx?|mjs|js)$/.test(p));
const SCRIPTS = readdirSync(join(ROOT, 'scripts'))
  .filter((n) => /\.(mjs|cjs|js)$/.test(n) && !n.startsWith('.'))
  .map((n) => join(ROOT, 'scripts', n));
const LIB = existsSync(join(ROOT, 'scripts', 'lib')) ? walk(join(ROOT, 'scripts', 'lib')) : [];
const ALL = [...SRC, ...SCRIPTS, ...LIB];
const text = new Map(ALL.map((p) => [p, readFileSync(p, 'utf8')]));

/** Resolve a relative import to a real file. */
function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// ── the import graph ────────────────────────────────────────────────────────
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const edges = new Map(); // file -> Set(file)
const importedNames = new Map(); // file -> Set(name) imported from it (by anyone)
for (const [file, src] of text) {
  const set = new Set();
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const target = resolveImport(file, spec);
    if (!target) continue;
    set.add(target);
    const names = importedNames.get(target) ?? new Set();
    const clause = m[0].match(/\{([\s\S]*?)\}/);
    if (clause) for (const n of clause[1].split(',')) {
      const name = n.replace(/\btype\b/, '').trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
    if (/import\s+\w+\s*(,|from)/.test(m[0]) || /import\s*\(/.test(m[0]) || /\*\s+as/.test(m[0])) names.add('*default*');
    importedNames.set(target, names);
  }
  edges.set(file, set);
}

// Entry points: HTML entries, the vite config, tests, and every script (run by hand/CI).
const htmlEntries = readdirSync(ROOT).filter((n) => n.endsWith('.html'))
  .flatMap((n) => [...readFileSync(join(ROOT, n), 'utf8').matchAll(/src="\/?([^"]+\.(?:tsx?|js))"/g)].map((m) => join(ROOT, m[1])));
const entries = new Set([...htmlEntries, ...SRC.filter((p) => /\.test\.tsx?$/.test(p)), ...SCRIPTS]);

// Reachability from the APP entries only (tests excluded), to find code only tests use.
function reach(starts) {
  const seen = new Set();
  const stack = [...starts];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const t of edges.get(f) ?? []) stack.push(t);
  }
  return seen;
}
const fromApp = reach(htmlEntries);
const fromAnything = reach([...entries]);

const report = { unusedFiles: [], testOnlyFiles: [], unusedExports: [], orphanScripts: [], duplicates: [], silentCatches: [], htmlEntries: htmlEntries.map(rel) };

for (const f of SRC) {
  if (/\.test\.tsx?$/.test(f) || /\.d\.ts$/.test(f)) continue;
  if (!fromAnything.has(f)) report.unusedFiles.push(rel(f));
  else if (!fromApp.has(f)) report.testOnlyFiles.push(rel(f));
}

// Exports nobody imports (by name) — excluding default exports and entry files.
const EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
for (const f of SRC) {
  if (/\.test\.tsx?$/.test(f) || entries.has(f)) continue;
  const used = importedNames.get(f) ?? new Set();
  const src = text.get(f);
  for (const m of src.matchAll(EXPORT_RE)) {
    const name = m[1];
    if (used.has(name)) continue;
    // Used inside its own file counts as "not dead", just "needlessly exported".
    const localUses = (src.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length - 1;
    report.unusedExports.push({ file: rel(f), name, usedLocally: localUses > 0 });
  }
}

// Scripts nothing mentions: not in package.json, workflows, docs, other scripts or routines.
const mentionSources = [
  readFileSync(join(ROOT, 'package.json'), 'utf8'),
  ...walk(join(ROOT, '.github')).map((p) => readFileSync(p, 'utf8')),
  ...(existsSync(join(ROOT, 'docs')) ? walk(join(ROOT, 'docs')).filter((p) => p.endsWith('.md')).map((p) => readFileSync(p, 'utf8')) : []),
  ...readdirSync(ROOT).filter((n) => n.endsWith('.md')).map((n) => readFileSync(join(ROOT, n), 'utf8')),
  ...[...text.values()],
].join('\n');
const tasksDir = join(process.env.USERPROFILE ?? '', '.claude', 'scheduled-tasks');
const routineText = existsSync(tasksDir) ? walk(tasksDir).filter((p) => p.endsWith('SKILL.md')).map((p) => readFileSync(p, 'utf8')).join('\n') : '';
for (const s of SCRIPTS) {
  const name = rel(s).split('/').pop();
  const mentions = (mentionSources.match(new RegExp(name.replace('.', '\\.'), 'g')) ?? []).length;
  const selfMentions = (text.get(s).match(new RegExp(name.replace('.', '\\.'), 'g')) ?? []).length;
  if (mentions - selfMentions <= 0 && !routineText.includes(name)) report.orphanScripts.push(rel(s));
}

// The same small helper written in several files: identical function names.
const FN_RE = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
const byName = new Map();
for (const [f, src] of text) {
  if (/\.test\.tsx?$/.test(f)) continue;
  for (const m of src.matchAll(FN_RE)) {
    const n = m[1] ?? m[2];
    if (!/^(haversine|distKm|distanceKm|separationKm|pointInRing|pointInPolygon|coreName|norm|fold|clamp|lerp|yearLabel|parseYear|yearOf|parseCoord|sleep|kmBetween|toRad|interiorPoint|ringArea|median|runQuery)$/.test(n)) continue;
    (byName.get(n) ?? byName.set(n, []).get(n)).push(rel(f));
  }
}
for (const [n, files] of byName) if (files.length > 1) report.duplicates.push({ name: n, count: files.length, files });
report.duplicates.sort((a, b) => b.count - a.count);

// catch blocks that swallow the error without a word.
for (const [f, src] of text) {
  if (/\.test\.tsx?$/.test(f)) continue;
  const lines = src.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l)) report.silentCatches.push(`${rel(f)}:${i + 1}`);
  });
}

if (process.argv.includes('--json')) {
  const graph = {};
  for (const [f, set] of edges) graph[rel(f)] = [...set].map(rel);
  console.log(JSON.stringify({ ...report, graph }, null, 1));
} else {
  const h = (t, n) => console.log(`\n== ${t} (${n})`);
  h('source files nothing imports', report.unusedFiles.length); report.unusedFiles.forEach((f) => console.log('  ' + f));
  h('source files only tests import', report.testOnlyFiles.length); report.testOnlyFiles.forEach((f) => console.log('  ' + f));
  const dead = report.unusedExports.filter((e) => !e.usedLocally);
  h('exports used nowhere at all', dead.length); dead.forEach((e) => console.log(`  ${e.file}  ${e.name}`));
  h('exports used only inside their own file', report.unusedExports.length - dead.length);
  h('scripts nothing refers to', report.orphanScripts.length); report.orphanScripts.forEach((f) => console.log('  ' + f));
  h('helpers written more than once', report.duplicates.length); report.duplicates.forEach((d) => console.log(`  ${d.name} ×${d.count}: ${d.files.join(', ')}`));
  h('empty catch blocks', report.silentCatches.length); report.silentCatches.slice(0, 40).forEach((f) => console.log('  ' + f));
}
