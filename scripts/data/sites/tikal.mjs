/**
 * Tikal — the recipe for the whole-site model (the Captain, 10 Oct 2026:
 * "the entire site, not just one pyramid").
 *
 * OUTLINES come from OpenStreetMap (scripts/data/osm/tikal.json, ODbL). This
 * file adds only what OSM does not hold, each with its source:
 *
 *   heights — OSM's own height tags for Temples I–V (they match the articles),
 *             else English Wikipedia as cited per row;
 *   dates and stair directions — English Wikipedia ("Tikal Temple I" …),
 *             Temple II from Spanish Wikipedia (Templo de las Máscaras).
 *
 * The great temples become their own true-metre models (each sits on its own
 * patch of ground — Tikal spreads over a kilometre of hills); everything else
 * becomes ground-hugging platforms and walls in a site plan.
 */
export default {
  site: 'tikal',
  title: 'Tikal',
  // The site-plan key: an editable plan like the Captain's own surveys, so
  // he can refine it in the site builder and his saved version wins.
  planKey: 'siteplan:osm-tikal@17.222,-89.624',
  // Unnamed structures: the layout visible today is Late Classic. Shown from
  // AD 600 (the great building age) — the North Acropolis has its own date.
  defaultFromYear: 600,
  // Abandoned by the end of the 10th century (Wikipedia); its temples grey from c. 900.
  ruinYear: 900,
  temples: {
    // OSM name → spec. stair = compass direction the main stairway faces.
    'Templo del Gran Jaguar': {
      model: 'meso-tikal-t1', title: 'Tikal Temple I', heightM: 47, levels: 9, stair: 'W', builtYear: 732,
      note: 'Temple of the Great Jaguar, funerary temple of Jasaw Chan K\'awiil I; nine levels; faces west across the Great Plaza (Wikipedia).',
    },
    'Templo de las Máscaras': {
      model: 'meso-tikal-t2', title: 'Tikal Temple II', heightM: 38, levels: 3, stair: 'E', builtYear: 700,
      note: 'Temple of the Masks, built c. AD 700 for Lady Kalajuun Une\' Mo\'; three levels; faces Temple I (es.wikipedia, Wikipedia).',
    },
    'Templo del Gran Sacerdote': {
      model: 'meso-tikal-t3', title: 'Tikal Temple III', heightM: 55, levels: 9, stair: 'E', builtYear: 810,
      note: 'Temple of the Jaguar Priest, dated 810 by Stela 24; nine levels; faces east to the Great Plaza (Wikipedia).',
    },
    'Templo de la Serpiente Bicéfala': {
      model: 'meso-tikal-t4', title: 'Tikal Temple IV', heightM: 70, levels: 7, stair: 'E', builtYear: 741,
      note: 'Temple of the Double-Headed Serpent, c. 741; the tallest Maya structure of its age; seven levels; faces east (Wikipedia).',
    },
    'Templo V': {
      model: 'meso-tikal-t5', title: 'Tikal Temple V', heightM: 57, levels: 7, stair: 'N', builtYear: 700,
      note: 'c. AD 700; seven 4 m levels; its stair rises from the north, unusually for Tikal (Wikipedia).',
    },
    'Píramide Mundo Perdido': {
      model: 'meso-tikal-mp', title: 'Mundo Perdido Pyramid (Tikal)', heightM: 31, levels: 10, stair: 'W', radial: true, sideStairsTo: 0.8, builtYear: 250,
      note: 'The Lost World pyramid, 31 m on a 67.5 m base; stairs east and west to the top, north and south to the 8th of 10 levels; final Teotihuacan-influenced form c. AD 250 (Wikipedia).',
    },
  },
  // Named platforms and plazas, by OSM name.
  named: {
    'Acrópolis del Norte': { role: 'platform', heightM: 12, fromYear: -350, color: '#c9c0a8', note: '12 m above the Great Plaza, ~100 × 80 m (Wikipedia)' },
    'Acrópolis Central': { role: 'platform', heightM: 3, color: '#c9c0a8', note: 'a few metres above the Great Plaza (Wikipedia)' },
    'La Gran Plaza': { role: 'plaza', heightM: 0.4, fromYear: -350 },
    'Plaza de los Siete Templos': { role: 'plaza', heightM: 0.4 },
    'Acrópolis Sur': { role: 'wall', heightM: 6, thicknessM: 8 },
  },
};
