import { describe, expect, it } from 'vitest';
import { diffOwners, morphOpen } from './borderStatus';

/** Build an owner-index grid from rows of single characters ('.' = nobody). */
function grid(rows: string[], names: string[]): Int32Array {
  const out = new Int32Array(rows.length * rows[0].length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      out[y * row.length + x] = ch === '.' ? -1 : names.indexOf(ch);
    });
  });
  return out;
}

/** Build a 0/1 mask from rows of '.'/'#'. */
function mask(rows: string[]): Uint8Array {
  const out = new Uint8Array(rows.length * rows[0].length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      out[y * row.length + x] = ch === '#' ? 1 : 0;
    });
  });
  return out;
}

const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

describe('diffOwners', () => {
  it('marks nothing when both frames agree', () => {
    const a = grid(['FFSS', 'FFSS'], ['F', 'S']);
    expect(count(diffOwners(a, ['F', 'S'], a, ['F', 'S']))).toBe(0);
  });

  it('matches owners by name even when feature order differs', () => {
    const a = grid(['FS'], ['F', 'S']);
    // Same map, but frame B lists Spain first — indices flip, names must not.
    const b = new Int32Array([1, 0]); // F is index 1, S is index 0 in frame B
    expect(count(diffOwners(a, ['F', 'S'], b, ['S', 'F']))).toBe(0);
  });

  it('marks land changing hands, including from nobody', () => {
    const a = grid(['FF..'], ['F']);
    const b = grid(['FGG.'], ['F', 'G']);
    // pixel1: F→G changed; pixel2: nobody→G changed; pixel3: nobody both.
    expect([...diffOwners(a, ['F'], b, ['F', 'G'])]).toEqual([0, 1, 1, 0]);
  });

  it('treats out-of-range ids (antialiasing junk) as nobody', () => {
    const a = new Int32Array([99]); // blend artifact decoded past the name table
    const b = new Int32Array([-1]);
    expect(count(diffOwners(a, ['F'], b, ['F']))).toBe(0);
  });
});

describe('morphOpen', () => {
  it('erases isolated speckle and thin 1px seams', () => {
    const m = mask([
      '..........',
      '.#........',
      '...####...',
      '..........',
    ]);
    expect(count(morphOpen(m, 10, 4))).toBe(0);
  });

  it('keeps a solid block of genuine change and dilates it outward', () => {
    const rows = [
      '............',
      '..######....',
      '..######....',
      '..######....',
      '..######....',
      '............',
    ];
    const m = mask(rows);
    const opened = morphOpen(m, 12, 6, 5, 1);
    // The block's interior survives erosion, then dilation regrows past it.
    expect(count(opened)).toBeGreaterThan(count(m) / 2);
    // A pixel well inside the block is still set…
    expect(opened[3 * 12 + 4]).toBe(1);
    // …and a far-away corner stays clear.
    expect(opened[0]).toBe(0);
  });

  it('with dilateRadius 0 returns the bare erosion', () => {
    const m = mask(['###', '###', '###']);
    const opened = morphOpen(m, 3, 3, 5, 0);
    // Only the centre pixel has 8 set neighbours… corners/edges have fewer
    // than 5 in-bounds neighbours? (corner has 3, edge has 5) — centre + edges survive.
    expect(opened[4]).toBe(1); // centre
    expect(opened[0]).toBe(0); // corner (3 neighbours < 5)
  });
});
