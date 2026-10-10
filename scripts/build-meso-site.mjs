/**
 * build-meso-site.mjs — a whole Mesoamerican (or Andean) site from its OSM plan.
 *
 * Reads scripts/data/osm/<site>.json (fetch-osm-site.mjs) and the site's recipe
 * scripts/data/sites/<site>.mjs, and writes:
 *
 *   src/data/meso-temples.json — the great temples, each a true-metre model
 *     (buildMesoTemple in Monument3D) with its footprint measured off the OSM
 *     outline (an oriented bounding box), its stair bearing, height, levels
 *     and date. Shared by the exporter, the fit table and the globe.
 *   public/data/siteplans/<site>.json — every other structure as ground-
 *     hugging site-plan parts (platforms, walls, plazas) for sitePlanRender,
 *     so a kilometre of hilly site follows the real terrain.
 *
 * WHAT IS MEASURED AND WHAT IS ESTIMATED. Outlines and positions are OSM's.
 * Heights of named structures are the recipe's, each sourced there. Unnamed
 * structures have no published height, so they are given a modest one from
 * their footprint (3 m for a small house mound up to 12 m for the largest) and
 * labelled "height estimated" — enough to read as the mounds they are, never
 * passed off as measured. Modern buildings (no historic tag) are left out.
 *
 *   node scripts/build-meso-site.mjs tikal
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const site = process.argv[2];
if (!site) { console.error('usage: node scripts/build-meso-site.mjs <site>'); process.exit(1); }

const osm = JSON.parse(await readFile(join(__dirname, 'data', 'osm', `${site}.json`), 'utf8'));
const recipe = (await import(pathToFileURL(join(__dirname, 'data', 'sites', `${site}.mjs`)).href)).default;
const { lat: LAT0, lon: LON0 } = osm.centre;
const M_LAT = 111_320;
const M_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const toXY = ([la, lo]) => [(lo - LON0) * M_LON, (la - LAT0) * M_LAT]; // x east, y north
const BEARING = { N: 0, E: 90, S: 180, W: 270 };

const isClosed = (o) => o.length >= 4 && o[0][0] === o.at(-1)[0] && o[0][1] === o.at(-1)[1];
function area(o) {
  let a = 0;
  for (let i = 0; i < o.length - 1; i++) {
    const [x1, y1] = toXY(o[i]);
    const [x2, y2] = toXY(o[i + 1]);
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}
function centroid(o) {
  const pts = isClosed(o) ? o.slice(0, -1) : o;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Minimum-area oriented box: angle (deg, compass bearing of axis u) and extents. */
export function orientedBox(o) {
  const pts = o.map(toXY);
  let best = null;
  for (let a = 0; a < 180; a += 0.5) {
    const t = (a * Math.PI) / 180;
    // u points along compass bearing a: (sin a, cos a) in (east, north).
    const ux = Math.sin(t), uy = Math.cos(t);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of pts) {
      const u = x * ux + y * uy;
      const v = -x * uy + y * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const ar = (maxU - minU) * (maxV - minV);
    if (!best || ar < best.ar) best = { ar, bearing: a, lenU: maxU - minU, lenV: maxV - minV };
  }
  return best;
}

const temples = [];
const parts = [];
const used = new Set();
const angDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

for (const w of osm.ways) {
  const name = w.tags.name;
  const spec = name && recipe.temples[name];
  if (spec) {
    if (used.has(spec.model)) continue; // OSM may hold a second outline of one temple
    used.add(spec.model);
    const box = orientedBox(w.outline);
    // The stair axis is whichever box axis lies nearest the recipe's compass
    // direction; that axis's length is the pyramid's DEPTH (front to back).
    const nominal = BEARING[spec.stair];
    const cands = [box.bearing, box.bearing + 90, box.bearing + 180, box.bearing + 270].map((b) => b % 360);
    const stairBearing = cands.reduce((p, c) => (angDiff(c, nominal) < angDiff(p, nominal) ? c : p));
    const alongU = angDiff(stairBearing, box.bearing) < 45 || angDiff(stairBearing, box.bearing + 180) < 45;
    const depthM = alongU ? box.lenU : box.lenV;
    const widthM = alongU ? box.lenV : box.lenU;
    const [cla, clo] = centroid(w.outline);
    temples.push({
      site, model: spec.model, title: spec.title,
      lat: +cla.toFixed(6), lon: +clo.toFixed(6),
      widthM: +widthM.toFixed(1), depthM: +depthM.toFixed(1),
      stairBearing: +stairBearing.toFixed(1),
      heightM: spec.heightM, levels: spec.levels, radial: !!spec.radial, ...(spec.templeM ? { templeM: spec.templeM } : {}), ...(spec.stairsInOutline ? { stairsInOutline: true } : {}), ...(spec.sideStairsTo ? { sideStairsTo: spec.sideStairsTo } : {}),
      builtYear: spec.builtYear, ruinYear: spec.ruinYear ?? recipe.ruinYear ?? 900, note: spec.note, osmWay: w.id,
    });
    continue;
  }
  // Modern buildings, toilets, the ticket office: not part of the ancient site.
  const named = name && recipe.named[name];
  const ancient = w.tags.historic || w.tags.ruins || named;
  if (!ancient) continue;
  // The whole site's protected-area boundary is not a building.
  if (!named && (w.tags.boundary || w.tags.leisure === 'nature_reserve' || w.tags.archaeological_site === 'city')) continue;
  const verts = (isClosed(w.outline) ? w.outline.slice(0, -1) : w.outline).map(([a, b]) => [a, b]);
  const label = name ?? (w.tags.historic === 'yes' && w.tags.barrier === 'wall' ? 'Structure (unnamed)' : 'Structure (unnamed)');
  const fromYear = named?.fromYear ?? recipe.defaultFromYear;
  if (named?.role === 'ballcourt') {
    // Two parallel platforms along the court's long axis, flanking the alley.
    const box = orientedBox(w.outline);
    const [cla, clo] = centroid(w.outline);
    const longU = box.lenU >= box.lenV;
    const axis = longU ? box.bearing : box.bearing + 90; // compass bearing of the long axis
    const across = longU ? box.lenV : box.lenU;
    const off = across / 2 - named.platformWidthM / 2;
    const t = ((axis + 90) * Math.PI) / 180; // perpendicular, to either side
    for (const sgn of [-1, 1]) {
      const de = Math.sin(t) * off * sgn;
      const dn = Math.cos(t) * off * sgn;
      parts.push({
        type: 'box', lat: +(cla + dn / M_LAT).toFixed(7), lon: +(clo + de / M_LON).toFixed(7),
        // Box width runs east-west at rotation 0; turn it so its LENGTH lies
        // along the court's axis.
        widthM: named.platformWidthM, lengthM: named.platformLengthM, heightM: named.heightM,
        rotationDeg: +(axis % 180).toFixed(1), color: '#c9c0a8', label: `${label} — ${named.note}`, fromYear,
      });
    }
    parts.push({ type: 'platform', verts, heightM: 0.3, color: '#d6cebb', label: `${label} (playing alley)`, fromYear });
  } else if (named?.role === 'estimate') {
    const a = area(w.outline);
    parts.push({ type: 'platform', verts, heightM: +Math.max(3, Math.min(14, 3 + Math.sqrt(a) / 5)).toFixed(1), color: '#bfb5a0', label: `${label} — height estimated`, fromYear });
  } else if (named?.role === 'plaza') {
    parts.push({ type: 'platform', verts, heightM: named.heightM, color: '#d6cebb', label, fromYear });
  } else if (named?.role === 'platform') {
    parts.push({ type: 'platform', verts, heightM: named.heightM, color: named.color ?? '#c9c0a8', label: `${label} — ${named.note}`, fromYear });
  } else if (named?.role === 'wall' || !isClosed(w.outline)) {
    // Open lines in this survey are platform and terrace edges.
    parts.push({ type: 'wall', verts, thicknessM: named?.thicknessM ?? 1.5, heightM: named?.heightM ?? 2, color: '#b9ae98', label, fromYear });
  } else {
    const a = area(w.outline);
    const pitch = w.tags.leisure === 'pitch';
    const h = pitch ? 2.5 : Math.max(3, Math.min(12, 3 + Math.sqrt(a) / 6));
    parts.push({
      type: 'platform', verts, heightM: +h.toFixed(1), color: '#bfb5a0',
      label: `${label}${pitch ? ' (ball court)' : ''} — height estimated`, fromYear,
    });
  }
}

// --- write the temples (merged across sites) ---
const TFILE = join(ROOT, 'src', 'data', 'meso-temples.json');
await mkdir(dirname(TFILE), { recursive: true });
let all = [];
try { all = JSON.parse(await readFile(TFILE, 'utf8')); } catch { /* first site */ }
all = all.filter((t) => t.site !== site).concat(temples);
await writeFile(TFILE, JSON.stringify(all, null, 1) + '\n');

// --- write the site plan ---
const PDIR = join(ROOT, 'public', 'data', 'siteplans');
await mkdir(PDIR, { recursive: true });
await writeFile(join(PDIR, `${site}.json`), JSON.stringify({
  key: recipe.planKey,
  title: recipe.title,
  credit: osm.licence,
  plan: { origin: { lat: LAT0, lon: LON0 }, parts },
}));
let man = { sites: [] };
try { man = JSON.parse(await readFile(join(PDIR, 'manifest.json'), 'utf8')); } catch { /* first */ }
man.sites = [...new Set([...man.sites, site])].sort();
await writeFile(join(PDIR, 'manifest.json'), JSON.stringify(man, null, 1) + '\n');

const missing = Object.keys(recipe.temples).filter((n) => !temples.some((t) => t.title === recipe.temples[n].title));
console.log(`${site}: ${temples.length} temples, ${parts.length} plan parts`);
for (const t of temples) console.log(`  ${t.title.padEnd(32)} ${t.widthM}×${t.depthM} m, ${t.heightM} m, stair ${t.stairBearing}°, ${t.builtYear}`);
if (missing.length) console.log('  NOT FOUND in OSM:', missing.join(', '));
