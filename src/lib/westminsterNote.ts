/** The Palace of Westminster's through-time model is a representation, and says so. */
export const WESTMINSTER_NOTE =
  '3D Palace of Westminster: a representation based on best known evidence (Survey of London; ' +
  'UK Parliament; plans made before and after the 1834 fire). Through time: 1097 William II builds ' +
  'Westminster Hall, the medieval palace grows round it · 1393 Richard II\u2019s hammerbeam roof · ' +
  '1834 the fire: only the Hall, the cloister and the crypt survive · 1840 Barry & Pugin\u2019s new palace ' +
  'rises · 1847 Lords and 1852 Commons open · 1859 Elizabeth Tower (Big Ben) · 1860 Victoria Tower · ' +
  'works finished c. 1870. Medieval buildings other than the Hall are drawn at typical sizes.';

export function westminsterNote(monument: { model: string; title: string } | null | undefined): string | null {
  if (!monument) return null;
  return /^westminster/.test(monument.model) || /palace of westminster|houses of parliament|westminster hall|big ben/i.test(monument.title)
    ? WESTMINSTER_NOTE
    : null;
}
