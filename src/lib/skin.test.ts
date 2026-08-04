import { describe, it, expect, beforeEach } from 'vitest';
import { SKINS, DEFAULT_SKIN, isSkinId, loadSkin, saveSkin, applySkin } from './skin';

/**
 * The suite runs in the `node` environment (vite.config.ts) and stays there
 * deliberately — pulling in jsdom to exercise four small functions would slow
 * every other test for no gain. So we stub the two browser bits this module
 * touches: `localStorage`, and the document `applySkin` already accepts as a
 * parameter for exactly this reason. What's under test is the LOGIC — the
 * fallback, the validation, and which attributes get set — none of which needs
 * a real DOM.
 */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

interface FakeDoc {
  documentElement: {
    attrs: Record<string, string>;
    style: { colorScheme: string };
    setAttribute(k: string, v: string): void;
  };
}
const fakeDoc = (): FakeDoc => ({
  documentElement: {
    attrs: {},
    style: { colorScheme: '' },
    setAttribute(k: string, v: string) { this.attrs[k] = v; },
  },
});

describe('skin — the ship can change her colours but not her facts', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = fakeStorage();
  });

  it('offers exactly the four identities the mockups promised', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['chart', 'atlas', 'observatory', 'stratum']);
    // Every skin must introduce itself — the picker shows both name and blurb.
    for (const s of SKINS) {
      expect(s.name.length, s.id).toBeGreaterThan(3);
      expect(s.blurb.length, s.id).toBeGreaterThan(15);
    }
  });

  it('falls back to the default rather than trusting stored junk', () => {
    expect(loadSkin()).toBe(DEFAULT_SKIN);
    localStorage.setItem('ce_skin', 'not-a-skin');
    expect(loadSkin()).toBe(DEFAULT_SKIN);
    localStorage.setItem('ce_skin', 'stratum');
    expect(loadSkin()).toBe('stratum');
  });

  it('round-trips a saved choice', () => {
    saveSkin('observatory');
    expect(loadSkin()).toBe('observatory');
  });

  it('survives storage being blocked (private mode) instead of throwing', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    };
    expect(() => saveSkin('atlas')).not.toThrow();
    expect(loadSkin()).toBe(DEFAULT_SKIN);
  });

  it('guards the id type', () => {
    expect(isSkinId('atlas')).toBe(true);
    expect(isSkinId('ATLAS')).toBe(false);
    expect(isSkinId(null)).toBe(false);
    expect(isSkinId(7)).toBe(false);
  });

  it('paints data-skin AND color-scheme onto the document', () => {
    const d = fakeDoc();
    applySkin('chart', d as unknown as Document);
    expect(d.documentElement.attrs['data-skin']).toBe('chart');
    // Dark skins keep dark browser furniture…
    expect(d.documentElement.style.colorScheme).toBe('dark');
    // …but the Atlas plate is paper. Without this line its scrollbars stay
    // black, which reads as broken rather than designed.
    applySkin('atlas', d as unknown as Document);
    expect(d.documentElement.attrs['data-skin']).toBe('atlas');
    expect(d.documentElement.style.colorScheme).toBe('light');
  });
});
