/** Stonehenge's whole-site model is a representation, and says so. */
const STONEHENGE_NOTE =
  '3D Stonehenge: a representation based on best known evidence (English Heritage; Cleal et al. 1995; ' +
  'Parker Pearson 2012). Through time: c. 3000 BCE ditch, bank and Aubrey holes · c. 2900 BCE bluestones ' +
  'in the Aubrey holes · c. 2500 BCE sarsen circle, lintels and trilithons · c. 2300 BCE the Avenue · ' +
  'c. 1900 BCE bluestone horseshoe and nearby round barrows · today, the stones that still stand. ' +
  'Stone sizes are typical, not individually surveyed.';

export function stonehengeNote(monument: { model: string; title: string } | null | undefined): string | null {
  if (!monument) return null;
  return /^stonehenge/.test(monument.model) || /stonehenge/i.test(monument.title) ? STONEHENGE_NOTE : null;
}
