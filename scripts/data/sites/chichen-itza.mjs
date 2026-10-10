/**
 * Chichén Itzá — whole-site recipe (the Captain, 10 Oct 2026).
 *
 * OUTLINES: OpenStreetMap (scripts/data/osm/chichen-itza.json, ODbL). The 947
 * vendors' stalls (building=commercial) carry no historic tag and are left out.
 * Facts, English Wikipedia ("El Castillo, Chichen Itza"; "Chichen Itza"):
 *   El Castillo — nine terraces, 24 m, plus a 6 m temple; square base 55.3 m;
 *     a stairway on each of the four sides; built between the 8th and 12th
 *     centuries (shown from 900). Its north stair, with the serpent heads,
 *     is the main one.
 *   Great Ball Court — 168 × 70 m; the parallel platforms flanking the alley
 *     are each 95 m long, their walls 8 m high.
 *   Dates — earliest inscription AD 832, last 998 (the Osario); the city
 *     declined as a regional centre by 1100 → ruin from 1100.
 * The Temple of the Warriors and the Osario have no height in these sources:
 * they are drawn from their footprints and labelled "height estimated".
 */
export default {
  site: 'chichen-itza',
  title: 'Chichén Itzá',
  planKey: 'siteplan:osm-chichen-itza@20.683,-88.569',
  defaultFromYear: 832,
  ruinYear: 1100,
  temples: {
    'Templo de Kukulkán': {
      model: 'meso-chichen-castillo', title: 'El Castillo (Temple of Kukulcán)', heightM: 30, templeM: 6,
      levels: 9, stair: 'N', radial: true, stairsInOutline: true, builtYear: 900,
      note: 'Nine terraces (24 m) and a 6 m temple on a 55.3 m square base, a stairway on each side; built between the 8th and 12th centuries (Wikipedia).',
    },
  },
  named: {
    'Juego de Pelota': {
      role: 'ballcourt', heightM: 8, platformLengthM: 95, platformWidthM: 12,
      note: 'the Great Ball Court, 168 × 70 m; its flanking platforms 95 m long, walls 8 m high (Wikipedia)',
    },
    'Templo de los Guerreros': { role: 'estimate' },
    'El Osario': { role: 'estimate' },
    'Grupo de las Mil Columnas': { role: 'plaza', heightM: 0.5 },
  },
};
