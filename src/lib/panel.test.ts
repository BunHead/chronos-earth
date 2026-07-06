import { describe, expect, it } from 'vitest';
import { monumentModelForName } from './panel';

describe('monumentModelForName — honest 3D or nothing', () => {
  it('churches get the cathedral model', () => {
    expect(monumentModelForName('Sagrada Família')).toBe('cathedral');
    expect(monumentModelForName('Notre-Dame de Paris')).toBe('cathedral');
    expect(monumentModelForName('Canterbury Cathedral')).toBe('cathedral');
    expect(monumentModelForName('Westminster Abbey')).toBe('cathedral');
    expect(monumentModelForName('Southwell Minster')).toBe('cathedral');
  });

  it('things we cannot honestly represent get NO model (no 3D button)', () => {
    expect(monumentModelForName('Dr. Hari Singh Gour University')).toBeNull();
    expect(monumentModelForName('Bhimbetka rock art')).toBeNull();
    expect(monumentModelForName('Eiffel Tower restaurant')).toBeNull();
    expect(monumentModelForName('Royal Opera House')).toBeNull();
  });

  it('classic mappings still hold', () => {
    expect(monumentModelForName('Great Pyramid of Giza')).toBe('pyramid');
    expect(monumentModelForName('Chichén Itzá')).toBe('stepped-pyramid');
    expect(monumentModelForName('Borobudur')).toBe('stepped-pyramid');
    expect(monumentModelForName('Edinburgh Castle')).toBe('settlement');
    expect(monumentModelForName('Avebury henge')).toBe('circle');
    expect(monumentModelForName('Great Sphinx of Giza')).toBe('sphinx');
  });

  it('the Greeks get a real temple (apology accepted, Athens)', () => {
    expect(monumentModelForName('Parthenon')).toBe('greek-temple');
    expect(monumentModelForName('Acropolis of Athens')).toBe('greek-temple');
    expect(monumentModelForName('Temple of Artemis')).toBe('greek-temple');
    expect(monumentModelForName('Temple of Heaven')).toBe('megalith'); // broad bucket unchanged
    expect(monumentModelForName('Angkor Wat')).toBe('stepped-pyramid'); // temple-mountain, by design
  });

  it('the new archetypes: aqueduct, pagoda, lighthouse', () => {
    expect(monumentModelForName('Pont du Gard')).toBe('aqueduct');
    expect(monumentModelForName('Aqueduct of Segovia')).toBe('aqueduct');
    expect(monumentModelForName('Yellow Crane Pagoda')).toBe('pagoda');
    expect(monumentModelForName('Pharos of Alexandria')).toBe('lighthouse');
    expect(monumentModelForName('Eddystone Lighthouse')).toBe('lighthouse');
  });

  it('matching is case-insensitive', () => {
    expect(monumentModelForName('SAGRADA FAMILIA BASILICA')).toBe('cathedral');
    expect(monumentModelForName('great pyramid')).toBe('pyramid');
  });
});
