import { describe, it, expect } from 'vitest';
import { knownIds } from '../../scripts/dedupe-places.mjs';

// The nightly Pleiades import skips ids it already has. A row folded into
// another (kept in `merged`) must count as "already have", or the import puts
// it straight back — which is how the undated Cova Dones copy (pl652043992)
// returned in the 23 Oct 2026 harvest.
describe('knownIds', () => {
  it('counts rows and the rows merged into them', () => {
    const ids = knownIds([
      { id: 'cur-cova-dones', merged: [{ id: 'pl652043992' }] },
      { id: 'pl1' },
    ]);
    expect([...ids].sort()).toEqual(['cur-cova-dones', 'pl1', 'pl652043992']);
  });

  it('copes with no rows and rows with no merged list', () => {
    expect(knownIds([]).size).toBe(0);
    expect(knownIds([{ id: 'a' }]).has('a')).toBe(true);
  });
});
