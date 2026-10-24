import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Places fact-check, batch 3 (23 Oct 2026): harvested cities 58-150 by
// notability and the 60 most notable harvested castles, temples and ancient
// sites, checked against Wikidata. The fixes live in
// scripts/data/accuracy-fixes.json so the nightly harvest can't undo them;
// these tests check the real shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

const YEARS: Array<[string, string, number]> = [
  ['q14773', 'Macau', 1557],
  ['q340', 'Montreal', 1642],
];

const UNCERTAIN = ['q1867', 'q3787', 'q4519'];

describe('places fact-check, batch 3', () => {
  for (const [id, name, year] of YEARS) {
    it(`${name} is dated ${year}, with a note saying why`, () => {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.name).toBe(name);
      expect(e.startYear).toBe(year);
      expect(e.dateNote).toContain(String(year));
    });
  }

  it('uncertain dates say so on the panel', () => {
    for (const id of UNCERTAIN) {
      const e = byId.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.dateNote, id).toMatch(/Wikidata/);
    }
  });

  it('every fix in this batch is in accuracy-fixes.json with a Wikidata source', () => {
    for (const id of [...YEARS.map(([id]) => id), ...UNCERTAIN]) {
      expect(fixes[id], id).toBeTruthy();
      expect(String(fixes[id].why), id).not.toBe('');
      expect(String(fixes[id].source), id).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+/);
    }
  });
});
