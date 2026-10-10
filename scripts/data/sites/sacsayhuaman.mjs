/**
 * Sacsayhuamán — whole-site recipe (the Captain, 10 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/sacsayhuaman.json, ODbL): the
 * three great zig-zag walls traced as ~125 wall segments, and the round
 * tower Muyuqmarka. The 116 untagged buildings are modern houses — left out.
 * Facts:
 *   Built under Pachacuti (r. 1438–1471) and his successors Topa Inca
 *     Yupanqui and Huayna Capac (en.wikipedia) → shown from 1450.
 *   Three great stone walls; three towers, the first, Muyuqmarka, cylindrical,
 *     about four storeys high and about 22 m across (es.wikipedia).
 *   Only ~20% survives: after Manco Inca's uprising the Spanish dismantled
 *     the walls and towers and reused the stone in Cusco (es.wikipedia) →
 *     reduced from 1536; Muyuqmarka survives only as foundations.
 *   WALL HEIGHTS are not given in these sources: ~6 m standing and ~3 m as
 *     today's ruin are ESTIMATES, labelled so on every part.
 */
export default {
  site: 'sacsayhuaman',
  title: 'Sacsayhuamán',
  planKey: 'siteplan:osm-sacsayhuaman@-13.509,-71.982',
  defaultFromYear: 1450,
  ruinYear: 1536,
  wallDefaults: {
    heightM: 6, ruinHeightM: 3, untilYear: 1536, thicknessM: 3,
    note: 'great wall; height estimated (6 m standing, 3 m after the Spanish dismantling of 1536)',
  },
  temples: {},
  named: {
    Muyuqmarka: {
      role: 'tower', radiusM: 11, heightM: 13, ruinHeightM: 1, untilYear: 1536,
      note: 'round tower about four storeys high and 22 m across (es.wikipedia); height estimated; only its foundations survive',
    },
  },
};
