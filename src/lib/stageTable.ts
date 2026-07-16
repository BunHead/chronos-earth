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
export const REL_STAGE_TABLE: Record<string, RelStage[]> = {
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
