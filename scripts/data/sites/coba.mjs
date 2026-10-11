/**
 * Cobá — whole-site recipe (11 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/coba.json, ODbL), wide enough
 * (2.2 km) to reach the Nohoch Mul group north-east of the Cobá group.
 * Facts:
 *   Most of the city built AD 500–900 (es.wikipedia); the hub of the largest
 *     network of Maya causeways (en.wikipedia). After 1000 it lost much of its
 *     political weight → ruin from 1000.
 *   Nohoch Mul (Ixmoja) — 42 m, seven levels with rounded edges, a central
 *     staircase of 120 steps to the summit temple (en.wikipedia, Nohoch Mul).
 *     Which side the stair is on is not given: its OSM outline is turned ~45°,
 *     and the stair side chosen is approximate, and said so.
 *   La Iglesia — 24 m, nine stepped levels with rounded corners, begun in the
 *     Early Classic (es.wikipedia; OSM's INAH-sourced description). Stair side
 *     not given: west is approximate.
 */
export default {
  site: 'coba',
  title: 'Cobá',
  planKey: 'siteplan:osm-coba@20.498,-87.731',
  defaultFromYear: 500,
  ruinYear: 1000,
  temples: {
    'Nohoch Mul': {
      model: 'meso-coba-nohochmul', title: 'Nohoch Mul (Cobá)', heightM: 42, levels: 7, stair: 'S', noRoofComb: true, builtYear: 700,
      note: '42 m, seven levels with rounded edges and a central stair of 120 steps (Wikipedia); the stair side is approximate.',
    },
    'La Iglesia': {
      model: 'meso-coba-iglesia', title: 'La Iglesia (Cobá)', heightM: 24, bodyM: 24, levels: 9, stair: 'W', noRoofComb: true, builtYear: 500,
      note: '24 m, nine stepped levels with rounded corners, begun in the Early Classic (es.wikipedia); stair side approximate.',
    },
  },
  named: {},
};
