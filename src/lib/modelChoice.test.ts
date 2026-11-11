import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MODEL_ALTERNATIVES,
  _resetModelChoices,
  alternativeFor,
  effectiveModel,
  getModelChoice,
  onModelChoice,
  setModelChoice,
} from './modelChoice';
import { fitFor } from './monumentFit';

/** A tiny in-memory localStorage for the node test environment. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const MANIFEST = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { footprint: number; kb: number }>;

describe('modelChoice — no live site currently has two models', () => {
  beforeEach(() => {
    _resetModelChoices();
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has no registered alternatives after the Colosseum toggle was removed', () => {
    expect(Object.keys(MODEL_ALTERNATIVES)).toEqual([]);
    expect(alternativeFor('amphitheatre')).toBeNull();
    expect(alternativeFor('colosseum')).toBeNull();
    setModelChoice('amphitheatre', 'new');
    expect(getModelChoice('amphitheatre')).toBe('current');
    expect(effectiveModel('amphitheatre', 'new', MANIFEST)).toBe('amphitheatre');
  });

  it('blocked storage (private mode) never throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => setModelChoice('amphitheatre', 'new')).not.toThrow();
    expect(getModelChoice('amphitheatre')).toBe('current');
  });

  it('tells nobody when a pick is ignored', () => {
    const seen: string[] = [];
    onModelChoice((model, choice) => seen.push(`${model}:${choice}`));
    setModelChoice('amphitheatre', 'new');
    expect(seen).toEqual([]);
  });
});

describe('the true-metre Colosseum is the Colosseum pin', () => {
  it('is exported with the same stages and ruin as the amphitheatre (kept for other sites)', () => {
    for (const s of ['', '-b30', '-b60', '-b90', '-ruin']) {
      expect(MANIFEST[`amphitheatre${s}`]?.footprint, `amphitheatre${s}`).toBeGreaterThan(0);
      expect(MANIFEST[`colosseum${s}`]?.footprint, `colosseum${s}`).toBeGreaterThan(0);
    }
  });

  it('stays light for phones: each file under 210 KB', () => {
    for (const s of ['', '-b30', '-b60', '-b90', '-ruin']) expect(MANIFEST[`colosseum${s}`].kb).toBeLessThan(210);
  });

  it("keeps its own true size and the real 109.5° bearing on the Colosseum's pin", () => {
    const fit = fitFor('Colosseum', 'colosseum');
    expect(fit.widthM).toBeGreaterThan(185);
    expect(fit.widthM).toBeLessThan(195);
    expect(fit.facingDeg).toBe(-19.5);
  });

  it('the globe pin uses only the true-metre model, with no toggle', () => {
    const exporter = readFileSync('scripts/export-models.mjs', 'utf8');
    expect(exporter).toContain("['colosseum', 'Colosseum', [30, 60, 90]]");
    const globe = readFileSync('src/lib/globeModels.ts', 'utf8');
    expect(globe).toMatch(/model: 'colosseum', title: 'Colosseum',/);
    expect(globe).not.toMatch(/model: 'amphitheatre', title: 'Colosseum'/);
    expect(globe).not.toMatch(/hasAlternative/);
    expect(Object.keys(MODEL_ALTERNATIVES)).toEqual([]);
  });
});
