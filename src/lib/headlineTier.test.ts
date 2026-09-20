import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
    // ~85 bytes an event packed. If this ever balloons, it is loading before
    // anything the visitor can see.
    const bytes = readFileSync(join(DATA, 'core-index/headline.json')).length;
    expect(bytes).toBeLessThan(200 * 1024);
  });
});
