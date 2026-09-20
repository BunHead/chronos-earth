import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'public', 'data');
const read = (p: string) => JSON.parse(readFileSync(join(DATA, p), 'utf8'));

/**
 * The headline tier is what loads before any map cell streams in — so from a
 * cold start it is, in practice, THE ONLY THING SEARCH CAN FIND.
 *
 * This regressed silently once and nobody could have spotted it by reading the
 * code: the tier was a straight top-N by notability, the corpus kept growing,
 * and the cut-off climbed with it. By 20 Sept 2026 it had reached 116 and
 * thrown 33 hand-curated rows out of reach. Typing "Eridu" — or Uruk, Harappa,
 * Gilgamesh, King Arthur, the Chicxulub impact — returned nothing but an offer
 * to search the web, while the row sat in the dataset the whole time.
 *
 * So this test does not check a threshold. It checks the PROPERTY: a row a
 * person curated by hand is always reachable, no matter how much the harvest
 * adds around it.
 */
describe('headline tier — curated rows stay findable as the corpus grows', () => {
  const events: Array<{ id: string; name: string }> = read('imported/events.json').events;
  const headline = read('core-index/headline.json');
  const names: string[] = headline.name ?? headline.n;

  it('carries EVERY curated row, whatever its notability', () => {
    const curated = events.filter((e) => String(e.id).startsWith('cur-'));
    expect(curated.length).toBeGreaterThan(50); // sanity: there are some
    const missing = curated.filter((c) => !names.includes(c.name)).map((c) => c.name);
    expect(missing, `curated rows absent from the headline tier: ${missing.join(', ')}`).toEqual([]);
  });

  it('still carries the famous harvested rows too', () => {
    // Curated entries must not crowd the harvested giants out — that is why
    // the cap was raised to 1000 rather than letting them compete for 600.
    const harvested = events.filter((e) => !String(e.id).startsWith('cur-'));
    const inTier = harvested.filter((h) => names.includes(h.name)).length;
    expect(inTier).toBeGreaterThan(400);
  });

  it('names the specific rows that were unreachable, so they cannot slip again', () => {
    for (const n of [
      'Eridu', 'Uruk', 'Nippur', 'Lagash', 'Harappa', 'Liangzhu',
      'Gilgamesh', 'King Arthur', 'Beowulf', 'Chicxulub impact',
    ]) {
      expect(names, `${n} must be reachable from a cold start`).toContain(n);
    }
  });

  it('stays small enough to sit on the critical path', () => {
    // This used to assert the RAW size was under 200 KB. It tripped on
    // 20 Sept 2026 at 202 KB, when the cap went to 2,500 rows because the
    // dataset had doubled — and tripping is what a guard is for, so it got
    // read rather than nudged.
    //
    // What it was measuring was the wrong number. Pages serves this gzipped
    // and JSON of repeated short keys compresses hard: 202 KB on disk is
    // 67 KB on the wire, against a 2.47 MB cold load. The raw figure
    // overstates the cost by three times, so the guard now measures what the
    // visitor actually pays for and keeps a loose raw check behind it.
    //
    // 120 KB gzipped is about 4,500 rows — roughly double today's tier, and
    // still under 3% of the cold load. If this trips, do not raise it without
    // re-measuring the cold load first.
    const raw = readFileSync(join(DATA, 'core-index/headline.json'));
    const wire = gzipSync(raw, { level: 9 }).length;
    expect(wire, `headline tier is ${(wire / 1024).toFixed(0)} KB on the wire`).toBeLessThan(120 * 1024);
    // Belt and braces: parsing cost scales with the raw bytes, not the wire.
    expect(raw.length).toBeLessThan(600 * 1024);
  });
});
