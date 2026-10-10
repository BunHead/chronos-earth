/**
 * Teotihuacán — whole-site recipe (the Captain, 10 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/teotihuacan.json, ODbL).
 * Facts:
 *   Pyramid of the Sun — built about AD 200 (en.wikipedia); 65 m high today
 *     (es.wikipedia; 75 m when complete, en.wikipedia — its summit temple was
 *     destroyed before study, so the model has none); its stair faces the
 *     Avenue of the Dead to the west, and the city grid follows its
 *     orientation (en.wikipedia).
 *   Pyramid of the Moon — 43 m, base 147 × 130 m; an older structure existed
 *     before AD 200 and building continued to 450 (en.wikipedia); its stair
 *     faces south down the Avenue of the Dead.
 *   The end — the great monuments were sacked and burned around 550
 *     (en.wikipedia) → ruin from 550.
 *   LEVELS: the sources give no count; five is how both pyramids stand
 *     restored today — approximate, and said so in the notes.
 * Broad, flat-topped central-Mexican pyramids: no roof comb (noComb).
 */
export default {
  site: 'teotihuacan',
  title: 'Teotihuacán',
  planKey: 'siteplan:osm-teotihuacan@19.695,-98.844',
  defaultFromYear: 200,
  ruinYear: 550,
  temples: {
    'Pirámide del Sol': {
      model: 'meso-teo-sun', title: 'Pyramid of the Sun (Teotihuacán)', heightM: 65, levels: 5, stair: 'W',
      noComb: true, topRatio: 0.28, builtYear: 200,
      note: '65 m today (75 m complete) on a ~225 m base, built about AD 200; faces west onto the Avenue of the Dead; five levels as restored (approximate).',
    },
    'Pirámide de la Luna': {
      model: 'meso-teo-moon', title: 'Pyramid of the Moon (Teotihuacán)', heightM: 43, levels: 5, stair: 'S',
      noComb: true, topRatio: 0.3, builtYear: 200,
      note: '43 m on a 147 × 130 m base, built in stages from before AD 200 to 450; faces south down the Avenue of the Dead; five levels as restored (approximate).',
    },
  },
  named: {
    'Camino de los Muertos': { role: 'plaza', heightM: 0.4 },
    'Templo del Quetzalcoatl': { role: 'estimate' },
    'Murallas de la Ciudadela': { role: 'estimate' },
  },
};
