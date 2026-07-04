/**
 * synthBattle.ts — a battlefield for EVERY battle.
 *
 * Only a dozen battles have hand-crafted phased views; the other few hundred
 * deserve better than nothing. This synthesises a credible generic view from
 * the battle's own data: era decides the arms (cavalry before 1500, guns and
 * then armour after 1900, ships for naval battles), the belligerents name the
 * sides, the terrain is seeded from the battle id so each field is stable,
 * and the narration is stitched from the battle's real outcome.
 *
 * Hand-crafted views always win — this is the understudy, not the star.
 */
import type { Battle, BattleTerrain, BattleUnit, BattleView } from './types';

const NAVAL =
  /sea battle|naval|midway|jutland|trafalgar|lepanto|salamis|actium|armada|tsushima|coral sea|leyte|navarino|aboukir|of the nile|chesapeake|hampton roads/i;

/** Small deterministic PRNG so each battle keeps the same field forever. */
function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthesizeBattleView(b: Battle): BattleView {
  const rnd = mulberry([...b.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const naval = NAVAL.test(b.name);
  const modern = b.year >= 1900;
  const side1 = b.belligerents?.side1 ?? 'Side A';
  const side2 = b.belligerents?.side2 ?? 'Side B';

  // --- Terrain: stable per battle. ---
  const terrain: BattleTerrain[] = [];
  if (naval) {
    terrain.push({ type: 'sea', x: 50, y: 35, w: 100, h: 70 });
  } else {
    const hills = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < hills; i++) {
      terrain.push({ type: 'hill', x: 15 + rnd() * 70, y: 12 + rnd() * 40, r: 5 + rnd() * 6 });
    }
    if (rnd() < 0.5) terrain.push({ type: 'forest', x: 12 + rnd() * 20, y: 45 + rnd() * 15, w: 10, h: 7 });
    if (rnd() < 0.35) terrain.push({ type: 'town', x: 40 + rnd() * 20, y: 15 + rnd() * 10, r: 3 });
  }

  // --- Units: era decides the arms. ---
  const units: BattleUnit[] = [];
  const lane = (i: number, n: number) => 16 + ((i + 0.5) / n) * 38; // y lanes
  const mk = (
    side: 'a' | 'b',
    i: number,
    n: number,
    label: string,
    shape: BattleUnit['shape'],
    size: number,
  ) => {
    const y = lane(i, n) + (rnd() - 0.5) * 4;
    const [x0, x1] = side === 'a' ? [22, 42] : [78, 58];
    units.push({ id: `${side}${i}`, side, label, shape, size, pos: [[x0, y], [x1, y]] });
  };
  for (const side of ['a', 'b'] as const) {
    const who = side === 'a' ? side1 : side2;
    if (naval) {
      mk(side, 0, 3, `${who} van`, 'ship', 0.8);
      mk(side, 1, 3, `${who} main fleet`, 'ship', 1.1);
      mk(side, 2, 3, `${who} rear`, 'ship', 0.7);
    } else if (modern) {
      mk(side, 0, 3, `${who} infantry`, 'block', 1.2);
      mk(side, 1, 3, `${who} armour`, 'vehicle', 0.8);
      mk(side, 2, 3, `${who} reserves`, 'block', 0.9);
    } else {
      mk(side, 0, 3, `${who} infantry`, 'block', 1.2);
      mk(side, 1, 3, `${who} cavalry`, 'cavalry', 0.8);
      mk(side, 2, 3, `${who} reserves`, 'block', 0.9);
    }
  }

  return {
    id: b.id,
    title: b.name,
    subtitle: `${b.dateLabel} — ${side1} vs ${side2}`,
    sides: {
      a: { name: side1, color: '#3b6fb5' },
      b: { name: side2, color: '#c0392b' },
    },
    terrain,
    phases: [
      {
        name: 'Deployment',
        narration: `${side1} and ${side2} draw up their forces. ${b.significance ?? ''}`.trim(),
      },
      {
        name: 'The clash',
        narration: `${b.victor ? `${b.victor} — ` : ''}${b.outcome ?? 'The armies meet.'} (This battlefield is auto-generated — terrain and formations are illustrative, not exact.)`,
        arrows: [
          { from: [30, 25], to: [45, 28], side: 'a' },
          { from: [70, 40], to: [55, 37], side: 'b' },
        ],
      },
    ],
    units,
    flagship: true, // every battlefield earns its 3D view
  };
}
