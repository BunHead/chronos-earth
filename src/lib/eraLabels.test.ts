import { describe, expect, it } from 'vitest';
import { eraLabelBoxes, eraLabelUnits } from './eraLabels';
import { yearsBPToPos } from './timeScale';

describe('era labels on the overview rail', () => {
  const boxes = eraLabelBoxes();
  const units = eraLabelUnits();
  const labelAt = (bp: number) => {
    const p = yearsBPToPos(bp);
    return boxes.find((b) => p >= b.left && p <= b.left + b.width)?.name;
  };
  const unitOf = (bp: number) => {
    const p = yearsBPToPos(bp);
    return units.find((u) => p >= u.left && p <= u.right)?.name;
  };

  it('100 Mya sits under the Mesozoic, not the Paleogene (the Captain, 11 Oct 2026)', () => {
    expect(labelAt(100_000_000)).toBe('Mesozoic');
  });

  it('the middle of every labelled era sits under its own name', () => {
    // A box may reach a little past its band's edge (labels are centred, and
    // claim spare rail up to the midpoint with the next label) — but the
    // heart of an era must never sit under another era's name.
    for (const b of boxes) {
      const u = units.find((x) => x.name === b.name)!;
      const mid = (u.left + u.right) / 2;
      expect(boxes.find((x) => mid >= x.left && mid <= x.left + x.width)?.name).toBe(b.name);
    }
    for (const bp of [400e6, 200e6, 100e6, 40e6, 1e6]) {
      const l = labelAt(bp);
      if (l) expect(l, `${bp} BP`).toBe(unitOf(bp));
    }
  });

  it('boxes never overlap and stay on the rail', () => {
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].left).toBeGreaterThanOrEqual(0);
      expect(boxes[i].left + boxes[i].width).toBeLessThanOrEqual(1 + 1e-9);
      if (i) expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].left + boxes[i - 1].width - 1e-9);
    }
  });
});
