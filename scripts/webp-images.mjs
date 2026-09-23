/**
 * webp-images.mjs — re-encode the portrait and battle-map images as WebP.
 *
 * These are the heaviest things the site ships that are not Cesium: 156
 * portraits (8.7 MB) and 26 battle maps (15 MB), every one of them a JPEG or a
 * PNG, and not one of them on the cold path — they load when a panel opens. So
 * this does not touch first paint; it makes the panel arrive on a slow
 * connection, which is where the Captain's "extremely slow on my parents'
 * laptops" bites once the globe is up.
 *
 * ZERO NEW DEPENDENCIES, and that is the whole trick. The obvious tool is
 * `sharp`, which would be a new native dependency to install and keep. But
 * puppeteer is ALREADY a devDependency — render-model.mjs and verify-app.mjs
 * both drive it — and a Chromium is a perfectly good image encoder:
 * `canvas.toDataURL('image/webp', q)` is the same encoder the browser uses.
 * So the converter is the browser we already had.
 *
 *   node scripts/webp-images.mjs --check    # report the savings, write nothing
 *   node scripts/webp-images.mjs            # convert, rewrite the manifests
 *
 * IT REWRITES THE MANIFESTS TOO. A converted file nobody points at is dead
 * weight, and a manifest pointing at a deleted file is a broken panel — so the
 * two move together or not at all. `src/lib/data.test.ts` already asserts that
 * every manifest entry has a file on disk, which is the safety net for exactly
 * this.
 *
 * The originals are DELETED once their WebP exists and the manifest points at
 * it. Keeping both would defeat the purpose, and git remembers them.
 *
 * A file that comes out BIGGER as WebP is left alone. That happens with small
 * flat PNGs, and shipping a worse file to satisfy a script would be silly.
 */
import { readFile, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const CHECK_ONLY = process.argv.includes('--check');

/** Quality 0.82 is the usual sweet spot for photographs: no visible loss at the
 * sizes a panel shows, and roughly a third the bytes of the JPEG. */
const QUALITY = 0.82;

const SETS = [
  { dir: 'portraits', manifest: 'portraits/manifest.json', key: 'portraits' },
  { dir: 'battlemaps', manifest: 'battlemaps/manifest.json', key: 'maps' },
];

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let totalBefore = 0;
  let totalAfter = 0;
  let converted = 0;
  let skipped = 0;

  try {
    const page = await browser.newPage();

    for (const set of SETS) {
      const dirPath = join(DATA, set.dir);
      const manifestPath = join(DATA, set.manifest);
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const entries = manifest[set.key] ?? {};

      // Which files are actually pointed at? A stray image in the folder is not
      // ours to delete, and converting it would only add a file nobody loads.
      const referenced = new Map();
      for (const [id, entry] of Object.entries(entries)) {
        if (entry?.file) referenced.set(entry.file, id);
      }

      const files = (await readdir(dirPath)).filter((f) => /\.(jpe?g|png)$/i.test(f));
      console.log(`\n=== ${set.dir}: ${files.length} image(s), ${referenced.size} referenced ===`);

      for (const file of files) {
        if (!referenced.has(file)) {
          console.log(`  · ${file} — not in the manifest, left alone`);
          continue;
        }
        const src = join(dirPath, file);
        const before = (await stat(src)).size;
        const bytes = await readFile(src);
        const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;

        const out = await page.evaluate(
          (url, quality) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                c.getContext('2d').drawImage(img, 0, 0);
                const webp = c.toDataURL('image/webp', quality);
                // A browser that cannot encode WebP silently hands back a PNG.
                resolve(webp.startsWith('data:image/webp') ? webp : null);
              };
              img.onerror = () => resolve(null);
              img.src = url;
            }),
          dataUrl,
          QUALITY,
        );

        if (!out) {
          console.error(`  ✗ ${file} — could not be decoded or encoded, left alone`);
          skipped++;
          continue;
        }
        const buf = Buffer.from(out.split(',')[1], 'base64');
        totalBefore += before;

        if (buf.length >= before) {
          console.log(`  = ${file} — WebP is bigger (${kb(buf.length)} vs ${kb(before)}), kept as is`);
          totalAfter += before;
          skipped++;
          continue;
        }

        const webpName = `${basename(file, extname(file))}.webp`;
        totalAfter += buf.length;
        converted++;
        const pct = (100 * (1 - buf.length / before)).toFixed(0);
        console.log(`  ✓ ${file.padEnd(46)} ${kb(before).padStart(8)} -> ${kb(buf.length).padStart(8)}  -${pct}%`);

        if (!CHECK_ONLY) {
          await writeFile(join(dirPath, webpName), buf);
          entries[referenced.get(file)].file = webpName;
          await unlink(src);
        }
      }

      if (!CHECK_ONLY) {
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      }
    }
  } finally {
    await browser.close();
  }

  const saved = totalBefore - totalAfter;
  console.log(
    `\n${converted} converted, ${skipped} left alone.\n` +
      `${kb(totalBefore)} -> ${kb(totalAfter)}  (saved ${kb(saved)}, ${(100 * saved / (totalBefore || 1)).toFixed(0)}%)`,
  );
  if (CHECK_ONLY) console.log('(--check: nothing written)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
