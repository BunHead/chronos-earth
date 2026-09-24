/**
 * Every existing country's capital is on the globe — checked the RIGHT way round.
 *
 * On 23 Sept 2026 I told the Captain nine capitals were missing. The real
 * number was 27: I had checked a list of cities I thought to check, and
 * Beijing, Moscow, Madrid and Lisbon had all been absent for weeks without a
 * single test failing. This asks the question from the other end — every
 * existing sovereign state, its capital (Wikidata P36) — against a list frozen
 * into __fixtures__/national-capitals.json so it needs no network.
 *
 * Regenerate the fixture with:
 *   SELECT DISTINCT ?country ?countryLabel ?cap ?capLabel ?enwiki WHERE {
 *     ?country wdt:P31 wd:Q3624078 ; wdt:P36 ?cap .
 *     FILTER NOT EXISTS { ?country wdt:P576 ?dissolved }
 *     ?cap wdt:P625 ?coord .
 *     OPTIONAL { ?a schema:about ?cap ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
 *     SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Capital { qid: string; name: string; wikiTitle: string | null; countries: string[] }
interface Row { id: string; name: string; category: string; wikidataId?: string; wikiTitle?: string }

const { capitals } = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'lib', '__fixtures__', 'national-capitals.json'), 'utf8'),
) as { capitals: Capital[] };
const events: Row[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;

/** Left off ON PURPOSE — see scripts/add-curated-capitals.mjs. */
const EXCLUDED: Record<string, string> = {
  Q93230: "Rawalpindi — Pakistan's INTERIM capital in the 1960s; Islamabad is on the globe",
  Q212938: "East Jerusalem — Palestine's claimed capital, 2 km from the Jerusalem pin",
};

describe('every existing country has its capital on the globe', () => {
  const places = events.filter((e) => e.category === 'city' || e.category === 'monument');
  const byQid = new Set(places.map((e) => e.wikidataId).filter(Boolean));
  const byTitle = new Set(places.map((e) => e.wikiTitle?.toLowerCase()).filter(Boolean));

  it('the fixture is the real list, not a sample', () => {
    // There are ~195 sovereign states; some have two capitals (Bolivia, South
    // Africa, Sri Lanka, Malaysia…). Far fewer means the query changed.
    expect(capitals.length).toBeGreaterThan(190);
  });

  it('no capital is missing, except the two left off on purpose', () => {
    const missing = capitals
      .filter((c) => !EXCLUDED[c.qid])
      .filter((c) => !byQid.has(c.qid) && !(c.wikiTitle && byTitle.has(c.wikiTitle.toLowerCase())))
      .map((c) => `${c.name} (${c.countries.join('/')})`);
    expect(missing, `capitals missing from the globe: ${missing.join(', ')}`).toEqual([]);
  });

  it('the ones the Captain asked about by name', () => {
    for (const [name, qid] of [
      ['Beijing', 'Q956'], ['Moscow', 'Q649'], ['Madrid', 'Q2807'], ['Lisbon', 'Q597'],
      ['Washington, D.C.', 'Q61'], ['Brasília', 'Q2844'], ['Canberra', 'Q3114'], ['Wellington', 'Q23661'],
      ['New Delhi', 'Q987'], ['Islamabad', 'Q1362'], ['Kathmandu', 'Q3037'], ['Nairobi', 'Q3870'],
    ]) {
      expect(byQid.has(qid), `${name} is missing`).toBe(true);
    }
  });
});
