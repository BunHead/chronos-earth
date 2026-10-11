/**
 * Písac (Inca) — recipe (11 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/pisac.json, ODbL): 48 traced
 * walls and terrace retaining walls (historic=yes). The 77 untagged
 * buildings cannot be told apart from the modern town below and are left
 * out, so this is the terraces and walls only — no invented buildings.
 * Facts (en.wikipedia, Písac):
 *   Built by Pachacuti (r. 1438–1471/2) no earlier than 1440, as residence,
 *     citadel, observatory and religious site.
 *   Destroyed by Pizarro's Spanish in the early 1530s → reduced from 1532.
 * WALL HEIGHTS are not given: 2.5 m terraces / walls standing and 1.5 m as
 * ruin are ESTIMATES, labelled on every part.
 */
export default {
  site: 'pisac',
  title: 'Písac',
  planKey: 'siteplan:osm-pisac@-13.411,-71.847',
  defaultFromYear: 1440,
  ruinYear: 1532,
  wallDefaults: {
    heightM: 2.5, ruinHeightM: 1.5, untilYear: 1532, thicknessM: 1.2,
    note: 'Inca terrace or wall; height estimated (2.5 m, 1.5 m after the Spanish destruction of the early 1530s)',
  },
  temples: {},
  named: {},
};
