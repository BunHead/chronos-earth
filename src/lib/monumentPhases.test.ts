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
});
