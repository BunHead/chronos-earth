import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadLiveCache, addToLiveCache } from './liveCache';
import type { TimelineEvent } from './types';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const ev = (id: string) => ({ id, name: id, startYear: 1, lat: 0, lon: 0, category: 'event' }) as TimelineEvent;

describe('liveCache', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty and remembers what is added', () => {
    expect(loadLiveCache()).toEqual([]);
    addToLiveCache(ev('a'));
    expect(loadLiveCache().map((e) => e.id)).toEqual(['a']);
  });

  it('does not store the same event twice', () => {
    addToLiveCache(ev('a'));
    addToLiveCache(ev('a'));
    expect(loadLiveCache()).toHaveLength(1);
  });

  it('keeps only the newest 500', () => {
    for (let i = 0; i < 505; i++) addToLiveCache(ev(`e${i}`));
    const list = loadLiveCache();
    expect(list).toHaveLength(500);
    expect(list[0].id).toBe('e5');
  });

  it('survives corrupt or non-list storage', () => {
    localStorage.setItem('chronos-live-events', '{not json');
    expect(loadLiveCache()).toEqual([]);
    localStorage.setItem('chronos-live-events', '{"a":1}');
    expect(loadLiveCache()).toEqual([]);
  });

  it('does not throw when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(loadLiveCache()).toEqual([]);
    expect(() => addToLiveCache(ev('a'))).not.toThrow();
  });
});
