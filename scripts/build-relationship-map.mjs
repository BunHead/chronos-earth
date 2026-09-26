/**
 * build-relationship-map.mjs — who uses what, generated from the code itself.
 *
 * The Captain (26 Sept 2026): "a relationship diagram, to try and ensure going
 * forward that if we adjust one part, it shows how it might affect other
 * functions". A drawing goes stale the day after it is made, so this is built
 * from the source every time it runs:
 *
 *   imports     src and script files that import each other
 *   writes      a script that writes a public/data file
 *   reads       app code that fetches a public/data file
 *   runs        a GitHub workflow or a scheduled routine that runs a script
 *   tests       a test file that exercises a module
 *
 * Output: docs/relationship-map.json (the graph). The viewer page embeds it.
 *
 *   node scripts/build-relationship-map.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const code = [
  ...walk(join(ROOT, 'src')).filter((p) => /\.(tsx?|mjs|js)$/.test(p)),
  ...walk(join(ROOT, 'scripts')).filter((p) => /\.(mjs|cjs|js)$/.test(p) && !p.split(/[\\/]/).pop().startsWith('.')),
];
const text = new Map(code.map((p) => [p, readFileSync(p, 'utf8')]));
const nodes = new Map();
const edges = [];
const node = (id, kind) => { if (!nodes.has(id)) nodes.set(id, { id, kind }); return id; };
const kindOf = (id) =>
  /\.test\.tsx?$/.test(id) ? 'test'
    : id.startsWith('src/components/') ? 'component'
      : id.startsWith('src/') ? 'lib'
        : id.startsWith('scripts/') ? 'script'
          : 'other';
for (const p of code) node(rel(p), kindOf(rel(p)));

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
for (const [file, src] of text) {
  for (const m of src.matchAll(IMPORT_RE)) {
    const t = resolveImport(file, m[1] ?? m[2] ?? m[3]);
    if (!t || !text.has(t)) continue;
    edges.push({ from: rel(file), to: rel(t), kind: /\.test\.tsx?$/.test(file) ? 'tests' : 'imports' });
  }
}

// Data files: which scripts write them, which app code reads them. Paths are
// matched by their name under public/data (e.g. "imported/events.json").
const dataFiles = walk(join(ROOT, 'public', 'data'))
  .map((p) => rel(p).replace(/^public\/data\//, ''))
  .filter((p) => /\.(json|geojson)$/.test(p) && !/^(core-index|detail|regions)\/.+\.json$/.test(p) || /^(core-index|regions)\/(index|headline|search|manifest)\.json$/.test(p));
// Families of generated files are one node each.
const families = ['core-index/', 'detail/', 'regions/', 'borders/', 'paleo/', 'portraits/', 'battlemaps/'];
const dataId = (p) => {
  const fam = families.find((f) => p.startsWith(f) && !/^(borders\/countries|borders\/manifest|core-index\/search|core-index\/headline|paleo\/manifest|portraits\/manifest|battlemaps\/manifest)\.json$/.test(p));
  return `data/${fam ? `${fam}*` : p}`;
};
const dataIds = new Set(dataFiles.map(dataId));

/**
 * Does this script WRITE the data file, or only read it? A script that
 * writes anything used to count as writing everything it mentions, so
 * build-core-index "wrote" events.json (it reads it). Now: the file's path
 * must reach a write call — inline, or through the constant passed to it.
 */
function writesTo(src, key) {
  const pieces = key.replace(/\/$/, '').split('/').filter(Boolean);
  const mentions = (s) => pieces.every((p) => s.includes(p));
  const calls = [...src.matchAll(/(?:writeFile|writeFileSync|createWriteStream|mkdir|rm)\s*\(([^;]*?)[,)]/g)].map((m) => m[1]);
  for (const arg of calls) {
    if (mentions(arg)) return true;
    const name = arg.trim().match(/^[A-Za-z_$][\w$]*/)?.[0];
    if (!name) continue;
    const decl = src.match(new RegExp(`(?:const|let)\\s+${name}\\s*=([^;]+);`));
    if (decl && mentions(decl[1])) return true;
    // A directory constant joined with the file name at the call site.
    const joined = arg.match(/join\(\s*([A-Za-z_$][\w$]*)\s*,([^)]*)\)/);
    if (joined) {
      const d = src.match(new RegExp(`(?:const|let)\\s+${joined[1]}\\s*=([^;]+);`));
      if (d && mentions(d[1] + joined[2])) return true;
    }
  }
  return false;
}
for (const id of dataIds) node(id, 'data');
for (const [file, src] of text) {
  const isScript = rel(file).startsWith('scripts/');
  for (const id of dataIds) {
    const key = id.replace(/^data\//, '').replace(/\*$/, '');
    const leaf = key.split('/').filter(Boolean).pop();
    // A script mentions the file (path pieces or its name); app code fetches it.
    const hit = key.endsWith('/')
      ? src.includes(`'${key}`) || src.includes(`"${key}`) || src.includes(`\`${key}`) || src.includes(`data/${key}`) || src.includes(`'${key.slice(0, -1)}'`)
      : src.includes(key) || (isScript && leaf && src.includes(`'${leaf}'`) && src.includes(key.split('/')[0]));
    if (!hit) continue;
    if (isScript) {
      edges.push({ from: rel(file), to: id, kind: writesTo(src, key) ? 'writes' : 'reads' });
    } else if (!/\.test\.tsx?$/.test(file)) {
      edges.push({ from: id, to: rel(file), kind: 'reads' });
    } else {
      edges.push({ from: rel(file), to: id, kind: 'tests' });
    }
  }
}

// Who runs each script: GitHub workflows and the scheduled routines.
const runners = [
  ...walk(join(ROOT, '.github', 'workflows')).map((p) => [`workflow: ${p.split(/[\\/]/).pop()}`, readFileSync(p, 'utf8')]),
  ...walk(join(process.env.USERPROFILE ?? '', '.claude', 'scheduled-tasks'))
    .filter((p) => p.endsWith('SKILL.md'))
    .map((p) => [`routine: ${p.split(/[\\/]/).slice(-2, -1)[0]}`, readFileSync(p, 'utf8')]),
];
for (const [who, src] of runners) {
  for (const [file] of text) {
    const r = rel(file);
    if (!r.startsWith('scripts/')) continue;
    if (src.includes(r) || src.includes(r.split('/').pop())) {
      node(who, who.startsWith('workflow') ? 'workflow' : 'routine');
      edges.push({ from: who, to: r, kind: 'runs' });
    }
  }
}

// Dedupe edges.
const seen = new Set();
const out = edges.filter((e) => { const k = `${e.from}|${e.to}|${e.kind}`; if (seen.has(k)) return false; seen.add(k); return true; });
const lines = (id) => { const p = join(ROOT, id); return existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8').split('\n').length : undefined; };
const graph = {
  built: new Date().toISOString(),
  nodes: [...nodes.values()].map((n) => ({ ...n, lines: n.kind === 'data' || n.kind === 'workflow' || n.kind === 'routine' ? undefined : lines(n.id) })),
  edges: out,
};
writeFileSync(join(ROOT, 'docs', 'relationship-map.json'), JSON.stringify(graph));
const count = (k) => out.filter((e) => e.kind === k).length;
console.log(`${graph.nodes.length} nodes; ${out.length} links — imports ${count('imports')}, writes ${count('writes')}, reads ${count('reads')}, runs ${count('runs')}, tests ${count('tests')}`);

// The viewer: docs/relationship-map.template.html with this graph written in.
const TEMPLATE = join(ROOT, 'docs', 'relationship-map.template.html');
if (existsSync(TEMPLATE)) {
  const page = readFileSync(TEMPLATE, 'utf8').replace('/*__GRAPH__*/ null', JSON.stringify(graph));
  writeFileSync(join(ROOT, 'docs', 'relationship-map.html'), page);
  console.log('viewer: docs/relationship-map.html');
}
