/** Buckingham Palace's through-time model is a representation, and says so. */
export const BUCKINGHAM_NOTE =
  '3D Buckingham Palace: a representation based on best known evidence (Royal Collection Trust; ' +
  'Survey of London; Historic England list entry 1239087). Through time: 1703 Buckingham House, ' +
  'built for the Duke of Buckingham \u00b7 1761 bought by George III \u00b7 1826\u201330 Nash rebuilds it as a ' +
  'palace round a court open to the east, Marble Arch at its mouth; Blore finishes it and Victoria moves in, 1837 \u00b7 ' +
  '1847\u201350 Blore\u2019s East Front closes the quadrangle (Marble Arch moved to Hyde Park, 1851) \u00b7 1911 the ' +
  'Victoria Memorial and Aston Webb\u2019s railings and gates \u00b7 1913 Webb refaces the East Front in Portland stone. ' +
  'Today\u2019s plan, the memorial and the railings are traced from OpenStreetMap (\u00a9 OpenStreetMap contributors); ' +
  'Buckingham House and the service ranges are drawn at typical sizes.';

export function buckinghamNote(monument: { model: string; title: string } | null | undefined): string | null {
  if (!monument) return null;
  return /^buckingham/.test(monument.model) || /buckingham (palace|house)/i.test(monument.title) ? BUCKINGHAM_NOTE : null;
}
