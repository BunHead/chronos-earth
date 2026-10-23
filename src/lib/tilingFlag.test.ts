import { describe, it, expect, vi, afterEach } from 'vitest';
import { tilingEnabled } from './tilingFlag';

function setup(search: string, stored: string | null = null) {
  const store = new Map<string, string>();
  if (stored) store.set('chronos.tiling', stored);
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal('window', { location: { search }, localStorage });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('tilingEnabled', () => {
  it('is on by default', () => {
    setup('');
    expect(tilingEnabled()).toBe(true);
  });

  it('?tiles=0 turns it off and remembers the opt-out', () => {
    const store = setup('?tiles=0');
    expect(tilingEnabled()).toBe(false);
    expect(store.get('chronos.tiling')).toBe('off');
  });

  it('a remembered opt-out sticks on the next load', () => {
    setup('', 'off');
    expect(tilingEnabled()).toBe(false);
  });

  it('?tiles=on clears the opt-out', () => {
    const store = setup('?tiles=on', 'off');
    expect(tilingEnabled()).toBe(true);
    expect(store.has('chronos.tiling')).toBe(false);
  });

  it('takes the default when storage is blocked', () => {
    vi.stubGlobal('window', {
      location: { search: '' },
      get localStorage() { throw new Error('blocked'); },
    });
    expect(tilingEnabled()).toBe(true);
  });
});
