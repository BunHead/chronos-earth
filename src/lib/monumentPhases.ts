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
  /** For a rising-sea model (Atlantis): the water-plane height this phase shows. */
  sea?: number;
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
  {
    match: 'notre-dame de paris',
    phases: [
      { fromYear: 1163, yearLabel: '1163', label: 'The Gothic cathedral', model: 'cathedral',
        note: 'Begun in 1163, completed around 1345 — a masterpiece of French Gothic, with its great spire and flying buttresses.' },
      { fromYear: 2019, yearLabel: '2019', label: 'The fire', model: 'cathedral', state: 'burning',
        note: 'On 15 April 2019 a blaze destroyed the spire and most of the roof, watched by the world.' },
      { fromYear: 2024, yearLabel: '2024', label: 'Restored', model: 'cathedral',
        note: 'Painstakingly rebuilt and reopened in December 2024, spire and all.' },
    ],
  },
  {
    match: 'parthenon',
    phases: [
      { fromYear: -447, yearLabel: '447 BCE', label: 'Temple of Athena', model: 'greek-temple',
        note: 'Raised on the Acropolis at the height of Athens — a Doric temple to the goddess Athena.' },
      { fromYear: 1687, yearLabel: '1687', label: 'The explosion', model: 'greek-temple', state: 'ruin',
        note: 'A Venetian mortar struck the Ottoman gunpowder stored inside; the blast tore the temple apart. It has stood a ruin ever since.' },
    ],
  },
  {
    match: 'colosseum',
    phases: [
      { fromYear: 80, yearLabel: '80 CE', label: 'The arena', model: 'amphitheatre',
        note: 'Opened in 80 CE with 100 days of games — gladiators, wild beasts and even mock sea-battles before some 50,000 spectators.' },
      { fromYear: 1349, yearLabel: '1349', label: 'Ruin', model: 'amphitheatre', state: 'ruin',
        note: 'A great earthquake toppled the south outer wall in 1349, and for centuries its stone was quarried for Rome’s churches and palaces — leaving the ruin we know.' },
    ],
  },
  {
    // Atlantis, drowned "in a single day and night" — the phase bar steps through
    // it. (A flagged hypothesis: the real Richat is a dry natural rock dome.)
    match: 'eye of the sahara',
    phases: [
      { fromYear: -9600, yearLabel: 'her height', label: 'Atlantis', model: 'rings', sea: 0.16,
        note: 'The ringed city at her height — Poseidon’s temple at the heart, the harbour open to the sea, the mountains and their springs to the north.' },
      { fromYear: -9599, yearLabel: 'the deluge', label: 'The deluge', model: 'rings', sea: 1.7,
        note: '“In a single day and night of misfortune…” — the sea climbs, the streets flood, the outer rings vanish beneath the swell.' },
      { fromYear: -9598, yearLabel: 'lost', label: 'Beneath the waves', model: 'rings', sea: 3.1,
        note: '“…Atlantis disappeared into the depths of the sea.” Only the temple’s gilded finial still breaks the surface.' },
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
