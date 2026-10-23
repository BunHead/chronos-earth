import { describe, it, expect, vi, afterEach } from 'vitest';
import type { TimelineEvent } from './types';

async function fresh() {
  vi.resetModules();
  return import('./detail');
}

const ev = (over: Partial<TimelineEvent> = {}): TimelineEvent =>
  ({ id: 'e1', name: 'Hastings', startYear: 1066, lat: 50.9, lon: 0.5, category: 'battle', cell: '5|0', ...over }) as TimelineEvent;

afterEach(() => vi.unstubAllGlobals());

describe('detail loading', () => {
  it('fetches a cell file once and uses _ in the file name', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ e1: { deaths: 10 }, e2: { result: 'win' } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { getDetail } = await fresh();
    expect(await getDetail('e1', '5|0')).toEqual({ deaths: 10 });
    expect(await getDetail('e2', '5|0')).toEqual({ result: 'win' });
    expect(await getDetail('missing', '5|0')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/data\/detail\/5_0\.json$/);
  });

  it('treats a missing cell file as no detail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const { getDetail } = await fresh();
    expect(await getDetail('e1', '9|9')).toBeNull();
  });

  it('hydrateEvent merges detail in place, once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ e1: { summary: 'Norman win' } }) })));
    const { hydrateEvent } = await fresh();
    const e = ev();
    expect(await hydrateEvent(e)).toBe(true);
    expect(e.summary).toBe('Norman win');
    expect(await hydrateEvent(e)).toBe(false); // already done
  });

  it('hydrateEvent skips events that were loaded whole (no cell)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { hydrateEvent } = await fresh();
    expect(await hydrateEvent(ev({ cell: undefined }))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
