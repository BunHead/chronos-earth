/**
 * gizaCap.ts — the "maybe" label for Khufu's gold capstone on the globe.
 *
 * The live globe draws a small gold pyramidion on Khufu's finished pyramid
 * (Monument3D buildGizaPart, c. 2566 BCE until the casing was stripped; the
 * 1356 → today ruin has none). No capstone survives, so the panel must say the
 * gold cap is a possibility, not a fact (the Captain, 18 Oct 2026).
 */
export const GIZA_CAP_NOTE =
  'Gold capstone shown is a possibility, not proven: none survives. ' +
  'It is drawn on the finished Great Pyramid (c. 2566 BCE to 1356 CE), larger than life so it can be seen.';

/** The note for a panel's 3D monument, or null when it is not Giza / Khufu. */
export function gizaCapNote(monument: { model: string; title: string } | null | undefined): string | null {
  if (!monument) return null;
  if (monument.model === 'sphinx' || /sphinx/i.test(monument.title)) return null;
  if (/^giza/.test(monument.model) && !/khafre|menkaure|queen/.test(monument.model)) return GIZA_CAP_NOTE;
  if (monument.model === 'pyramid' && /giza|khufu|cheops/i.test(monument.title) && !/khafre|menkaure|queen|G[13]-[abc]/i.test(monument.title)) return GIZA_CAP_NOTE;
  return null;
}
