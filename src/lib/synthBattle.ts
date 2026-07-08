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
  /sea battle|naval|midway|jutland|trafalgar|lepanto|salamis|actium|armada|tsushima|coral sea|leyte|navarino|aboukir|of the nile|chesapeake|hampton roads|pearl harbor|harbou?r|gulf of/i;

/** Air battles get squadrons, not tanks — matched on the name AND the
 * belligerents (Royal Air Force vs Luftwaffe says it all). */
const AIR = /battle of britain|air battle|air raid|bombing of|air force|luftwaffe|air corps/i;

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
  const air = modern && !naval && AIR.test(`${b.name} ${side1} ${side2}`);
  // Pearl Harbor and its kin: a raid FROM the sky ON the harbour — the
  // attacker flies, the defender sits at anchor.
  const airRaid = modern && naval && /attack on|raid/i.test(b.name);
  for (const side of ['a', 'b'] as const) {
    const who = side === 'a' ? side1 : side2;
    // 3 or sometimes 4 formations per side — seeded, so each battle keeps
    // its own order of battle but they stop all looking identical.
    const n = 3 + (rnd() < 0.4 ? 1 : 0);
    if (airRaid) {
      const raidDefs: Array<[string, BattleUnit['shape'], number]> =
        side === 'a'
          ? [
              [`${who} strike wave`, 'plane', 1.0],
              [`${who} torpedo bombers`, 'plane', 0.9],
              [`${who} escort fighters`, 'plane', 0.7],
              [`${who} second wave`, 'plane', 0.8],
            ]
          : [
              [`${who} fleet at anchor`, 'ship', 1.1],
              [`${who} harbour watch`, 'ship', 0.6],
              [`${who} shore defences`, 'block', 0.9],
              [`${who} airfields`, 'block', 0.7],
            ];
      for (let i = 0; i < n; i++) mk(side, i, n, raidDefs[i][0], raidDefs[i][1], raidDefs[i][2]);
      continue;
    }
    const defs: Array<[string, BattleUnit['shape'], number]> = air
      ? [
          [`${who} fighter wing`, 'plane', 0.9],
          [`${who} bomber group`, 'plane', 1.1],
          [`${who} reserve squadrons`, 'plane', 0.7],
          [`${who} escort wing`, 'plane', 0.6],
        ]
      : naval
        ? [
            [`${who} van`, 'ship', 0.8],
            [`${who} main fleet`, 'ship', 1.1],
            [`${who} rear`, 'ship', 0.7],
            [`${who} screening ships`, 'ship', 0.55],
          ]
        : modern
          ? [
              [`${who} infantry`, 'block', 1.2],
              [`${who} armour`, 'vehicle', 0.8],
              [`${who} reserves`, 'block', 0.9],
              [`${who} artillery`, 'vehicle', 0.55],
            ]
          : [
              [`${who} infantry`, 'block', 1.2],
              [`${who} cavalry`, 'cavalry', 0.8],
              [`${who} reserves`, 'block', 0.9],
              [`${who} archers`, 'block', 0.7],
            ];
    for (let i = 0; i < n; i++) mk(side, i, n, defs[i][0], defs[i][1], defs[i][2]);
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

  // Who lost? The side the victor's name matches LEAST (generic words like
  // "Kingdom" appear on both sides, so count matches rather than any-hit).
  const hits = (s: string) =>
    s.split(/[ ,&]+/).filter((w) => w.length > 3 && b.victor?.includes(w)).length;
  const victorIsA = !!b.victor && hits(side1) > hits(side2);
  const loser: 'a' | 'b' = victorIsA ? 'b' : 'a';

  // A third act whenever history tells us how it ended: named after the
  // outcome when the words are there, else the plain fall of the day. The
  // beaten side streams off its own edge of the field.
  const endText = `${b.outcome ?? ''} ${b.significance ?? ''}`;
  let ending = /rout/i.test(endText)
    ? 'The rout'
    : /siege|besieg/i.test(endText)
      ? 'The siege closes'
      : /surrender|capitulat/i.test(endText)
        ? 'The surrender'
        : /retreat|withdr|flee|fled|fell back|evacuat/i.test(endText)
          ? 'The retreat'
          : null;
  if (!ending && b.victor) ending = 'The day is decided';
  if (ending) {
    // Choreograph the final act: give every formation a THIRD position for the
    // ending phase, so the armies actually MOVE at the climax instead of only
    // thinning in place. The beaten side streams off its own back edge (a rout),
    // the victor pushes forward into the ground they quit; in a siege the loser
    // is penned into the centre while the besiegers close in.
    const siege = ending === 'The siege closes';
    for (const u of units) {
      const [cx, cy] = u.pos[u.pos.length - 1];
      const isLoser = u.side === loser;
      let rx: number;
      let ry: number;
      if (siege) {
        rx = isLoser ? 50 + (rnd() - 0.5) * 6 : u.side === 'a' ? 42 : 58;
        ry = isLoser ? 28 + (rnd() - 0.5) * 8 : cy;
      } else if (isLoser) {
        rx = u.side === 'a' ? 5 + rnd() * 4 : 91 - rnd() * 4; // off their own edge
        ry = cy + (rnd() - 0.5) * 12;
      } else {
        // pursue forward into the vacated centre, but not off the far edge
        rx = u.side === 'a' ? Math.min(72, cx + 16 + rnd() * 6) : Math.max(28, cx - 16 - rnd() * 6);
        ry = cy + (rnd() - 0.5) * 6;
      }
      u.pos.push([rx, ry]);
    }
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
    loser: b.victor ? loser : undefined, // their ranks thin faster in 3D
    severity: scale, // bloodier records thin the ranks harder
  };
}
