/**
 * Shared data types for Chronos Earth content (sites, and later battles/eras).
 * These mirror the JSON files in /public/data so TypeScript can check our usage.
 */

export interface ExternalLink {
  label: string;
  url: string;
}

/** A contested / alternative interpretation, kept clearly separate from consensus. */
export interface AlternativeView {
  proponent: string;
  claim: string;
  /** The mainstream reality-check shown alongside the claim. */
  note: string;
  links: ExternalLink[];
}

export type SiteCategory = 'monument' | 'settlement' | 'precursor-hypothesis';

export interface AncientSite {
  id: string;
  name: string;
  category: SiteCategory;
  lat: number;
  lon: number;
  /** Signed calendar year; negative = BCE. The marker appears at/after this date. */
  builtYear: number;
  builtYearLabel: string;
  /** Optional: the marker DISAPPEARS after this year — for one-off events
   * (impacts, deluges) whose fall-out eventually stops being noticeable,
   * unlike monuments that stand forever. */
  fadeYear?: number;
  consensusSummary: string;
  significance: string;
  keyFacts: string[];
  links: ExternalLink[];
  alternative?: AlternativeView;
  /** Optional 3D model type for the monument viewer (e.g. "stonehenge"). */
  model?: string;
}

/* ------------------------------------------------------------------ *
 * Battles
 * ------------------------------------------------------------------ */

/** A commanding general/leader on one side of a battle. */
export interface BattleCommander {
  /** Display name, e.g. "Duke of Wellington". */
  name: string;
  /** Which belligerent they led: 1 = side1, 2 = side2. */
  side: 1 | 2;
  /** English Wikipedia article title — used for the portrait image + link. */
  wiki: string;
  /**
   * Skip the portrait download and always show an initials avatar — for
   * commanders whose `wiki` link points at a related article (e.g. the battle
   * itself) whose lead image is not actually them.
   */
  noPortrait?: boolean;
}

export interface Battle {
  id: string;
  name: string;
  /** Signed calendar year; negative = BCE. */
  year: number;
  dateLabel: string;
  lat: number;
  lon: number;
  belligerents: { side1: string; side2: string };
  victor: string;
  outcome: string;
  significance: string;
  casualties: string;
  /** The hour history records the fighting opening (curated where known —
   * D-Day at dawn, El Alamein's night barrage). Unset = seeded sky. */
  timeOfDay?: 'dawn' | 'day' | 'dusk' | 'night';
  links: ExternalLink[];
  commanders?: BattleCommander[];
  /** True if this battle has a phase-by-phase animated battle view (Phase 5/6). */
  hasBattleView?: boolean;
}

/** A historical map overlay for a battle view (downloaded from Wikimedia). */
export interface BattleMapInfo {
  /** URL of the bundled map image. */
  url: string;
  /** Short credit line, e.g. "Wikimedia Commons · Public domain". */
  credit: string;
  /** Link to the original file page for full attribution. */
  page: string;
}

/* ------------------------------------------------------------------ *
 * Phase-by-phase battle views (the animated 2D battle maps)
 * ------------------------------------------------------------------ */

export interface BattleSide {
  name: string;
  color: string;
}

/** A unit/formation. `pos` holds its [x,y] location in EACH phase (0..100, 0..70). */
export interface BattleUnit {
  id: string;
  side: 'a' | 'b';
  label: string;
  pos: Array<[number, number]>;
  /** Relative size of the block (default 1). */
  size?: number;
  shape?: 'block' | 'ship' | 'cavalry' | 'vehicle' | 'plane';
}

export interface BattleArrow {
  from: [number, number];
  to: [number, number];
  side?: 'a' | 'b';
}

export interface BattlePhase {
  name: string;
  narration: string;
  arrows?: BattleArrow[];
}

export interface BattleTerrain {
  type: 'hill' | 'ridge' | 'river' | 'forest' | 'town' | 'sea' | 'road';
  points?: Array<[number, number]>;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  label?: string;
}

export interface BattleView {
  id: string;
  title: string;
  subtitle?: string;
  sides: { a: BattleSide; b: BattleSide };
  terrain?: BattleTerrain[];
  phases: BattlePhase[];
  units: BattleUnit[];
  /** Flagship battles also offer a full 3D (Three.js) scene. */
  flagship?: boolean;
  /** The beaten side, when the record names one — its ranks thin faster. */
  loser?: 'a' | 'b';
  /** How bloody the day was (from the casualties record, ~0.8–1.35). Scales
   * how fast ranks thin; 1 when unknown. */
  severity?: number;
}

/* ------------------------------------------------------------------ *
 * Story tours — scripted journeys through time and space.
 * ------------------------------------------------------------------ */

export interface TourStep {
  /** Where the camera flies. */
  lon: number;
  lat: number;
  altitude?: number;
  /** WHEN: either a signed calendar year (negative = BCE)... */
  year?: number;
  /** ...or a deep-time moment in millions of years before present. */
  ma?: number;
  title: string;
  /** Spoken/read narration for this stop. */
  text: string;
  /** Optionally open this battle's info panel at this stop. */
  battleId?: string;
}

export interface Tour {
  id: string;
  emoji: string;
  title: string;
  description: string;
  steps: TourStep[];
}

/* ------------------------------------------------------------------ *
 * Imported history events (bulk Wikidata import).
 * One lightweight shape for the thousands of dated, located events that
 * populate the illustrated timeline + globe — battles, monuments, city
 * foundings, disasters. Fetched by scripts/fetch-wikidata-events.mjs.
 * ------------------------------------------------------------------ */

export type EventCategory =
  | 'monument'
  | 'city'
  | 'battle'
  | 'disaster'
  | 'invention'
  | 'discovery'
  | 'person'
  | 'event';

export interface TimelineEvent {
  id: string;
  name: string;
  /** Signed calendar year; negative = BCE. When the event happened / began. */
  startYear: number;
  /** If present, the event is a SPAN (e.g. a monument's construction period). */
  endYear?: number;
  lat: number;
  lon: number;
  category: EventCategory;
  /** Battles: belligerent names auto-enriched from Wikidata (P710). */
  sides?: string[];
  /** Battles: the war this battle belongs to (P361). */
  partOf?: string;
  /** Battles: recorded death toll (P1120). */
  deaths?: number;
  /** Wikidata Q-id, e.g. "Q243". */
  wikidataId?: string;
  /** English Wikipedia article title — for links + image/summary fetching. */
  wikiTitle?: string;
  /** Cached thumbnail filename under data/events/img/ (added by a later pass). */
  image?: string;
  /** Notability proxy (Wikipedia sitelink count) — used to declutter by zoom. */
  notability?: number;
  /** Spatial grid key stamped by the core index (scripts/build-core-index.mjs).
   * Present = skeleton-loaded; names the detail/<cell>.json file with the rest. */
  cell?: string;
}

/** A prehistoric creature (public/data/fauna.json). Lives on the timeline while
 * inside its [toMa, fromMa] range; `track` rides the drifting continents. */
export interface Fauna {
  id: string;
  name: string;
  emoji: string;
  lon: number;
  lat: number;
  /** Older bound, in millions of years before present. */
  fromMa: number;
  /** Younger bound, in millions of years before present. */
  toMa: number;
  region: string;
  blurb: string;
  wiki: string;
  track: Array<{ ma: number; lon: number; lat: number }>;
}

/* ------------------------------------------------------------------ *
 * Generic info-panel content. Sites, polities and battles all get
 * converted into this shape so a single panel component can render them.
 * ------------------------------------------------------------------ */

export interface PanelSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

/** A clickable row in a panel — e.g. a nearby event in the place+time dossier. */
export interface RelatedItem {
  label: string;
  sublabel?: string;
  onClick: () => void;
}

export interface PanelContent {
  /** Small label above the title, e.g. "Ancient monument" or "Battle". */
  kicker: string;
  title: string;
  date?: string;
  summary?: string;
  /** If present, InfoPanel live-fetches the Wikipedia summary + thumbnail for this title. */
  wikiTitle?: string;
  /** The ruling polity's flag banner (drawn from the flag registry, time-aware).
   * Click it in the panel to fetch that flag's own story. */
  flag?: { name: string; year: number };
  sections?: PanelSection[];
  links?: ExternalLink[];
  alternative?: AlternativeView;
  /** If present, the panel shows a "Fly here" button. */
  fly?: { lon: number; lat: number; altitude: number };
  /** Battles can offer a "Zoom to battle" view. */
  battleId?: string;
  /** Battle commanders, shown as a portrait face-off. */
  commanders?: BattleCommander[];
  /** Belligerent names for the two sides of the face-off. */
  sideNames?: [string, string];
  /** Monuments can offer a 3D model view (lat/lon pull real ground imagery). */
  monument3d?: { model: string; title: string; lat: number; lon: number };
  /** Clickable "nearby in this era" rows for the on-the-fly place+time dossier. */
  related?: RelatedItem[];
  /** Skeleton-loaded events: the source event, so InfoPanel can lazy-fetch its
   * detail (lib/detail.ts) and rebuild the panel once the flesh arrives. */
  hydrate?: TimelineEvent;
}
