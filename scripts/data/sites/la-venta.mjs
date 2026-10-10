/**
 * La Venta (Olmec) — whole-site recipe (the Captain, 10 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/la-venta.json, ODbL): Structure
 * C-1 (the Great Pyramid), the Complex A mounds, B-1, B-2 and the Stirling
 * "Acropolis". Museums left out. Little more than half of the ancient city
 * survived modern disturbance enough to map (en.wikipedia).
 * Facts (en.wikipedia, La Venta):
 *   The Great Pyramid (Complex C) — 34 m high, about 100,000 m³ of earth fill,
 *     one of the earliest pyramids in Mesoamerica; built almost entirely of
 *     clay, so it is drawn as an earthen mound with no stone stairs.
 *   La Venta reached its apogee after 900 BCE and was all but abandoned by
 *     the beginning of the 4th century BCE → shown from 900 BCE, grass from
 *     400 BCE. The site is oriented 8° west of north.
 * The other mounds have no published heights: drawn from their footprints,
 * labelled "height estimated".
 */
export default {
  site: 'la-venta',
  title: 'La Venta',
  planKey: 'siteplan:osm-la-venta@18.104,-94.040',
  defaultFromYear: -900,
  ruinYear: -400,
  temples: {
    'Edificio C-1': {
      model: 'meso-laventa-c1', title: 'Great Pyramid of La Venta (C-1)', heightM: 34, levels: 1, stair: 'N',
      earthen: true, builtYear: -900,
      note: '34 m of clay and earth (~100,000 m³), one of the earliest Mesoamerican pyramids; La Venta flourished after 900 BCE and was abandoned by c. 400 BCE (Wikipedia).',
    },
  },
  named: {},
};
