/** Stamp public/version.json at build time. The running app compiles this
 * SAME build id into its bundle (vite reads version.json at config time) and
 * compares the two: if the server's build differs from the one baked into the
 * code, the running tab is STALE and the refresh prompt fires — even if the
 * tab loaded old bytes to begin with. A short readable label rides along so
 * the version is legible in the UI, not a raw epoch. */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'version.json');

const now = new Date();
const p = (n) => String(n).padStart(2, '0');
const label = `${now.getUTCFullYear()}.${p(now.getUTCMonth() + 1)}.${p(now.getUTCDate())} · ${p(now.getUTCHours())}:${p(now.getUTCMinutes())} UTC`;

await writeFile(out, JSON.stringify({ build: now.getTime(), label }));
console.log('version stamped:', label);
