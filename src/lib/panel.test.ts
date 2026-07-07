import { describe, expect, it } from 'vitest';
import { monumentModelForName } from './panel';

describe('monumentModelForName — honest 3D or nothing', () => {
  it('churches get the cathedral model', () => {
    expect(monumentModelForName('Cologne Cathedral')).toBe('cathedral');
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
    expect(monumentModelForName('Avebury henge')).toBe('circle');
    expect(monumentModelForName('Great Sphinx of Giza')).toBe('sphinx');
  });

  it('castles, forts and palaces get their own castle model (not a settlement box)', () => {
    // Examples chosen to sit OUTSIDE the suppression list (NO_3D_NAMES), which
    // runs first — these exercise the keyword rule itself, one per sub-pattern.
    expect(monumentModelForName('Edinburgh Castle')).toBe('castle');
    expect(monumentModelForName('Nottingham Castle')).toBe('castle');
    expect(monumentModelForName('Malbork Castle')).toBe('castle');
    expect(monumentModelForName('Fort Ticonderoga')).toBe('castle');
    expect(monumentModelForName('Citadel of Aleppo')).toBe('castle');
    expect(monumentModelForName('Buckingham Palace')).toBe('castle');
    expect(monumentModelForName('Château de Chenonceau')).toBe('castle');
    expect(monumentModelForName('Moscow Kremlin')).toBe('castle');
    expect(monumentModelForName('Castel del Monte')).toBe('castle');
  });

  it('false friends: bridges and parks are NOT dragged into the castle model', () => {
    // "Forth" contains the letters of "fort"; "Fortress" starts with "fort".
    // Word boundaries keep both out of the castle bucket.
    expect(monumentModelForName('Forth Bridge')).toBeNull();
    expect(monumentModelForName('Brimstone Hill Fortress National Park')).toBeNull();
    expect(monumentModelForName('Golden Gate Bridge')).toBeNull();
  });

  it('South/SE-Asian temples get a spired temple, not a generic stone pile', () => {
    expect(monumentModelForName('Prambanan Temple')).toBe('temple-tower');
    expect(monumentModelForName('Preah Vihear Temple')).toBe('temple-tower');
    expect(monumentModelForName('Konark Sun Temple')).toBe('temple-tower');
    // The broad temple bucket and temple-mountains are unchanged.
    expect(monumentModelForName('Temple of Heaven')).toBe('megalith');
    expect(monumentModelForName('Templo Mayor')).toBe('stepped-pyramid');
  });

  it('the Greeks get a real temple (apology accepted, Athens)', () => {
    expect(monumentModelForName('Parthenon')).toBe('greek-temple');
    expect(monumentModelForName('Acropolis of Athens')).toBe('greek-temple');
    expect(monumentModelForName('Temple of Artemis')).toBe('greek-temple');
    expect(monumentModelForName('Temple of Heaven')).toBe('megalith'); // broad bucket unchanged
    expect(monumentModelForName('Monte Albán')).toBe('stepped-pyramid'); // temple-mountain, by design
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
