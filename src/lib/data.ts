/**
 * data.ts — loads JSON content from /public/data at runtime.
 *
 * Using fetch (rather than importing the JSON directly) keeps the historical
 * content fully separate from the code and lets us lazy-load larger datasets in
 * later phases without rebuilding the app.
 */
import type { AncientSite, Battle, BattleMapInfo, BattleView, Fauna, TimelineEvent, Tour } from './types';

/** Resolve a path inside /public/data, respecting the app's base URL. */
function dataUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/${file}`;
}

export async function loadAncientSites(): Promise<AncientSite[]> {
  const res = await fetch(dataUrl('ancient-sites.json'));
  if (!res.ok) {
    throw new Error(`Failed to load ancient-sites.json (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { sites: AncientSite[] };
  return json.sites ?? [];
}

export async function loadBattles(): Promise<Battle[]> {
  const res = await fetch(dataUrl('battles.json'));
  if (!res.ok) {
    throw new Error(`Failed to load battles.json (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { battles: Battle[] };
  return json.battles ?? [];
}

export async function loadBattleViews(): Promise<Record<string, BattleView>> {
  const res = await fetch(dataUrl('battle-views.json'));
  if (!res.ok) {
    throw new Error(`Failed to load battle-views.json (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { battleViews: Record<string, BattleView> };
  return json.battleViews ?? {};
}

export async function loadTours(): Promise<Tour[]> {
  const res = await fetch(dataUrl('tours.json'));
  if (!res.ok) {
    throw new Error(`Failed to load tours.json (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { tours: Tour[] };
  return json.tours ?? [];
}

/**
 * Bulk history events imported from Wikidata (scripts/fetch-wikidata-events.mjs).
 * A missing file just means the import hasn't been run yet — the app still works.
 */
export async function loadEvents(): Promise<TimelineEvent[]> {
  try {
    const res = await fetch(dataUrl('imported/events.json'));
    if (!res.ok) return [];
    const json = (await res.json()) as { events: TimelineEvent[] };
    return json.events ?? [];
  } catch {
    return [];
  }
}

/** Prehistoric creatures (public/data/fauna.json) — also fed to the timeline mural. */
export async function loadFauna(): Promise<Fauna[]> {
  try {
    const res = await fetch(dataUrl('fauna.json'));
    if (!res.ok) return [];
    const json = (await res.json()) as { fauna: Fauna[] };
    return json.fauna ?? [];
  } catch {
    return [];
  }
}

/**
 * Historical map overlays for battle views (downloaded by
 * scripts/fetch-battle-maps.mjs). Missing manifest just means no maps.
 */
export async function loadBattleMaps(): Promise<Record<string, BattleMapInfo>> {
  try {
    const res = await fetch(dataUrl('battlemaps/manifest.json'));
    if (!res.ok) return {};
    const json = (await res.json()) as {
      maps: Record<string, { file: string; credit: string; page: string }>;
    };
    const out: Record<string, BattleMapInfo> = {};
    for (const [id, m] of Object.entries(json.maps ?? {})) {
      out[id] = { url: dataUrl(`battlemaps/${m.file}`), credit: m.credit, page: m.page };
    }
    return out;
  } catch {
    return {};
  }
}
