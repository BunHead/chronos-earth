/**
 * skin.ts — the ship's colours.
 *
 * Chronos Earth wears one of four visual identities, chosen in ⋯ → Settings and
 * remembered on the device. A skin is nothing but a block of CSS custom
 * properties (see the `:root[data-skin=…]` rules in styles.css); this module
 * only decides WHICH block is active and makes the choice stick.
 *
 * WHY THIS EXISTS. The first real curator feedback (Web Curios, 30 Jul 2026)
 * was that a dozen AI-built sites land in his inbox daily and "blur into one".
 * He was right about ours: the chrome was the generic spec. The globe was
 * always distinctive — so the fix is the shell, and the shell is now skinnable.
 *
 * THE SKIN CHANGES THE CHROME ONLY. It never touches the globe, and it never
 * repaints a fact: the era gradient, war red, peace yellow and the category
 * marker colours all carry meaning and stay put across every skin.
 *
 * Kept free of React so it can run before the first paint (see index.html) and
 * be unit-tested (skin.test.ts).
 */

export const SKINS = [
  {
    id: 'chart',
    name: 'The Chart Room',
    blurb: "Admiralty ink and brass, by lamplight — the ship's own colours.",
  },
  {
    id: 'atlas',
    name: 'The Atlas Plate',
    blurb: 'A 19th-century engraved atlas page. Paper and ink; the light one.',
  },
  {
    id: 'observatory',
    name: 'The Observatory',
    blurb: 'A violet night and instrument gold; the astronomy is the identity.',
  },
  {
    id: 'stratum',
    name: 'The Stratum',
    blurb: 'Deep time as geology — sediment, basalt and ochre. Every corner sharp.',
  },
] as const;

export type SkinId = (typeof SKINS)[number]['id'];

/** The ship's face. The Captain's choice, 2026-07-30: the Stratum — deep time
 *  as geology, and every corner sharp. */
export const DEFAULT_SKIN: SkinId = 'stratum';

const KEY = 'ce_skin';

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && SKINS.some((s) => s.id === v);
}

/** The saved choice, or the default. Never throws — private mode blocks storage. */
export function loadSkin(): SkinId {
  try {
    const raw = localStorage.getItem(KEY);
    return isSkinId(raw) ? raw : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function saveSkin(id: SkinId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked — the choice just won't survive the visit */
  }
}

/**
 * Paint the choice onto the document. Sets `data-skin` for the CSS to hook, and
 * `color-scheme` so the browser's own furniture — scrollbars, form controls,
 * the space around the page — matches. Without that second line the light
 * Atlas skin ships with black scrollbars, which looks broken rather than
 * designed.
 */
export function applySkin(id: SkinId, doc: Document = document): void {
  doc.documentElement.setAttribute('data-skin', id);
  doc.documentElement.style.colorScheme = id === 'atlas' ? 'light' : 'dark';
}
