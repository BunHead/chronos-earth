/**
 * Uxmal — whole-site recipe (11 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/uxmal.json, ODbL).
 * Facts (en.wikipedia, Uxmal; Pyramid of the Magician):
 *   Pyramid of the Magician — 35 m (the accepted median; its exact height is
 *     disputed) on a base of about 69 × 49 m, five levels, its layers OVAL —
 *     unusual among Maya pyramids; Puuc style, so its summit temple has no tall
 *     Petén roof comb. Its western stairway faces the setting sun
 *     at the summer solstice, over the Nunnery Quadrangle. Begun in the 6th
 *     century and expanded over the next 400 years → final form shown from 900.
 *   Like other Puuc sites the city flourished AD 600–1000; the great building
 *     period 700–1000; the Nunnery Quadrangle 900–1000 → ruin from 1000.
 * Other structures (the Governor's Palace, the Nunnery, the Great Pyramid)
 * have no heights in these sources: drawn from their footprints, labelled.
 */
export default {
  site: 'uxmal',
  title: 'Uxmal',
  planKey: 'siteplan:osm-uxmal@20.359,-89.771',
  defaultFromYear: 700,
  ruinYear: 1000,
  temples: {
    'Pirámide Adivino': {
      model: 'meso-uxmal-magician', title: 'Pyramid of the Magician (Uxmal)', heightM: 35, levels: 5, stair: 'W',
      oval: true, noRoofComb: true, builtYear: 900,
      note: '35 m on a ~69 × 49 m oval base, five levels; west stair faces the solstice sunset; built from the 6th century over 400 years (Wikipedia).',
    },
  },
  named: {
    'Palacio del Gobernador': { role: 'estimate' },
    'Cuadrángulo de las Monjas': { role: 'estimate' },
    'Gran Pirámide': { role: 'estimate' },
  },
};
