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

describe('modelChoice — the Colosseum current ↔ new switch', () => {
  beforeEach(() => {
    _resetModelChoices();
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the current model is the default', () => {
    expect(getModelChoice('amphitheatre')).toBe('current');
    expect(effectiveModel('amphitheatre', 'current', MANIFEST)).toBe('amphitheatre');
  });

  it('only the Colosseum archetype has an alternative', () => {
    expect(alternativeFor('amphitheatre')).toBe('colosseum');
    expect(alternativeFor('castle')).toBeNull();
    setModelChoice('castle', 'new');
    expect(getModelChoice('castle')).toBe('current');
  });

  it('picking the new model is remembered on this device', () => {
    setModelChoice('amphitheatre', 'new');
    expect(localStorage.getItem('chronos.modelChoice.amphitheatre')).toBe('new');
    _resetModelChoices(); // a fresh page load
    expect(getModelChoice('amphitheatre')).toBe('new');
    setModelChoice('amphitheatre', 'current');
    expect(localStorage.getItem('chronos.modelChoice.amphitheatre')).toBeNull();
  });

  it('a Compare run flips it for now without remembering it', () => {
    setModelChoice('amphitheatre', 'new', false);
    expect(getModelChoice('amphitheatre')).toBe('new');
    expect(localStorage.getItem('chronos.modelChoice.amphitheatre')).toBeNull();
    _resetModelChoices();
    expect(getModelChoice('amphitheatre')).toBe('current');
  });

  it('blocked storage (private mode) never throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => setModelChoice('amphitheatre', 'new')).not.toThrow();
    expect(getModelChoice('amphitheatre')).toBe('new');
  });

  it('tells the globe when the pick changes', () => {
    const seen: string[] = [];
    onModelChoice((model, choice) => seen.push(`${model}:${choice}`));
    setModelChoice('amphitheatre', 'new');
    expect(seen).toEqual(['amphitheatre:new']);
  });

  it('falls back to the current model if the new file was not exported', () => {
    expect(effectiveModel('amphitheatre', 'new', MANIFEST)).toBe('colosseum');
    expect(effectiveModel('amphitheatre', 'new', { amphitheatre: { footprint: 13 } })).toBe('amphitheatre');
  });
});

describe('the new Colosseum stands on the globe like the old one', () => {
  it('is exported with the same stages and ruin as the amphitheatre', () => {
    for (const s of ['', '-b30', '-b60', '-b90', '-ruin']) {
      expect(MANIFEST[`amphitheatre${s}`]?.footprint, `amphitheatre${s}`).toBeGreaterThan(0);
      expect(MANIFEST[`colosseum${s}`]?.footprint, `colosseum${s}`).toBeGreaterThan(0);
    }
  });

  it('stays light for phones: each file under 210 KB, only the picked one loads', () => {
    for (const s of ['', '-b30', '-b60', '-b90', '-ruin']) expect(MANIFEST[`colosseum${s}`].kb).toBeLessThan(210);
  });

  it("keeps its own true size and the real 109.5° bearing on the Colosseum's pin", () => {
    const fit = fitFor('Colosseum', 'colosseum');
    expect(fit.widthM).toBeGreaterThan(185);
    expect(fit.widthM).toBeLessThan(195);
    expect(fit.facingDeg).toBe(-19.5);
  });

  it('the export script and the globe both know the alternative', () => {
    const exporter = readFileSync('scripts/export-models.mjs', 'utf8');
    expect(exporter).toContain("['colosseum', 'Colosseum', [30, 60, 90]]");
    const globe = readFileSync('src/lib/globeModels.ts', 'utf8');
    // Only the Colosseum's curated placement switches, never a generic amphitheatre.
    expect(globe).toMatch(/model: 'amphitheatre', title: 'Colosseum',[^\n]*hasAlternative: true/);
    expect(globe.match(/hasAlternative: true/g)?.length).toBe(1);
    expect(MODEL_ALTERNATIVES.amphitheatre.alt).toBe('colosseum');
  });
});
