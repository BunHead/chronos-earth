/**
 * Calakmul (Ox Te' Tuun, seat of the Kaanul "Snake Kings") — whole-site
 * recipe (11 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/calakmul.json, ODbL).
 * Facts:
 *   Structure II — over 45 m high, one of the tallest Mesoamerican pyramids;
 *     TRIADIC (the site's name "Three Stones" may come from it); its great
 *     foundations date to the Late Preclassic; stelae in it record a king's
 *     enthronement in 411 (en/es.wikipedia). It closes the SOUTH side of the
 *     Great Plaza (es.wikipedia), so its front faces north onto the plaza.
 *     The number of its levels is not given: six is approximate.
 *   Elite presence continued until about AD 900 (en.wikipedia) → ruin from 900.
 * Structure I and the others have no heights in these sources: footprints,
 * labelled "height estimated".
 */
export default {
  site: 'calakmul',
  title: 'Calakmul',
  planKey: 'siteplan:osm-calakmul@18.105,-89.811',
  defaultFromYear: 400,
  ruinYear: 900,
  temples: {
    'Estructura II': {
      model: 'meso-calakmul-ii', title: 'Structure II (Calakmul)', heightM: 45, levels: 6, stair: 'N',
      triadic: true, builtYear: -300,
      note: 'Over 45 m, triadic, on Late Preclassic foundations; closes the south side of the Great Plaza (Wikipedia). Levels approximate.',
    },
  },
  named: {
    'Estructura I': { role: 'estimate' },
    'Gran Acrópolis / Estructura XX': { role: 'estimate' },
  },
};
