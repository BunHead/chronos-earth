// Chronos Earth — monuments that change through time.
//
// Some places aren't one building but several across the centuries — raised,
// slighted, rebuilt, burnt, restored. A monument with phases shows the form it
// wore at the timeline's current year, and the viewer offers a bar to step
// through its life. Nottingham Castle is the showcase: Norman castle → ducal
// mansion → the 1831 fire → today's museum.

export interface MonumentPhase {
  /** The phase begins in this (signed) calendar year. */
  fromYear: number;
  /** Short date shown on the phase bar, e.g. "1674". */
  yearLabel: string;
  /** What it was, e.g. "Ducal mansion". */
  label: string;
  /** Which 3D archetype to build for this phase. */
  model: string;
  /** Visual state — 'burning' adds flames & smoke, 'ruin' a broken form. */
  state?: 'intact' | 'burning' | 'ruin';
  /** A sentence for the viewer. */
  note?: string;
}

const PHASES: Array<{ match: string; phases: MonumentPhase[] }> = [
  {
    match: 'nottingham castle',
    phases: [
      { fromYear: 1068, yearLabel: '1068', label: 'Norman castle', model: 'castle',
        note: "William the Conqueror's motte-and-bailey, later rebuilt in stone on the crag." },
      { fromYear: 1674, yearLabel: '1674', label: 'Ducal mansion', model: 'mansion',
        note: 'After the Civil War the castle was levelled; the Duke of Newcastle raised a Palladian mansion on the site.' },
      { fromYear: 1831, yearLabel: '1831', label: 'The fire', model: 'mansion', state: 'burning',
        note: 'Gutted by fire during the Reform Bill riots — left a blackened shell for decades.' },
      { fromYear: 1878, yearLabel: '1878', label: 'Castle Museum', model: 'mansion',
        note: 'Restored and reopened as the first municipal museum of art outside London.' },
    ],
  },
];

/** The phases for a monument, or null if it has none (renders normally). */
export function phasesFor(title: string): MonumentPhase[] | null {
  const t = String(title).toLowerCase();
  for (const p of PHASES) if (t.includes(p.match)) return p.phases;
  return null;
}

/** Index of the phase in force at a given year (the last one that has begun;
 * clamped to the first for years before it was built). */
export function phaseIndexAt(phases: MonumentPhase[], year: number): number {
  let idx = 0;
  for (let i = 0; i < phases.length; i++) if (year >= phases[i].fromYear) idx = i;
  return idx;
}
