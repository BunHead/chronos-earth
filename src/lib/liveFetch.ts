/**
 * liveFetch.ts — on-demand history straight from Wikidata.
 *
 * When the local dossier for a clicked place is thin, the app asks Wikidata
 * RIGHT THEN for notable, dated, located things near that spot — so a place
 * whose history our bulk imports missed still reveals itself on click ("as
 * and when it's needed"). Polite by design: one small query per area, a hard
 * 9-second abort, an in-session per-area cache, and silent failure when
 * offline or rate-limited (the local dossier already showed — live rows are
 * a bonus, never a blocker).
 *
 * Results are shaped as TimelineEvents (id "live-…", category 'event') so
 * everything downstream — dossier rows, the info panel's live Wikipedia
 * summary and photo — just works.
 */
import type { EventCategory, TimelineEvent } from './types';

/** Wikidata instance-of (P31) → our marker category, so live finds wear the
 * right badge: people 👤, battles ⚔️, towns 🏙️, buildings 🏛️. */
const TYPE_CATEGORY: Record<string, EventCategory> = {
  Q5: 'person',
  Q178561: 'battle', // battle
  Q188055: 'battle', // siege
  Q515: 'city',
  Q3957: 'city', // town
  Q532: 'city', // village
  Q486972: 'city', // human settlement
  Q16970: 'monument', // church
  Q23413: 'monument', // castle
  Q44613: 'monument', // monastery
  Q33506: 'monument', // museum
  Q839954: 'monument', // archaeological site
  Q12518: 'monument', // tower
  Q39715: 'monument', // lighthouse
  Q4989906: 'monument', // monument
  Q3947: 'monument', // house/hall
  Q574848: 'monument', // country house
  Q751876: 'monument', // château
  Q4830453: 'invention', // business/company
  Q327333: 'invention', // factory... (agency fallback)
  Q7397: 'invention', // software
  Q8065: 'disaster', // natural disaster
  Q7944: 'disaster', // earthquake
};

const ENDPOINT = 'https://query.wikidata.org/sparql';
/** Half-size of the search box, in degrees (~140 km at the equator). */
const BOX_DEG = 1.3;

/** In-session cache, keyed by the rounded area — repeat clicks don't re-ask. */
const cache = new Map<string, Promise<TimelineEvent[]>>();

export function fetchNearbyHistory(lat: number, lon: number): Promise<TimelineEvent[]> {
  const key = `${Math.round(lat * 2) / 2},${Math.round(lon * 2) / 2}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = run(lat, lon).catch(() => {
    cache.delete(key); // a later click may retry (e.g. back online)
    return [] as TimelineEvent[];
  });
  cache.set(key, p);
  return p;
}

async function run(lat: number, lon: number): Promise<TimelineEvent[]> {
  const west = lon - BOX_DEG;
  const east = lon + BOX_DEG;
  const south = Math.max(-89, lat - BOX_DEG);
  const north = Math.min(89, lat + BOX_DEG);
  const sparql = `SELECT ?item ?itemLabel ?coord ?date ?sitelinks ?type WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${west} ${south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${east} ${north})"^^geo:wktLiteral .
  }
  { ?item wdt:P571 ?date . } UNION { ?item wdt:P585 ?date . }
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 8)
  OPTIONAL { ?item wdt:P31 ?type . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT 40`;

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/sparql-results+json' },
    });
    if (!res.ok) throw new Error(`WDQS ${res.status}`);
    const json = (await res.json()) as {
      results: { bindings: Array<Record<string, { value: string } | undefined>> };
    };
    // One item can arrive as several rows (one per instance-of type); the
    // first row creates the entry, later rows may refine its category.
    const byId = new Map<string, TimelineEvent>();
    for (const b of json.results.bindings) {
      const qid = b.item?.value.split('/').pop();
      if (!qid) continue;
      const typeQ = b.type?.value.split('/').pop();
      const cat = typeQ ? TYPE_CATEGORY[typeQ] : undefined;
      const existing = byId.get(qid);
      if (existing) {
        if (cat && existing.category === 'event') existing.category = cat;
        continue;
      }
      if (byId.size >= 14) continue;
      const label = b.itemLabel?.value ?? '';
      if (!label || /^Q\d+$/.test(label)) continue; // no English label — skip
      const coord = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? '');
      if (!coord) continue;
      const iso = /^([+-]?)0*(\d+)/.exec(b.date?.value ?? '');
      if (!iso) continue;
      const year = (iso[1] === '-' ? -1 : 1) * parseInt(iso[2], 10);
      if (year > new Date().getFullYear()) continue;
      byId.set(qid, {
        id: 'live-' + qid,
        name: label,
        startYear: year,
        lat: +coord[2],
        lon: +coord[1],
        category: cat ?? 'event',
        wikidataId: qid,
        wikiTitle: label,
        notability: +(b.sitelinks?.value ?? 0),
      });
    }
    return [...byId.values()];
  } finally {
    window.clearTimeout(timer);
  }
}
