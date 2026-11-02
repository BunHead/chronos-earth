import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';

// Japanese post towns date pass (2 Nov 2026): cities that were Edo-period
// post towns (shukuba) but were still dated from modern city status. The
// fixes live in scripts/data/accuracy-fixes.json so the nightly harvest
// cannot undo them; these tests check the shipped data as well as the fix file.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id.toLowerCase(), e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;

// [id, name, wrong year it had, right year]
const TOWNS: Array<[string, string, number, number]> = [
  ['q734541', 'Kōnosu', 1954, 1602],
  ['q163888', 'Ageo', 1958, 1602],
  ['q41106', 'Kumagaya', 2005, 1602],
  ['q734442', 'Sōka', 1958, 1630],
  ['q376023', 'Kasukabe', 2005, 1616],
  ['q386651', 'Iwata', 2005, 1601],
];

// Left at their modern year, but the panel now says the town is older.
const UNCERTAIN = ['q497952', 'q236197', 'q374511', 'q320943', 'q694154', 'q274384', 'q328613', 'q389711', 'q270912', 'q264206', 'q237683'];

describe('Japanese post towns date pass', () => {
  it.each(TOWNS)('%s (%s) is dated %i no longer, but %i', (id, name, wrong, right) => {
    const e = byId.get(id)!;
    expect(e).toBeDefined();
    expect(e.name).toBe(name);
    expect(e.startYear).toBe(right);
    expect(fixes[id].startYear).toBe(right);
    expect(e.dateNote).toContain(String(right));
    expect(e.dateNote).toContain(`${wrong} is when it became a modern city`);
    expect(e.dateNote).toMatch(/[Pp]ost town/);
  });

  it.each(UNCERTAIN)('%s says on the panel that its date is uncertain', (id) => {
    const e = byId.get(id)!;
    expect(e).toBeDefined();
    expect(e.startYear).toBeGreaterThanOrEqual(1868);
    expect(e.dateNote).toMatch(/^Uncertain:/);
    expect(fixes[id].startYear).toBeUndefined();
  });
});
