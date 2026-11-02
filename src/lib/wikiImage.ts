import type { PanelContent } from './types';

/** What the side panel needs from a Wikipedia REST summary. */
export interface WikiSummary {
  extract?: string;
  thumb?: string;
}

const WIKI_ARTICLE = /^https?:\/\/en\.wikipedia\.org\/wiki\/([^?#]+)/i;

/** "https://en.wikipedia.org/wiki/Argentinosaurus" -> "Argentinosaurus" (null if not an English Wikipedia article). */
export function wikiTitleFromUrl(url: string): string | null {
  const m = WIKI_ARTICLE.exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

/**
 * The Wikipedia article whose lead picture the panel should show: the panel's
 * own wikiTitle, else the first English-Wikipedia link it carries. Panels that
 * already show a real picture, or have no Wikipedia link, get null.
 */
export function wikiImageTitleFor(content: Pick<PanelContent, 'wikiTitle' | 'links' | 'realImage'>): string | null {
  if (content.realImage) return null;
  if (content.wikiTitle) return content.wikiTitle;
  for (const l of content.links ?? []) {
    const t = wikiTitleFromUrl(l.url);
    if (t) return t;
  }
  return null;
}

/** Pull the text + lead picture out of a REST summary response. */
export function parseWikiSummary(j: unknown): WikiSummary {
  const o = (j ?? {}) as { extract?: unknown; thumbnail?: { source?: unknown } };
  return {
    extract: typeof o.extract === 'string' ? o.extract : undefined,
    thumb: typeof o.thumbnail?.source === 'string' && o.thumbnail.source.startsWith('https://') ? o.thumbnail.source : undefined,
  };
}

export function wikiSummaryUrl(title: string): string {
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function wikiPageUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

const cache = new Map<string, Promise<WikiSummary>>();

/** Fetch (and remember) a title's summary. Failures reject and are NOT cached, so a retry works once back online. */
export function fetchWikiSummary(title: string, fetchFn: typeof fetch = fetch): Promise<WikiSummary> {
  const key = title.replace(/ /g, '_');
  const hit = cache.get(key);
  if (hit) return hit;
  const p = fetchFn(wikiSummaryUrl(title))
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(parseWikiSummary);
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/** For tests. */
export function clearWikiSummaryCache(): void {
  cache.clear();
}
