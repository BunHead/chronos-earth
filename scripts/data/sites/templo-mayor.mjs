/**
 * Templo Mayor, Tenochtitlan (Aztec/Mexica) — recipe (11 Oct 2026).
 *
 * POSITION: OpenStreetMap's outline of the temple's excavated remains
 * ("Templo Mayor", historic=ruins, ODbL). Those remains are earlier, smaller
 * stages, so the base drawn is the published final one (approximate in
 * orientation). The rest of the block is modern Mexico City: left out.
 * Facts:
 *   A double temple — Huitzilopochtli and Tlaloc — on one truncated pyramid
 *     with a double stairway; about 42–45 m high (es.wikipedia; en.wikipedia
 *     gives ~60 m) on a base of about 100 × 80 m (en.wikipedia).
 *   First built after 1325 and rebuilt in seven stages, the sixth c. 1500
 *     (en/es.wikipedia): the model shows its final form, from 1325 on.
 *   Almost totally destroyed by the Spanish in 1521 and its stone reused;
 *     rediscovered in 1978 and excavated 1978–1982 (en.wikipedia) → hidden
 *     1521–1978, then the razed foundations as they stand today.
 *   Its stairs faced west — not stated in these sources, so approximate.
 */
export default {
  site: 'templo-mayor',
  title: 'Templo Mayor',
  planKey: 'siteplan:osm-templo-mayor@19.435,-99.131',
  defaultFromYear: 1325,
  ruinYear: 1978,
  temples: {
    'Templo Mayor': {
      model: 'meso-templo-mayor', title: 'Templo Mayor (Tenochtitlan)', heightM: 45, levels: 4, stair: 'W',
      widthM: 100, depthM: 80, twin: true, noRoofComb: true, builtYear: 1325,
      buried: [1521, 1978], ruinStubM: 4,
      note: 'Twin temples of Huitzilopochtli and Tlaloc on a ~100 × 80 m pyramid, 42–45 m high, double stair; rebuilt in seven stages from 1325; razed by the Spanish in 1521, excavated from 1978 (Wikipedia). Levels and stair side approximate.',
    },
  },
  named: {},
};
