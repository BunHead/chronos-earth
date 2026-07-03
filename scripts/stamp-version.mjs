/** Stamp public/version.json at build time. The running app polls it: when
 * the stamp changes (a new deploy landed), a "refresh for the new version"
 * toast appears — no more stale tabs quietly showing last week's app. */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'version.json');
await writeFile(out, JSON.stringify({ build: Date.now() }));
console.log('version stamped');
