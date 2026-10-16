/**
 * Hand-checked panel text for famous battles (15 Oct 2026): a summary, the
 * two sides, the result and its source, kept in scripts/data/battle-panels.json
 * and applied by scripts/dedupe-places.mjs after every harvest.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eventToPanel, sourceLabel } from './panel';
import type { TimelineEvent } from './types';

const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const panels = read('scripts/data/battle-panels.json').battles as Record<
  string,
  { name: string; summary: string; sides: string[]; result: string; sourceUrl: string }
>;
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));

describe('battle panels', () => {
  it('covers the 30 battles, each with all four fields', () => {
    expect(Object.keys(panels)).toHaveLength(30);
    for (const [id, p] of Object.entries(panels)) {
      expect(p.summary.length, id).toBeGreaterThan(40);
      expect(p.sides, id).toHaveLength(2);
      expect(p.result, id).toBeTruthy();
      expect(p.sourceUrl, id).toMatch(/^https:\/\//);
    }
  });

  it('is applied to the shipped events', () => {
    for (const [id, p] of Object.entries(panels)) {
      const e = byId.get(id);
      expect(e, id).toBeTruthy();
      expect(e!.name).toBe(p.name);
      expect(e!.summary).toBe(p.summary);
      expect(e!.sides).toEqual(p.sides);
      expect(e!.result).toBe(p.result);
      expect(e!.sourceUrl).toBe(p.sourceUrl);
    }
  });

  it('shows in the info panel: checked summary, sides, result, source', () => {
    const panel = eventToPanel(byId.get('q38789')!);
    expect(panel.summary).toContain('Stalingrad');
    expect(panel.summaryChecked).toBe(true);
    expect(panel.sourceUrl).toBe('https://en.wikipedia.org/wiki/Battle_of_Stalingrad');
    const sec = (h: string) => panel.sections?.find((s) => s.heading === h)?.body;
    expect(sec('Who fought')).toBe('Nazi Germany and Axis allies  vs  Soviet Union');
    expect(sec('Result')).toBe('Soviet victory');
    // Still fetches the Wikipedia photo.
    expect(panel.wikiTitle).toBe('Battle of Stalingrad');
  });

  it('an ordinary battle keeps the live Wikipedia summary', () => {
    const plain: TimelineEvent = { id: 'qx', name: 'Battle of X', startYear: 1500, lat: 0, lon: 0, category: 'battle', wikiTitle: 'Battle of X' };
    const panel = eventToPanel(plain);
    expect(panel.summaryChecked).toBeUndefined();
    expect(panel.sourceUrl).toBeUndefined();
  });

  it('labels sources readably', () => {
    expect(sourceLabel('https://en.wikipedia.org/wiki/Battle_of_Mohács')).toBe('Wikipedia: Battle of Mohács');
    expect(sourceLabel('https://en.wikipedia.org/wiki/Battle_of_Moh%C3%A1cs')).toBe('Wikipedia: Battle of Mohács');
    expect(sourceLabel('https://shandong-chorography.org/x')).toBe('shandong-chorography.org');
  });
});
