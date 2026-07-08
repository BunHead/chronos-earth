import { describe, it, expect } from 'vitest';
import { phasesFor, phaseIndexAt } from './monumentPhases';

describe('monument phases', () => {
  it('finds Nottingham Castle by name (case-insensitive, substring)', () => {
    expect(phasesFor('Nottingham Castle')?.length).toBe(4);
    expect(phasesFor('nottingham castle museum')?.length).toBe(4);
    expect(phasesFor('Windsor Castle')).toBeNull();
  });

  it('picks the phase in force at a given year', () => {
    const p = phasesFor('Nottingham Castle')!;
    expect(p[phaseIndexAt(p, 1200)].label).toBe('Norman castle');
    expect(p[phaseIndexAt(p, 1700)].label).toBe('Ducal mansion');
    expect(p[phaseIndexAt(p, 1831)].label).toBe('The fire');
    expect(p[phaseIndexAt(p, 2020)].label).toBe('Castle Museum');
  });

  it('clamps to the first phase before it was built', () => {
    const p = phasesFor('Nottingham Castle')!;
    expect(phaseIndexAt(p, 900)).toBe(0);
  });

  it('the fire phase carries the burning state', () => {
    const p = phasesFor('Nottingham Castle')!;
    expect(p[2].state).toBe('burning');
  });

  it('Notre-Dame de Paris burns in 2019 and is restored by 2024', () => {
    const p = phasesFor('Notre-Dame de Paris')!;
    expect(p[phaseIndexAt(p, 1800)].label).toBe('The Gothic cathedral');
    expect(p[phaseIndexAt(p, 2020)].state).toBe('burning');
    expect(p[phaseIndexAt(p, 2025)].label).toBe('Restored');
    // The other Notre-Dames don't get Paris's phases.
    expect(phasesFor('Notre-Dame de Chartres')).toBeNull();
  });

  it('the Parthenon is a ruin after the 1687 explosion', () => {
    const p = phasesFor('Parthenon')!;
    expect(p[phaseIndexAt(p, -100)].label).toBe('Temple of Athena');
    expect(p[phaseIndexAt(p, 1800)].state).toBe('ruin');
  });

  it('the Colosseum: an arena from 80 CE, a ruin after 1349', () => {
    const p = phasesFor('Colosseum')!;
    expect(p[phaseIndexAt(p, 200)].model).toBe('amphitheatre');
    expect(p[phaseIndexAt(p, 200)].state).toBeUndefined();
    expect(p[phaseIndexAt(p, 2020)].state).toBe('ruin');
  });

  it('the ancient Wonders meet their ends through the phase bar', () => {
    const colossus = phasesFor('Colossus of Rhodes')!;
    expect(colossus[phaseIndexAt(colossus, -250)].label).toBe('The Colossus raised');
    expect(colossus[phaseIndexAt(colossus, -100)].state).toBe('ruin'); // the 226 BCE earthquake
    const pharos = phasesFor('Lighthouse of Alexandria (Pharos)')!;
    expect(pharos[phaseIndexAt(pharos, 1000)].state).toBeUndefined();
    expect(pharos[phaseIndexAt(pharos, 1500)].state).toBe('ruin');
    // The Temple of Artemis burns, is rebuilt, then is destroyed.
    const artemis = phasesFor('Temple of Artemis at Ephesus')!;
    expect(artemis[phaseIndexAt(artemis, -356)].state).toBe('burning');
    expect(artemis[phaseIndexAt(artemis, -300)].state).toBeUndefined(); // rebuilt
    expect(artemis[phaseIndexAt(artemis, 500)].state).toBe('ruin');
  });

  it('the Giza plateau is built up through time (buildFrac rises)', () => {
    const p = phasesFor('Giza Pyramids')!;
    expect(p[0].build!).toBeLessThan(p[p.length - 1].build!);
    expect(p[p.length - 1].build).toBe(1);
    expect(p[phaseIndexAt(p, -2530)].label).toBe('The Sphinx is carved');
  });

  it('Atlantis drowns in three phases with a steadily rising sea', () => {
    const p = phasesFor('Richat Structure (Eye of the Sahara)')!;
    expect(p.length).toBe(3);
    expect(p[0].sea!).toBeLessThan(p[1].sea!);
    expect(p[1].sea!).toBeLessThan(p[2].sea!);
    expect(p[2].label).toBe('Beneath the waves');
    // Ordinary monuments don't carry a sea level.
    expect(phasesFor('Nottingham Castle')![0].sea).toBeUndefined();
  });
});
