import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 6 (Oct 2026): a spot-check of the 500 most notable
// people the first fact-check did NOT flag as doubtful, checked against
// Wikidata (P569, P570, P19 + P625) and Wikipedia. Fixes and "uncertain" notes
// live in accuracy-fixes.json, so the nightly harvest cannot undo them.
// Checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 6'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q36322', 'Jane Austen', 51.2303, -1.2189], // Steventon, Hampshire — not Oxfordshire
  ['q6538', 'Günter Grass', 54.3833, 18.6167], // Langfuhr (Wrzeszcz), Gdańsk
  ['q16977', 'Deng Xiaoping', 30.5373, 106.6369], // Xiexing
  ['q41370', 'David', 31.7044, 35.2061], // Bethlehem
  ['q11869', 'William Henry Harrison', 37.3217, -77.1817], // Berkeley Plantation
  ['q2001', 'Stanley Kubrick', 40.7345, -73.9826], // Lying-In Hospital, Manhattan
  ['q1316', 'Saddam Hussein', 34.5276, 43.7092], // al-Awja
];

describe('people fact-check, batch 6 (Oct 2026)', () => {
  it('covers the batch: 7 fixes and 15 uncertain notes', () => {
    expect(batch.length).toBe(22);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(7);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('the "Born" line agrees with the moved pin', () => {
    expect(byId.get('q36322')!.born).toContain('Hampshire');
    expect(byId.get('q2001')!.born).toContain('Manhattan');
    expect(byId.get('q1316')!.born).toContain('al-Awja');
  });

  it('says "not certain" in the panel where sources still differ, instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q9441')).toContain('placeholder'); // the Buddha, "born and died 500 BC"
    expect(panel('q17892')).toContain('Eresos'); // Sappho, island-centre pin
    expect(panel('q1496')).toContain('Sabrosa'); // Magellan
    expect(panel('q2161')).toContain('Gallia Narbonensis'); // Tacitus, whole-degree pin
    expect(panel('q10665')).toContain('Paektu'); // Kim Jong-il
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['name', 'lat', 'lon', 'startYear', 'endYear', 'born', 'placeNote', 'dateNote']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});
