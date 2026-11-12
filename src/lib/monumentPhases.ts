// Chronos Earth — monuments that change through time.
//
// Some places aren't one building but several across the centuries — raised,
// slighted, rebuilt, burnt, restored. A monument with phases shows the form it
// wore at the timeline's current year, and the viewer offers a bar to step
// through its life. Nottingham Castle is the showcase: Norman castle → royal
// fortress → pulled down → ducal mansion → the 1831 fire → today's museum.

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
  /** For a built-through-time model (Giza): construction completion, 0..1. */
  build?: number;
  /** A sentence for the viewer. */
  note?: string;
}

const PHASES: Array<{ match: string; phases: MonumentPhase[] }> = [
  {
    // Edinburgh Castle on Castle Rock (components/edinburghCastle.ts). The
    // build fractions pick its periods; the globe swaps the same stages by date
    // (lib/stageTable.ts).
    match: 'edinburgh castle',
    phases: [
      { fromYear: -900, yearLabel: 'c. 900 BCE', label: 'The hillfort', model: 'edinburgh-castle', build: 0.1,
        note: 'People lived on Castle Rock from the Late Bronze Age. By about 600 CE it was Din Eidyn, a stronghold of the Gododdin: a palisade and roundhouses on the bare summit.' },
      { fromYear: 1130, yearLabel: '1130', label: 'David I’s castle', model: 'edinburgh-castle', build: 0.25,
        note: 'King David I made it a royal castle. St Margaret’s Chapel, built for him in memory of his mother, still stands: the oldest building in Edinburgh.' },
      { fromYear: 1370, yearLabel: '1370', label: 'David’s Tower', model: 'edinburgh-castle', build: 0.4,
        note: 'Robert the Bruce had the castle slighted in 1314. David II rebuilt it from 1356 around a great L-plan tower house, David’s Tower, facing the town.' },
      { fromYear: 1511, yearLabel: '1511', label: 'The Great Hall', model: 'edinburgh-castle', build: 0.55,
        note: 'James IV finished the Great Hall on the south side of Crown Square, its hammerbeam roof one of the finest in Scotland, beside the royal lodging.' },
      { fromYear: 1574, yearLabel: '1574', label: 'After the Lang Siege', model: 'edinburgh-castle', build: 0.7,
        note: 'English guns battered David’s Tower down in the Lang Siege of 1573. The Half Moon Battery was built over its ruins, and the palace was remodelled for James VI in 1617.' },
      { fromYear: 1800, yearLabel: '1800', label: 'The garrison', model: 'edinburgh-castle', build: 0.85,
        note: 'A fortress for the army: the Queen Anne Building (1708), the Governor’s House (1742), the North Barracks (1755) and the towering New Barracks (1799); the Esplanade became a parade ground in 1753.' },
      { fromYear: 1927, yearLabel: 'today', label: 'Today', model: 'edinburgh-castle', build: 1,
        note: 'The Gatehouse (1888) and the Scottish National War Memorial (1927), made from the old barracks, complete the castle seen from Princes Street.' },
    ],
  },
  {
    // Neuschwanstein on its ridge (components/neuschwanstein.ts); the globe
    // swaps the same stages by date (lib/stageTable.ts).
    match: 'neuschwanstein',
    phases: [
      { fromYear: 1100, yearLabel: 'c. 1100', label: 'Two medieval castles', model: 'neuschwanstein', build: 0.15,
        note: 'The ridge above the Pöllat gorge carried two small castles, Vorderhohenschwangau and Hinterhohenschwangau, guarding the road through the Alps.' },
      { fromYear: 1800, yearLabel: 'by 1800', label: 'The ruins', model: 'neuschwanstein', build: 0.3,
        note: 'Both castles had fallen into ruin. As a boy Ludwig II knew them from his father’s castle of Hohenschwangau across the valley.' },
      { fromYear: 1869, yearLabel: '1869', label: 'Building begins', model: 'neuschwanstein', build: 0.5,
        note: 'The ruins were cleared and the ridge blasted down about 8 m (1868); the foundation stone was laid on 5 September 1869. The Gatehouse was finished first, in 1873, and Ludwig lived in it while the Palas rose.' },
      { fromYear: 1884, yearLabel: '1884', label: 'The Palas', model: 'neuschwanstein', build: 0.75,
        note: 'Ludwig moved into the Palas in 1884. He lived there only 172 days in all: in June 1886 he was declared unfit to rule and died days later.' },
      { fromYear: 1892, yearLabel: '1892', label: 'Completed without him', model: 'neuschwanstein', build: 1,
        note: 'The Bower, the Knights’ House and the Square Tower were finished in a simpler form by 1892. The great keep and the chapel were never built; the castle opened to visitors weeks after Ludwig’s death.' },
    ],
  },
  {
    // Nottingham Castle on Castle Rock (components/nottinghamCastle.ts); the
    // globe swaps the same stages by date (lib/stageTable.ts). What stands
    // today is the ducal mansion turned museum, not a battlemented castle.
    match: 'nottingham castle',
    phases: [
      { fromYear: 1068, yearLabel: '1068', label: 'Norman castle', model: 'nottingham-castle', build: 0.1,
        note: 'William the Conqueror had a timber castle built on the rock in 1068: a wooden tower and palisades above the cliffs.' },
      { fromYear: 1172, yearLabel: 'c. 1172', label: 'Henry II’s stone castle', model: 'nottingham-castle', build: 0.2,
        note: 'King Henry II rebuilt it in stone: an upper bailey with the great tower on top of the rock, and a middle bailey below. The middle bridge of about 1170 still stands.' },
      { fromYear: 1255, yearLabel: '1255', label: 'The outer bailey', model: 'nottingham-castle', build: 0.3,
        note: 'Henry III walled the big outer bailey in stone and built the gatehouse (1252–55). The gatehouse and long runs of that wall still stand.' },
      { fromYear: 1476, yearLabel: '1476', label: 'Royal castle at its height', model: 'nottingham-castle', build: 0.4,
        note: 'Edward IV ordered a new tower and royal rooms in 1476: “the most beautifulest part”, wrote John Leland. Richard III rode from here to Bosworth.' },
      { fromYear: 1651, yearLabel: '1651', label: 'Pulled down', model: 'nottingham-castle', build: 0.5,
        note: 'Parliament’s men held the castle through the Civil War. In 1651 it was pulled down so it could never be used again. Only the outer walls and the gatehouse were left.' },
      { fromYear: 1679, yearLabel: '1679', label: 'Ducal mansion', model: 'nottingham-castle', build: 0.6,
        note: 'The Duke of Newcastle cleared the top of the rock and built a grand Italian-style mansion there (1674–79). His son finished it.' },
      { fromYear: 1831, yearLabel: '1831', label: 'The fire', model: 'nottingham-castle', build: 0.7, state: 'burning',
        note: 'Gutted by fire during the Reform Bill riots of 1831. It stood as a roofless, blackened shell for more than forty years.' },
      { fromYear: 1878, yearLabel: '1878', label: 'Castle Museum', model: 'nottingham-castle', build: 0.85,
        note: 'T. C. Hine rebuilt the shell with a glass-roofed picture gallery. It opened in 1878 as the first town-owned art gallery in Britain outside London.' },
      { fromYear: 2021, yearLabel: 'today', label: 'Today', model: 'nottingham-castle', build: 1,
        note: 'Reopened in 2021 after a big restoration, with a new visitor centre by the medieval gatehouse. Caves run through the rock below, among them Mortimer’s Hole.' },
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
      { fromYear: 80, yearLabel: '80 CE', label: 'The arena', model: 'colosseum',
        note: 'Opened in 80 CE with 100 days of games — gladiators, wild beasts and even mock sea-battles before some 50,000 spectators.' },
      { fromYear: 1349, yearLabel: '1349', label: 'Ruin', model: 'colosseum', state: 'ruin',
        note: 'A great earthquake toppled the south outer wall in 1349, and for centuries its stone was quarried for Rome’s churches and palaces — leaving the ruin we know.' },
    ],
  },
  {
    // The Giza plateau, raised across three reigns — the phase bar steps through
    // the CONSTRUCTION: bare cores rise, then white casing (and perhaps gold caps) go on,
    // and the Sphinx is carved from the bedrock.
    match: 'giza',
    phases: [
      { fromYear: -2600, yearLabel: 'c. 2600 BCE', label: 'Khufu’s pyramid rises', model: 'giza', build: 0.35,
        note: 'The Great Pyramid’s core goes up first — some 2.3 million limestone blocks, hauled up mud-brick ramps under Pharaoh Khufu.' },
      { fromYear: -2560, yearLabel: 'c. 2560 BCE', label: 'Cased in white', model: 'giza', build: 0.6,
        note: 'The finished pyramid is sheathed in smooth white Tura limestone, dazzling in the sun. It may have been crowned with a gilded capstone, but none survives. Khafre begins his own.' },
      { fromYear: -2530, yearLabel: 'c. 2530 BCE', label: 'The Sphinx is carved', model: 'giza', build: 0.88,
        note: 'Khafre’s pyramid is complete, and the Great Sphinx is carved from a knoll of bedrock nearby, guarding the plateau. Menkaure’s smaller pyramid rises last.' },
      { fromYear: -2500, yearLabel: 'c. 2500 BCE', label: 'The plateau complete', model: 'giza', build: 1,
        note: 'All three pyramids stand cased in white (perhaps gold-capped, though no capstone survives), the Sphinx before them, the Nile and its harbours close to the east — the plateau at its height.' },
    ],
  },
  {
    match: 'colossus',
    phases: [
      { fromYear: -280, yearLabel: 'c. 280 BCE', label: 'The Colossus raised', model: 'colossus',
        note: 'A ~33 m bronze Helios set beside the harbour of Rhodes to mark the island’s survival of a great siege — one of the tallest statues of the ancient world.' },
      { fromYear: -226, yearLabel: 'c. 226 BCE', label: 'The earthquake', model: 'colossus', state: 'ruin',
        note: 'An earthquake snapped the Colossus at the knees after just 54 years. The great bronze pieces lay where they fell, marvelled at by travellers for centuries.' },
    ],
  },
  {
    match: 'lighthouse of alexandria',
    phases: [
      { fromYear: -280, yearLabel: 'c. 280 BCE', label: 'The Pharos', model: 'pharos',
        note: 'The great lighthouse on Pharos island — over 100 m tall, its fire and mirror guiding ships into Alexandria for more than 1,500 years.' },
      { fromYear: 1303, yearLabel: '1303–1480', label: 'Earthquakes topple it', model: 'pharos', state: 'ruin',
        note: 'A series of earthquakes felled the last surviving ancient Wonder. Its stone was reused for a harbour fort; blocks still lie on the seabed today.' },
    ],
  },
  {
    match: 'mausoleum',
    phases: [
      { fromYear: -350, yearLabel: 'c. 350 BCE', label: 'The tomb of Mausolus', model: 'mausoleum',
        note: 'The towering tomb at Halicarnassus, crowned by a marble chariot — so renowned it gave us the word “mausoleum”.' },
      { fromYear: 1404, yearLabel: 'by 1404', label: 'Fallen to earthquakes', model: 'mausoleum', state: 'ruin',
        note: 'Earthquakes toppled the tomb over the centuries, and crusader knights later quarried its stone for a castle. Only foundations remain.' },
    ],
  },
  {
    match: 'temple of artemis',
    phases: [
      { fromYear: -550, yearLabel: 'c. 550 BCE', label: 'The great temple', model: 'artemis-temple',
        note: 'The colossal Ionic temple at Ephesus, a forest of ~127 columns, funded in part by King Croesus of Lydia.' },
      { fromYear: -356, yearLabel: '356 BCE', label: 'Burned by Herostratus', model: 'artemis-temple', state: 'burning',
        note: 'A man named Herostratus set the temple ablaze to make his name live forever — on, it was said, the very night Alexander the Great was born.' },
      { fromYear: -323, yearLabel: 'rebuilt', label: 'Raised again, grander', model: 'artemis-temple',
        note: 'The Ephesians rebuilt it larger and more splendid than before — the version counted among the Seven Wonders.' },
      { fromYear: 268, yearLabel: '268 CE', label: 'Destroyed', model: 'artemis-temple', state: 'ruin',
        note: 'Sacked by the Goths and later dismantled for its stone. Today a single reassembled column marks the site.' },
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
