import { describe, expect, it } from 'vitest';
import { cellKey, cellKeysForRect, CELL_DEG } from './regionChunks';

describe('regionChunks — the world in 20-degree slices', () => {
  it('keys are stable and grid-aligned', () => {
    expect(CELL_DEG).toBe(20);
    expect(cellKey(0, 0)).toBe('r0x0'); // lon -180..-160, lat -90..-70
    // Britain (~-2 lon, ~53 lat): lon cell (−2+180)/20 = 8, lat cell (53+90)/20 = 7
    expect(cellKeysForRect({ w: -3, s: 52, e: -1, n: 54 })).toEqual(['r8x7']);
  });

  it('a view spanning cell borders touches every cell it sees', () => {
    const keys = cellKeysForRect({ w: -25, s: 35, e: 5, n: 55 });
    // lon -25..5 → cells 7,8,9 ; lat 35..55 → cells 6,7
    expect(keys.sort()).toEqual(['r7x6', 'r7x7', 'r8x6', 'r8x7', 'r9x6', 'r9x7']);
  });

  it('the dateline splits into two spans instead of flooding the world', () => {
    const keys = cellKeysForRect({ w: 170, s: -10, e: -170, n: 8 });
    expect(keys.sort()).toEqual(['r0x4', 'r17x4']); // both sides of the line
  });
});
