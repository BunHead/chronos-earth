import { describe, it, expect } from 'vitest';
import { activePhaseIndex } from './rivers';

// A minimal stand-in matching the River shape activePhaseIndex reads.
const yellow = { name: 'Huang He', phases: [{ fromYear: -2000 }, { fromYear: 1128 }, { fromYear: 1855 }] };
const sarasvati = { name: 'Sarasvati', phases: [{ fromYear: -6000, path: [[0, 0]] }, { fromYear: -1900 }] };

describe('shifting rivers — phase selection', () => {
  it("picks the Yellow River's course in force at a year", () => {
    expect(activePhaseIndex(yellow, 200)).toBe(0); // northern course, antiquity
    expect(activePhaseIndex(yellow, 1500)).toBe(1); // southern course after 1128
    expect(activePhaseIndex(yellow, 2000)).toBe(2); // back north after 1855
  });

  it('clamps to the first phase for years before the river is charted', () => {
    expect(activePhaseIndex(yellow, -9999)).toBe(0);
  });

  it('the Sarasvati has a dry phase (no channel) after ~1900 BCE', () => {
    expect(sarasvati.phases[activePhaseIndex(sarasvati, -3000)].path).toBeTruthy();
    expect(sarasvati.phases[activePhaseIndex(sarasvati, -1000)].path).toBeUndefined();
  });
});
