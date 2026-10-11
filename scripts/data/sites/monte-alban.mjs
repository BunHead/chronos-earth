/**
 * Monte Albán (Zapotec) — whole-site recipe (11 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/monte-alban.json, ODbL): the
 * buildings of the Main Plaza, the North Platform, the South Temple, Building
 * J, the ball courts and tombs. The museum is left out.
 * Facts (en.wikipedia, Monte Albán):
 *   Founded around 500 BC on an artificially levelled mountaintop; capital
 *     of an expansionist Zapotec polity by the Terminal Formative; at its
 *     height AD 500–750 and soon after largely abandoned → ruin from 750.
 *   The Main Plaza, ~300 × 150 m, plastered white; the North and South
 *     Platforms at its ends, reached by monumental stairs; Building J in the
 *     middle, arrow-shaped and turned from the site's grid.
 * NO structure heights are given in these sources: every building is drawn
 * from its footprint and labelled "height estimated".
 */
export default {
  site: 'monte-alban',
  title: 'Monte Albán',
  planKey: 'siteplan:osm-monte-alban@17.044,-96.768',
  defaultFromYear: -500,
  ruinYear: 750,
  temples: {},
  named: {
    'Plataforma Norte': { role: 'estimate' },
    'Templo Sur': { role: 'estimate' },
  },
};
