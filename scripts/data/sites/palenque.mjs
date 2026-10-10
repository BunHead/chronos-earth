/**
 * Palenque (Lakamha', capital of B'aakal) — whole-site recipe (10 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/palenque.json, ODbL).
 * Facts:
 *   Temple of the Inscriptions — a stepped pyramid 22.8 m high, eight levels
 *     plus the temple (nine in all), with a roof comb of which only the lower
 *     part survives (es.wikipedia, Templo de las Inscripciones); funerary
 *     monument of K'inich Janaab' Pakal, finished shortly after 683
 *     (en.wikipedia). Its stair faces north, toward the Palace.
 *   The Palace — enlarged and remodelled in 654, 661 and 668; its four-storey
 *     Observation Tower (en.wikipedia, Palenque). No overall height published:
 *     drawn from its footprint, labelled estimated.
 *   Abandonment — no new monuments after the 8th century; the last date is
 *     AD 799 → ruin from 800.
 * The Cross Group and other temples have no heights in these sources: drawn
 * from their footprints and labelled "height estimated".
 */
export default {
  site: 'palenque',
  title: 'Palenque',
  planKey: 'siteplan:osm-palenque@17.484,-92.046',
  // Pakal's accession (615) opens the great building age.
  defaultFromYear: 615,
  ruinYear: 800,
  temples: {
    'Templo de las Inscripciones': {
      model: 'meso-palenque-inscriptions', title: 'Temple of the Inscriptions (Palenque)', heightM: 22.8, bodyM: 22.8,
      levels: 8, stair: 'N', builtYear: 683,
      note: '22.8 m stepped pyramid, eight levels plus the temple; Pakal\'s funerary monument, finished shortly after 683 (es/en.wikipedia).',
    },
  },
  named: {
    Palacio: { role: 'estimate' },
    'Juego de Pelota': { role: 'estimate' },
  },
};
