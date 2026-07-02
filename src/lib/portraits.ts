/**
 * portraits.ts — resolves commander portrait images.
 *
 * scripts/fetch-portraits.mjs downloads a thumbnail for each commander's
 * Wikipedia article into /public/data/portraits/ and writes manifest.json
 * mapping the article title to its image file. We load that manifest once at
 * startup; commanders whose articles had no usable image simply aren't in it
 * (the UI shows an initials avatar instead).
 */

interface PortraitEntry {
  file: string;
  page: string;
}

let portraits: Record<string, PortraitEntry> = {};

function dataUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/${file}`;
}

/** Load the portrait manifest. Call once at app startup; safe to fail. */
export async function initPortraits(): Promise<void> {
  try {
    const res = await fetch(dataUrl('portraits/manifest.json'));
    if (!res.ok) return;
    const json = (await res.json()) as { portraits: Record<string, PortraitEntry> };
    portraits = json.portraits ?? {};
  } catch {
    // No portraits available — the UI falls back to initials avatars.
  }
}

/** The bundled portrait image URL for a Wikipedia title, if we have one. */
export function portraitUrl(wiki: string): string | undefined {
  const entry = portraits[wiki];
  return entry ? dataUrl(`portraits/${entry.file}`) : undefined;
}

/** The Wikipedia article URL for a commander. */
export function wikiPageUrl(wiki: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki.replace(/ /g, '_'))}`;
}

/** "Robert E. Lee" -> "RL" for the fallback avatar. */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-ZÀ-Þ]/.test(w));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[words.length - 1][0];
}
