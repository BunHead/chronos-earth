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

/** World-War belligerents who wore field grey — the other side gets olive. */
const CENTRAL_AXIS = /german|axis|japan|austria|central powers|ottoman/i;

/** Era-true side colours: khaki vs field grey for the World Wars (when the
 * names say who is who), the classic blue vs red everywhere else. */
export function sideColorsFor(
  year: number,
  side1: string,
  side2: string,
): { a: string; b: string } {
  if (year >= 1914 && year <= 1945) {
    const OLIVE = '#6b7a3f';
    const GREY = '#555b63';
    if (CENTRAL_AXIS.test(side2) && !CENTRAL_AXIS.test(side1)) return { a: OLIVE, b: GREY };
    if (CENTRAL_AXIS.test(side1) && !CENTRAL_AXIS.test(side2)) return { a: GREY, b: OLIVE };
  }
  return { a: '#3b6fb5', b: '#c0392b' };
}

/** How big the armies read on the field, from the battle's casualties text.
 * "≈1,200,000 dead" scales formations up; a skirmish scales them down. */
export function casualtyScale(casualties: string | undefined): number {
  if (!casualties) return 1;
  const nums = casualties.replace(/,/g, '').match(/\d+/g);
  if (!nums) return 1;
  const worst = Math.max(...nums.map(Number));
  if (worst >= 200_000) return 1.35;
  if (worst >= 50_000) return 1.18;
  if (worst >= 5_000) return 1;
  return 0.82;
}

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
  const scale = casualtyScale(b.casualties);

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
    units.push({ id: `${side}${i}`, side, label, shape, size: size * scale, pos: [[x0, y], [x1, y]] });
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

  const colors = sideColorsFor(b.year, side1, side2);
  const phases: BattleView['phases'] = [
    {
      name: 'Deployment',
      narration: `${side1} and ${side2} draw up their forces. ${b.significance ?? ''}`.trim(),
    },
    {
      name: 'The clash',
      narration: `${b.victor ? `${b.victor} — ` : ''}${b.outcome ?? 'The armies meet.'}`,
      arrows: [
        { from: [30, 25], to: [45, 28], side: 'a' },
        { from: [70, 40], to: [55, 37], side: 'b' },
      ],
    },
  ];

  // A third act when the outcome tells us how it ended: the beaten side
  // streams off its own edge of the field (or the siege ring closes).
  const endText = `${b.outcome ?? ''} ${b.significance ?? ''}`;
  const ending = /rout/i.test(endText)
    ? 'The rout'
    : /siege|besieg/i.test(endText)
      ? 'The siege closes'
      : /surrender|capitulat/i.test(endText)
        ? 'The surrender'
        : /retreat|withdr|flee|fled|fell back|evacuat/i.test(endText)
          ? 'The retreat'
          : null;
  if (ending) {
    // Who runs? The side the victor's name matches LEAST (generic words like
    // "Kingdom" appear on both sides, so count matches rather than any-hit).
    const hits = (s: string) =>
      s.split(/[ ,&]+/).filter((w) => w.length > 3 && b.victor?.includes(w)).length;
    const victorIsA = !!b.victor && hits(side1) > hits(side2);
    const loser: 'a' | 'b' = victorIsA ? 'b' : 'a';
    const arrows =
      loser === 'b'
        ? [
            { from: [58, 28] as [number, number], to: [82, 24] as [number, number], side: 'b' as const },
            { from: [58, 44] as [number, number], to: [84, 46] as [number, number], side: 'b' as const },
          ]
        : [
            { from: [42, 28] as [number, number], to: [18, 24] as [number, number], side: 'a' as const },
            { from: [42, 44] as [number, number], to: [16, 46] as [number, number], side: 'a' as const },
          ];
    phases.push({
      name: ending,
      narration: `${loser === 'a' ? side1 : side2} ${
        ending === 'The siege closes' ? 'is shut in as the lines tighten' : 'gives ground and quits the field'
      }.`,
      arrows,
    });
  }
  phases[phases.length - 1].narration +=
    ' (This battlefield is auto-generated — terrain and formations are illustrative, not exact.)';

  return {
    id: b.id,
    title: b.name,
    subtitle: `${b.dateLabel} — ${side1} vs ${side2}`,
    sides: {
      a: { name: side1, color: colors.a },
      b: { name: side2, color: colors.b },
    },
    terrain,
    phases,
    units,
    flagship: true, // every battlefield earns its 3D view
  };
}
