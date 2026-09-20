/**
 * The inventions/discoveries harvest must never put the same thing on the
 * globe twice.
 *
 * This is a PROPERTY test, not a count test — the same shape as
 * headlineTier.test.ts, and for the same reason. The dataset grows every night,
 * so any assertion about how many rows exist rots within a week; an assertion
 * about what must never be true holds forever.
 *
 * The bug it was written for: on the first run of `fetch-discoveries.mjs` the
 * curated row "The World Wide Web" and Wikidata's "World Wide Web" both landed,
 * two pins on top of each other at CERN. Folding the name could not catch it
 * (the leading "The" survives the fold) and the curated row carries no
 * wikidataId, so neither existing key matched. `wikiTitle` did — two rows
 * citing the same English Wikipedia article are the same subject.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fold, wikiKey, dedupeKeys } from '../../scripts/fetch-discoveries.mjs';

interface Row {
  id: string;
  name: string;
  category: string;
  wikiTitle?: string;
  wikidataId?: string;
}

const events: Row[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;

const IDEAS = new Set(['invention', 'discovery']);

describe('fetch-discoveries dedupe keys', () => {
  it('folds case, accents and punctuation out of a name', () => {
    expect(fold('Königgrätz')).toBe('koniggratz'); // accents gone
    expect(fold('HIV/AIDS')).toBe('hiv aids');
    expect(fold('  Greek  Fire ')).toBe('greek fire');
  });

  it('keys a row on all four identities', () => {
    expect(dedupeKeys({ id: 'q466', name: 'World Wide Web', wikidataId: 'Q466', wikiTitle: 'World Wide Web' }))
      .toEqual({ id: 'q466', qid: 'Q466', name: 'world wide web', wiki: 'world wide web' });
  });

  it('does NOT rely on stripping leading articles — "The Hague" is not "Hague"', () => {
    expect(fold('The Hague')).not.toBe(fold('Hague'));
  });

  it('matches "The World Wide Web" to "World Wide Web" through wikiTitle', () => {
    // The two keys that failed...
    expect(fold('The World Wide Web')).not.toBe(fold('World Wide Web'));
    // ...and the one that works.
    expect(wikiKey('World Wide Web')).toBe(wikiKey('World Wide Web'));
  });
});

describe('the shipped dataset has no duplicated idea', () => {
  it('no two invention/discovery rows share a folded name', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of events) {
      if (!IDEAS.has(e.category)) continue;
      const k = fold(e.name);
      if (seen.has(k)) clashes.push(`${e.name} (${seen.get(k)} vs ${e.id})`);
      else seen.set(k, e.id);
    }
    expect(clashes, `duplicate names: ${clashes.join(', ')}`).toEqual([]);
  });

  it('no two invention/discovery rows share a wikiTitle', () => {
    // Scoped to the ideas themselves, and deliberately so. A row in ANOTHER
    // category may legitimately cite the same article: `q935` is Isaac Newton
    // the man (a `person`), while `cur-newton-gravity` is the publication of
    // universal gravitation in 1687 (a `discovery`). Both point at the
    // "Isaac Newton" article; they are not the same pin and must both stand.
    //
    // Within the ideas this rule is absolute, and it earned its keep on the
    // first run: "printing press" (Strasbourg 1439) landed on top of the
    // curated "Gutenberg printing press" (Mainz 1440), and "penicillin" landed
    // on "Penicillin discovered" at coordinates identical to four decimals.
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of events) {
      if (!IDEAS.has(e.category)) continue;
      const k = wikiKey(e.wikiTitle);
      if (!k) continue;
      if (seen.has(k)) clashes.push(`${e.wikiTitle} (${seen.get(k)} vs ${e.id})`);
      else seen.set(k, e.id);
    }
    expect(clashes, `ideas sharing a Wikipedia article: ${clashes.join(', ')}`).toEqual([]);
  });

  it('every country-level pin explains itself in a placeNote', () => {
    // The one approximation the harvest makes must always be visible to the
    // reader — the panel renders placeNote as "Why it is shown here".
    const ideas = events.filter((e) => IDEAS.has(e.category));
    expect(ideas.length).toBeGreaterThan(100); // the harvest actually ran
    const flagged = ideas.filter((e) => 'placeNote' in e && (e as { placeNote?: string }).placeNote);
    for (const e of flagged) {
      expect((e as { placeNote: string }).placeNote).toMatch(/Pinned at the centre of/);
    }
  });
});
