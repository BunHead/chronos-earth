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
});
