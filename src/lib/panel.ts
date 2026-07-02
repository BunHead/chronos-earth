/**
 * panel.ts — convert domain objects (sites, polities, battles) into the generic
 * PanelContent shape the InfoPanel renders.
 */
import type { AncientSite, Battle, EventCategory, Fauna, PanelContent, PanelSection, TimelineEvent } from './types';

const SITE_KICKER: Record<AncientSite['category'], string> = {
  monument: 'Ancient monument',
  settlement: 'Early settlement',
  'precursor-hypothesis': 'Precursor-civilization hypothesis',
};

/** Map a site to a 3D model type for the monument viewer. */
const MODEL_BY_ID: Record<string, string> = {
  'gobekli-tepe': 'tpillars',
  'karahan-tepe': 'tpillars',
  catalhoyuk: 'settlement',
  'nabta-playa': 'circle',
  stonehenge: 'stonehenge',
  'giza-pyramids': 'pyramid',
  'great-sphinx': 'sphinx',
  pumapunku: 'megalith',
  'gunung-padang': 'megalith',
  'younger-dryas-impact': 'impact',
};

export function resolveMonumentModel(site: AncientSite): string {
  if (site.model) return site.model;
  if (MODEL_BY_ID[site.id]) return MODEL_BY_ID[site.id];
  if (site.category === 'settlement') return 'settlement';
  if (site.category === 'precursor-hypothesis') return 'impact';
  return 'megalith';
}

export function siteToPanel(site: AncientSite): PanelContent {
  return {
    kicker: SITE_KICKER[site.category],
    title: site.name,
    date: site.builtYearLabel,
    summary: site.consensusSummary,
    sections: [
      { heading: 'Why it matters', body: site.significance },
      { heading: 'Key facts', bullets: site.keyFacts },
    ],
    links: site.links,
    alternative: site.alternative,
    fly: {
      lon: site.lon,
      lat: site.lat,
      altitude: site.category === 'precursor-hypothesis' ? 3_000_000 : 1_200_000,
    },
    monument3d: { model: resolveMonumentModel(site), title: site.name, lat: site.lat, lon: site.lon },
  };
}

/** Format a signed year as a readable label, e.g. -323 -> "323 BCE". */
function yearLabel(year: number): string {
  return year < 0 ? `${-year} BCE` : `${year} CE`;
}

/** The camera altitude (m) used when flying to a battle on the globe. */
export const BATTLE_FLY_ALTITUDE = 350_000;

export function battleToPanel(battle: Battle): PanelContent {
  return {
    kicker: 'Battle',
    title: battle.name,
    date: battle.dateLabel,
    summary: battle.significance,
    commanders: battle.commanders,
    sideNames: [battle.belligerents.side1, battle.belligerents.side2],
    sections: [
      { heading: 'Who fought', body: `${battle.belligerents.side1}  vs  ${battle.belligerents.side2}` },
      { heading: 'Outcome', body: `${battle.victor} — ${battle.outcome}` },
      { heading: 'Casualties (estimated)', body: battle.casualties },
    ],
    links: battle.links,
    fly: { lon: battle.lon, lat: battle.lat, altitude: BATTLE_FLY_ALTITUDE },
    battleId: battle.hasBattleView ? battle.id : undefined,
  };
}

const EVENT_KICKER: Record<EventCategory, string> = {
  monument: 'Monument',
  city: 'City founding',
  battle: 'Battle',
  disaster: 'Disaster',
  invention: 'Invention',
  discovery: 'Discovery',
  person: 'Person',
  event: 'Event',
};

/** Convert a bulk-imported Wikidata event into panel content. */
export function eventToPanel(e: TimelineEvent): PanelContent {
  const wiki = e.wikiTitle
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(e.wikiTitle.replace(/ /g, '_'))}`
    : `https://www.wikidata.org/wiki/${e.wikidataId}`;
  const date =
    e.endYear !== undefined ? `${yearLabel(e.startYear)} – ${yearLabel(e.endYear)}` : yearLabel(e.startYear);
  // Battles enriched from Wikidata get the full who-fought treatment.
  const sections: PanelSection[] = [];
  if (e.sides && e.sides.length > 0)
    sections.push({
      heading: 'Who fought',
      body: e.sides.length === 2 ? e.sides.join('  vs  ') : e.sides.join(' · '),
    });
  if (e.partOf) sections.push({ heading: 'Part of', body: e.partOf });
  if (e.deaths) sections.push({ heading: 'Deaths (recorded)', body: e.deaths.toLocaleString('en-GB') });
  return {
    kicker: EVENT_KICKER[e.category],
    title: e.name,
    date,
    // With a Wikipedia title we fetch the real summary + photo live on click;
    // otherwise fall back to a one-line note.
    ...(e.wikiTitle ? { wikiTitle: e.wikiTitle } : { summary: `${EVENT_KICKER[e.category]} · ${date}.` }),
    ...(sections.length > 0 ? { sections } : {}),
    links: [{ label: e.wikiTitle ? `Read about ${e.name} on Wikipedia` : 'View on Wikidata', url: wiki }],
    fly: { lon: e.lon, lat: e.lat, altitude: 600_000 },
  };
}

/** Convert a prehistoric creature into panel content (live Wikipedia photo + text). */
export function faunaToPanel(f: Fauna): PanelContent {
  const wiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(f.wiki.replace(/ /g, '_'))}`;
  return {
    kicker: 'Prehistoric life',
    title: f.name,
    date: `${f.fromMa}–${f.toMa} million years ago · ${f.region}`,
    wikiTitle: f.wiki,
    summary: f.blurb,
    links: [{ label: `Read about ${f.name} on Wikipedia`, url: wiki }],
    fly: { lon: f.lon, lat: f.lat, altitude: 6_000_000 },
  };
}

/**
 * Build panel content for a clicked political entity. The dataset only gives us
 * a name, so we add a plain-language note and a Wikipedia search link rather
 * than inventing facts.
 */
export function polityToPanel(
  name: string,
  snapshotYear: number,
  lon: number,
  lat: number,
): PanelContent {
  const wiki = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}`;
  return {
    kicker: `Political entity · ${yearLabel(snapshotYear)} map`,
    title: name,
    date: `Borders shown for ${yearLabel(snapshotYear)}`,
    summary:
      `This is the territory of ${name} as mapped around ${yearLabel(snapshotYear)}. ` +
      `Drag the timeline to watch how its borders change as empires rise and fall.`,
    links: [{ label: `Search Wikipedia for ${name}`, url: wiki }],
    fly: { lon, lat, altitude: 3_500_000 },
  };
}

function fmtCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}

/**
 * Assemble an on-the-fly "what's here, at this time" dossier purely from local
 * data — the ruling polity (from the borders layer) plus the most notable
 * events nearby in the same era, each clickable to dive in. No network calls.
 */
export function placeDossierPanel(
  lat: number,
  lon: number,
  year: number,
  polityName: string | undefined,
  nearby: TimelineEvent[],
  onOpenEvent: (e: TimelineEvent) => void,
): PanelContent {
  const when = yearLabel(year);
  const ruler = polityName
    ? `Around ${when}, this spot lay within ${polityName}.`
    : `We have no border data for this spot in ${when}.`;
  return {
    kicker: `On the map · ${when}`,
    title: polityName ?? 'This place',
    date: fmtCoord(lat, lon),
    summary:
      nearby.length > 0
        ? `${ruler} ${polityName ? `${polityName}'s` : 'Nearby'} history nearest to then:`
        : polityName
          ? `${ruler} We haven't imported ${polityName}'s own events yet.`
          : ruler,
    related: nearby.map((e) => ({
      label: e.name,
      sublabel: `${EVENT_KICKER[e.category]}${e.id.startsWith('live-') ? ' · fetched live' : ''} · ${yearLabel(e.startYear)}`,
      onClick: () => onOpenEvent(e),
    })),
    fly: { lon, lat, altitude: 1_500_000 },
  };
}
