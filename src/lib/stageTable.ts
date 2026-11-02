// Chronos Earth — the single date → stage table for additive-phase monuments.
//
// Some monuments are exported in dated phases (Giza rising course-by-course,
// the Tower of London's five reigns, the impact comet → flash → crater). This
// module is the ONE place that answers "at year Y, which exported stage glb of
// this model stands?" — returning a filename suffix ('' = the base/complete
// glb, '-b35' = that stage). Pure and framework-free, so it is unit-tested and
// the globe (src/lib/globeModels.ts) just calls stageFor().

/** One dated stage: from this (signed) year onward, show `suffix`. */
export interface DatedStage {
  from: number;
  suffix: string;
}

/** A stage measured as an offset from the model's own build year (for archetypes
 * placed at many different dates, like the impact crater). */
export interface RelStage {
  offset: number;
  suffix: string;
}

// Irregular, real-date phases listed by hand. Regular build-window models
// (giza, stonehenge, amphitheatre) are registered from their builtYear/buildYears
// at globe load via buildStages() below, so everything resolves through one path.
export const STAGE_TABLE: Record<string, DatedStage[]> = {
  // ERIDU — the longest build sequence in the fleet by a wide margin, and the
  // only one where what grows is mostly the GROUND. Eighteen superimposed
  // temple levels were excavated here; each generation levelled the last and
  // built on top, so the mound climbed with the centuries until Amar-Sin's
  // ziggurat stood on the accumulated ruins of every shrine before it. Dates
  // are the conventional period boundaries, not precise foundation years. Six
  // stages, not eighteen: only these levels left plans distinct enough to build.
  ziggurat: [
    { from: -5400, suffix: '-b15' }, // Levels XVIII–XVII: one room, a niche, a pedestal
    { from: -5100, suffix: '-b25' }, // Level XVI: the cella with its altar recess
    { from: -4700, suffix: '-b35' }, // Level XI: first platform, first buttresses
    { from: -4500, suffix: '-b48' }, // Levels VIII–VII: the tripartite temple
    { from: -4200, suffix: '-b62' }, // Level VI: the finest Ubaid temple
    { from: -3500, suffix: '-b78' }, // Uruk: the great terrace
    { from: -2050, suffix: '' },     // Amar-Sin's ziggurat — the base glb
  ],
  // Stonehenge as a whole site (stonehengeSite.ts) — English Heritage dates.
  // The Palace of Westminster over time (westminsterSite.ts) — UK Parliament dates.
  'westminster-site': [
    { from: 1097, suffix: '-b10' }, // William II's Westminster Hall; the medieval palace
    { from: 1393, suffix: '-b30' }, // Richard II's hammerbeam roof (1393-1401)
    { from: 1834, suffix: '-b45' }, // the fire of 16 October 1834
    { from: 1840, suffix: '-b60' }, // Barry & Pugin's new palace rising
    { from: 1847, suffix: '-b75' }, // Lords open 1847, Commons 1852
    { from: 1859, suffix: '-b90' }, // Elizabeth Tower (Big Ben) complete
    { from: 1860, suffix: '' },     // Victoria Tower complete; today
  ],
  // The Great Wall at Badaling (lib/landmarkMesh.ts). Earlier walls guarded
  // this pass long before the Ming brick one; the stages are dated by reign.
  'great-wall': [
    { from: 555, suffix: '-b30' },  // Northern Qi rammed-earth wall from the Juyong pass westward
    { from: 1368, suffix: '-b60' }, // early Ming: Xu Da fortifies Juyong Pass; rubble-faced wall, beacon towers
    { from: 1505, suffix: '' },     // the Badaling brick wall and watchtowers (Hongzhi 18)
    { from: 1800, suffix: '-ruin' }, // Qing: the wall no longer manned or kept up (approximate)
    { from: 1957, suffix: '' },     // restored, and opened to visitors
  ],
  // Tower Bridge (towerBridgeSite.ts): only the paint changed. Opened 30 June 1894.
  'tower-bridge-site': [
    { from: 1894, suffix: '-b30' }, // chocolate-brown ironwork
    { from: 1977, suffix: '-b70' }, // red, white and blue for the Silver Jubilee
    { from: 2010, suffix: '' },     // blue and white (2008-12 repaint); today
  ],
  // Buckingham Palace over time (buckinghamSite.ts) — Royal Collection Trust dates.
  'buckingham-site': [
    { from: 1703, suffix: '-b10' }, // Buckingham House, built for the Duke of Buckingham
    { from: 1837, suffix: '-b35' }, // Nash's palace (1826-30, finished by Blore); Victoria moves in
    { from: 1850, suffix: '-b60' }, // Blore's East Front closes the quadrangle (1847-50)
    { from: 1911, suffix: '-b85' }, // the Victoria Memorial unveiled; Webb's railings and gates
    { from: 1913, suffix: '' },     // Webb refaces the East Front in Portland stone; today
  ],
  'stonehenge-site': [
    { from: -3000, suffix: '-b15' }, // the circular ditch & bank, 56 Aubrey holes (fresh white chalk)
    { from: -2950, suffix: '-b20' }, // the same, grassed over: chalk is white only for a few decades
    { from: -2900, suffix: '-b35' }, // bluestones standing in the Aubrey holes
    { from: -2500, suffix: '-b60' }, // sarsen circle, lintels, trilithons
    { from: -2300, suffix: '-b80' }, // the Avenue (draped) and the Heel Stone ditch
    { from: -1900, suffix: '' },     // bluestone horseshoe; round barrows around
  ],
  // The Tower of London on its OSM plan (towerOfLondonSite.ts): each part's own build year.
  // St Paul's (stPaulsSite.ts): Old St Paul's from the published plans, Wren's on its OSM plan.
  'st-pauls-site': [
    { from: 1087, suffix: '-b10' }, // the Norman cathedral begun
    { from: 1221, suffix: '-b25' }, // the spire, ~149 m
    { from: 1561, suffix: '-b40' }, // spire burned by lightning
    { from: 1634, suffix: '-b50' }, // Inigo Jones's west portico
    { from: 1666, suffix: '-b60' }, // the Great Fire: a roofless shell
    { from: 1675, suffix: '-b65' }, // Wren begins: the ruins cleared
    { from: 1697, suffix: '-b75' }, // Wren's choir in use, no dome yet
    { from: 1710, suffix: '' },     // the dome complete; today
  ],
  'tower-of-london-site': [
    { from: 1067, suffix: '-b10' }, // William's timber corner-fort
    { from: 1100, suffix: '-b20' }, // the White Tower (begun c. 1078) alone
    { from: 1240, suffix: '-b35' }, // Henry III's inner curtain; the keep whitewashed
    { from: 1285, suffix: '-b50' }, // Edward I's outer curtain and wet moat
    { from: 1532, suffix: '-b65' }, // Tudor: the White Tower's cupolas
    { from: 1700, suffix: '-b80' }, // Stuart storehouses and houses on the green
    { from: 1843, suffix: '-b90' }, // the moat drained; Waterloo Block (1845)
    { from: 1900, suffix: '-b95' },
    { from: 1990, suffix: '' },     // today
  ],
  'tower-of-london': [
    { from: 1070, suffix: '-b15' }, // timber corner-fort
    { from: 1100, suffix: '-b35' }, // the White Tower alone
    { from: 1240, suffix: '-b55' }, // inner ward — Henry III
    { from: 1285, suffix: '-b80' }, // concentric castle + wet moat — Edward I
    { from: 1843, suffix: '' },     // modern, drained moat
  ],
};

// Phase stages RELATIVE to a model's build year, for archetypes dropped at many
// dates. The impact crater plays comet → flash → crater around its event year.
const REL_STAGE_TABLE: Record<string, RelStage[]> = {
  impact: [
    { offset: -3, suffix: '-b15' }, // the comet, far
    { offset: -2, suffix: '-b30' }, // the comet, near
    { offset: -1, suffix: '-b50' }, // the impact flash
    { offset: 0, suffix: '-b72' },  // the fresh raw crater
    { offset: 1, suffix: '' },      // the settled crater, ever after
  ],
};

/** Build a regular model's dated stages from its build window, using the same
 * 0.45 / 0.75 fraction thresholds the globe gate bucketed on before this table —
 * so giza/stonehenge/amphitheatre behave exactly as they did. */
export function buildStages(builtYear: number, buildYears: number): DatedStage[] {
  const start = builtYear - buildYears;
  return [
    { from: start, suffix: '-b30' },
    { from: start + buildYears * 0.45, suffix: '-b60' },
    { from: start + buildYears * 0.75, suffix: '-b90' },
    { from: builtYear, suffix: '' },
  ];
}

/**
 * The stage suffix in force for `curYear`, and the year the model first appears
 * (its earliest phase). Absolute table wins; then the relative table; otherwise
 * no phases — the model simply appears at builtYear as its base glb.
 */
export function stageFor(
  model: string,
  builtYear: number,
  curYear: number,
): { suffix: string; bornYear: number } {
  const abs = STAGE_TABLE[model];
  if (abs && abs.length) {
    let suffix = abs[0].suffix;
    for (const st of abs) if (curYear >= st.from) suffix = st.suffix;
    return { suffix, bornYear: abs[0].from };
  }
  const rel = REL_STAGE_TABLE[model];
  if (rel && rel.length) {
    let suffix = rel[0].suffix;
    for (const st of rel) if (curYear >= builtYear + st.offset) suffix = st.suffix;
    return { suffix, bornYear: builtYear + rel[0].offset };
  }
  return { suffix: '', bornYear: builtYear };
}
