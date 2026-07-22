/**
 * panel.ts — convert domain objects (sites, polities, battles) into the generic
 * PanelContent shape the InfoPanel renders.
 */
import type { AncientSite, Battle, EventCategory, Fauna, PanelContent, PanelSection, TimelineEvent } from './types';
import { isBattleRejected, isModelRejected } from './review';

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

/**
 * Monuments a generic archetype would MISREPRESENT — we'd rather show no 3D
 * (the real photo carries it) than a misleading model. MIRRORS NO_3D_NAMES in
 * scripts/monument-archetype.mjs; the parity test (audit.test.ts) enforces it.
 */
const NO_3D_NAMES = new Set([
  'elmina castle',
  'riber castle',
  'brimstone hill fortress national park',
  'forth bridge',
  'palace of versailles',
  'drottningholm palace',
  'blenheim palace',
  'stoclet palace',
  'château de chambord',
  'alhambra',
  'potala palace',
  'agra fort',
  'himeji castle',
  'fort de loncin',
  'mosque-cathedral of cordoba',
  "saint basil's cathedral",
  'saint sophia cathedral',
  'church of the nativity',
  'sagrada família',
  'basilica and expiatory church of the holy family',
  'rock churches of lalibela',
  'church of saint george',
  'church of our lady mary of zion',
  'church of cristo obrero y nuestra señora de lourdes',
  'angkor wat',
  // (Colosseum un-suppressed 2026-07-10: the amphitheatre model now has real
  // see-through arches and builds its own broken-ring ruin form.)
  // Overnight cheap-AI (Haiku) verify pass, 2026-07-07 — wrong-family cases.
  'aachen cathedral',
  'speyer cathedral',
  'cusco cathedral',
  'newstead abbey',
  'castel del monte',
  'neuschwanstein castle',
  'cahokia',
  'borobudur',
  'borobudur temple',
  // Judgment calls greenlit 2026-07-08.
  'malbork castle',
  'tournai cathedral',
  'konark sun temple',
  'peveril castle',
]);

/** Pick a 3D model for an imported monument event from its name, so every
 * monument on the map is zoomable into SOME reconstruction. */
export function monumentModelForName(name: string): string | null {
  const n = name.toLowerCase();
  if (NO_3D_NAMES.has(n.trim())) return null; // suppressed — would misrepresent it
  if (/teotihuac|tikal|chich[eé]n|taj[ií]n|monte alb|borobudur|angkor|ziggurat|uxmal|cop[aá]n|caracol|cahokia|templo mayor|step pyramid/.test(n))
    return 'stepped-pyramid';
  if (/sphinx/.test(n)) return 'sphinx'; // before pyramid — "Sphinx of Giza"
  if (/pyramid|giza/.test(n)) return 'pyramid';
  if (/stonehenge/.test(n)) return 'stonehenge';
  if (/henge|stone circle|carnac|avebury/.test(n)) return 'circle';
  if (/aqueduct|pont du gard/.test(n)) return 'aqueduct';
  if (/pagoda/.test(n)) return 'pagoda';
  if (/lighthouse|pharos/.test(n)) return 'lighthouse';
  if (/leaning tower|torre di pisa/.test(n)) return 'leaning-tower';
  if (/colosseum|colise|amphitheatre|amphitheater/.test(n)) return 'amphitheatre';
  // London landmarks — matched BEFORE the generic castle/palace bucket below, so
  // "Buckingham Palace" and "Palace of Westminster" get their own facades.
  if (/london eye|millennium wheel/.test(n)) return 'london-eye';
  if (/buckingham/.test(n)) return 'buckingham';
  if (/palace of westminster|houses of parliament|big ben|elizabeth tower/.test(n)) return 'westminster';
  // More London landmarks — matched before the generic castle/cathedral buckets
  // (so "St Paul's Cathedral" gets the dome, not the twin-tower Gothic model, and
  // "Tower of London" gets the keep, not swept up as a generic "tower"). Placed
  // so "Tower Bridge" can't collide with "Tower of London" or "London Bridge".
  if (/tower bridge/.test(n)) return 'tower-bridge';
  if (/st\.? paul/.test(n)) return 'st-pauls';
  if (/tower of london|white tower/.test(n)) return 'tower-of-london';
  if (/the shard|shard london/.test(n)) return 'shard';
  if (/gherkin|30 st mary axe/.test(n)) return 'gherkin';
  // Sydney Opera House — SYDNEY-specific: the sails are unmistakably Sydney's, so
  // a bare "opera house" (London's neoclassical Royal Opera House, Vienna's, …)
  // must NOT be dressed in them — it gets no 3D, per "prefer none to a wrong one".
  if (/sydney opera/.test(n)) return 'opera-house';
  if (/statue of liberty/.test(n)) return 'liberty';
  // Paris landmarks — the tower is matched EXACTLY (an "Eiffel Tower
  // restaurant" replica must stay 3D-less), and the Louvre is matched before
  // the generic palace bucket claims "Louvre Palace" for the castle model.
  if (/^(the )?(eiffel tower|tour eiffel)$/.test(n)) return 'eiffel';
  if (/arc de triomphe(?! du carrousel)/.test(n)) return 'arc-triomphe';
  if (/palais du louvre|louvre palace|louvre museum|mus[eé]e du louvre|^(the )?louvre$/.test(n)) return 'louvre';
  // Word-boundaried so bridges/parks aren't dragged in: "Forth Bridge" no longer
  // matches "fort", "Brimstone Hill Fortress National Park" no longer matches
  // "fort". Real castles/forts/palaces get the dedicated castle model.
  if (/\b(castle|castel|fort|citadel|palace|palais|alc[aá]zar|ch[aâ]teau|kremlin)\b|alhambra/.test(n))
    return 'castle';
  if (/cathedral|basilica|minster|abbey|church|notre-dame|sagrada|duomo/.test(n)) return 'cathedral';
  if (/parthenon|acropolis|greek temple|temple of (zeus|apollo|artemis|athena|poseidon|hera)/.test(n))
    return 'greek-temple';
  // South & South-East Asian temples — a spired candi/shikhara, not a stone pile.
  if (/prambanan|preah vihear|konark|khajuraho|brihadeeswara|kailasa|virupaksha|candi /.test(n))
    return 'temple-tower';
  // NO generic "temple" bucket: a plain "Temple of X" (Egyptian rock-cut,
  // Roman, unknown) rendered as random standing stones misleads more than it
  // helps — the Captain caught the Temple of Ellesyia wearing exactly that. It
  // shows the real photo instead. (Genuinely megalithic sites reach 'megalith'
  // through their curated id map, not this name rule.)
  // Anything we can't honestly represent gets NO 3D button — a university
  // rendered as a ziggurat helps nobody.
  return null;
}

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
    ...(isModelRejected(resolveMonumentModel(site))
      ? {}
      : { monument3d: { model: resolveMonumentModel(site), title: site.name, lat: site.lat, lon: site.lon, builtYear: site.builtYear } }),
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
    // Every battle opens a battlefield now — hand-crafted where we have one,
    // auto-generated otherwise (see lib/synthBattle.ts) — unless the Captain
    // has Rejected this battle's choreography in the Workshop.
    ...(isBattleRejected(battle.id) ? {} : { battleId: battle.id }),
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
  // A figure the record does not establish the way it establishes a king with
  // a charter says so, right next to the date it is being given — the same
  // doctrine that flags the Atlantis hypothesis rather than burying it.
  if (e.attestation) {
    sections.push({
      heading: e.attestation === 'legendary' ? 'A figure of legend' : 'Traditionally dated',
      body:
        e.dateNote ??
        (e.attestation === 'legendary'
          ? 'Known from story rather than from records made at the time.'
          : 'Known from scripture and later tradition rather than from records made at the time.'),
    });
  }
  return {
    kicker: e.attestation === 'legendary' ? 'Legend' : EVENT_KICKER[e.category],
    title: e.name,
    date,
    // With a Wikipedia title we fetch the real summary + photo live on click;
    // otherwise fall back to a one-line note.
    ...(e.wikiTitle ? { wikiTitle: e.wikiTitle } : { summary: `${EVENT_KICKER[e.category]} · ${date}.` }),
    ...(sections.length > 0 ? { sections } : {}),
    links: [{ label: e.wikiTitle ? `Read about ${e.name} on Wikipedia` : 'View on Wikidata', url: wiki }],
    fly: { lon: e.lon, lat: e.lat, altitude: 600_000 },
    // Skeleton-loaded events carry a grid cell — InfoPanel lazy-fetches the
    // rest (sides, deaths, war…) and rebuilds this content when it lands.
    ...(e.cell ? { hydrate: e } : {}),
    // Monuments we can plausibly reconstruct get a 3D button (stylised by name).
    // Also the generic 'event' bucket — a live-fetched building (e.g. the
    // Leaning Tower) lands there when Wikidata's type-map misses it, but its
    // name still maps to an archetype.
    ...((e.category === 'monument' || e.category === 'event') &&
    monumentModelForName(e.name) &&
    !isModelRejected(monumentModelForName(e.name))
      ? { monument3d: { model: monumentModelForName(e.name)!, title: e.name, lat: e.lat, lon: e.lon, builtYear: e.startYear } }
      : {}),
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
    ...(polityName ? { flag: { name: polityName, year } } : {}),
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
