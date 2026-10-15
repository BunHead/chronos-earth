import { describe, it, expect } from 'vitest';
import type { TimelineEvent } from './types';
import { withFocusedEvent } from './focusMarker';
import { eventToPanel } from './panel';

const ev = (id: string, notability: number): TimelineEvent =>
  ({ id, name: id, startYear: 1161, lat: 35.9, lon: 120.2, category: 'battle', wikidataId: id.toUpperCase(), notability }) as TimelineEvent;

// The Battle of Tangdao (notability 6) never showed after "Fly here".
describe('the flown-to event always gets a pin', () => {
  const tangdao = ev('q985668', 6);
  const busy = Array.from({ length: 200 }, (_, i) => ev(`q${i}`, 500 - i));
  const inMemory = new Map(busy.map((e) => [e.id, e]));

  it('shows a quiet event that is NOT in memory (picked from the search index)', () => {
    const out = withFocusedEvent(busy.slice(0, 10), 'q985668', (id) => inMemory.get(id), tangdao, 180);
    expect(out[0].id).toBe('q985668');
  });

  it('is never sliced off a full list', () => {
    const out = withFocusedEvent(busy, 'q985668', (id) => inMemory.get(id), tangdao, 180);
    expect(out).toHaveLength(180);
    expect(out.some((e) => e.id === 'q985668')).toBe(true);
  });

  it('is not drawn twice when already on the list', () => {
    const out = withFocusedEvent([...busy.slice(0, 5), tangdao], 'q985668', () => undefined, tangdao, 180);
    expect(out.filter((e) => e.id === 'q985668')).toHaveLength(1);
  });

  it('the panel carries the event, so "Fly here" can focus it', () => {
    expect(eventToPanel(tangdao).event?.id).toBe('q985668');
  });
});
