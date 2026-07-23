/**
 * subLayers.ts — the finer grain inside a layer.
 *
 * "Natural Disasters" is one switch for 517 events that are mostly earthquakes
 * but also volcanoes, tsunamis and floods; "Notable People" mixes documented
 * lives with legends. This module works out which finer KIND an event belongs
 * to, so the Layers panel can offer a sub-list under each layer.
 *
 * TWO DESIGN RULES, both about not lying to the visitor:
 *
 * 1. OPT-OUT, NOT OPT-IN. The filter state is the set of sub-kinds switched
 *    OFF. Anything unrecognised — a disaster type the classifier has never met,
 *    a new category added next year — therefore stays VISIBLE. The opposite
 *    design silently hides real history whenever the data outgrows the UI, and
 *    nobody notices because the marker simply never appears.
 *
 * 2. ONLY WHAT THE DATA REALLY SAYS. Every sub-kind below is derived from a
 *    field the events genuinely carry — the imported category, the attestation
 *    flag, or words in the recorded name. Where the data cannot support a split
 *    (a city being a capital, a person's profession) there is deliberately no
 *    sub-list, rather than a checkbox that quietly does nothing.
 *
 * Pure and framework-free, so it is unit-tested (subLayers.test.ts).
 */
import type { TimelineEvent } from './types';

/** A sub-kind id. Namespaced by layer so two layers can't collide. */
export type SubKind = string;

/**
 * Disasters carry no type field — the harvest gives us a name and a place. The
 * name is what we have, so we read it, in the languages the dataset actually
 * turns up in (Wikidata labels are not always English: "Erdbeben" is German for
 * earthquake and appeared in the real data).
 *
 * Order matters: the first match wins, so the specific patterns come before the
 * general ones — a "tsunami earthquake" is filed under tsunami.
 */
const DISASTER_PATTERNS: Array<[SubKind, RegExp]> = [
  // "Tunguska event" and "Chicxulub crater" name neither an impact nor a
  // meteor, so the obvious words alone missed the two most famous impacts there
  // are. Crater is safe here: this branch only ever sees disasters, so the
  // Battle of the Crater (a battle) and Lichfield Crater (a monument) cannot
  // reach it.
  ['disaster:impact', /impact|meteor|meteorite|comet|airburst|bolide|asteroid|crater|tunguska/i],
  ['disaster:eruption', /erupt|volcan|vulkan|krakatoa|vesuvius|tambora|pinatubo|toba|laki|pel[ée]e/i],
  ['disaster:tsunami', /tsunami|tidal wave/i],
  ['disaster:landslide', /landslide|mudslide|mudflow|avalanche|rockfall|lahar/i],
  ['disaster:flood', /flood|deluge|inundat|hochwasser/i],
  ['disaster:storm', /storm|hurricane|typhoon|cyclone|tornado|blizzard/i],
  // Not just "great fire": the Great CHICAGO Fire puts the city in the middle,
  // which the literal phrase missed entirely.
  ['disaster:fire', /wildfire|bushfire|firestorm|conflagration|great .{0,18}fire|fire of /i],
  ['disaster:plague', /plague|pandemic|epidemic|cholera|influenza|smallpox|black death/i],
  ['disaster:famine', /famine|starvation|drought|d[üu]rre/i],
  // Earthquake last of the shaking words, so it cannot swallow "tsunami
  // earthquake" above. Includes the non-English and misspelled forms the real
  // dataset actually contains.
  ['disaster:quake', /earthquake|earthquak|quake|erdbeben|seism|terremoto|earthshake|s[ée]isme/i],
];

/**
 * The finer kind of an event, or null when its layer has no sub-list (or the
 * event does not match any of them — which keeps it visible, see rule 1).
 */
export function subKindOf(ev: TimelineEvent): SubKind | null {
  switch (ev.category) {
    case 'disaster': {
      for (const [kind, re] of DISASTER_PATTERNS) if (re.test(ev.name)) return kind;
      return null; // unrecognised: stays visible
    }
    case 'invention':
      return 'science:invention';
    case 'discovery':
      return 'science:discovery';
    case 'person':
      // Built on the attestation flag added with the legends harvest: a figure
      // of legend is a genuinely different kind of entry from a documented life.
      if (ev.attestation === 'legendary') return 'people:legendary';
      if (ev.attestation === 'traditional') return 'people:traditional';
      return 'people:documented';
    default:
      return null;
  }
}

/**
 * Should this event be drawn? `cats` is the coarse layer filter (unchanged
 * behaviour); `off` is the set of sub-kinds the visitor has switched off.
 */
export function eventPasses(
  ev: TimelineEvent,
  cats: Set<string>,
  off: ReadonlySet<SubKind>,
): boolean {
  if (!cats.has(ev.category)) return false;
  if (off.size === 0) return true; // the common case — nothing switched off
  const kind = subKindOf(ev);
  return kind === null || !off.has(kind);
}

/** One row in a layer's sub-list. */
export interface SubLayerDef {
  kind: SubKind;
  label: string;
  emoji: string;
}

/**
 * The sub-lists offered per layer, keyed by the LayersPanel row label.
 *
 * Deliberately absent, because the data cannot honestly support them yet:
 *   • Cities & Places → capitals. Needs Wikidata P1376 ("capital of") added to
 *     the harvest; the imported city rows carry no such field today.
 *   • Notable People → scientist / leader / writer. Needs P106 ("occupation").
 * Both are a harvest change, not a UI one. A checkbox that filters nothing is
 * worse than no checkbox.
 */
export const SUB_LAYERS: Record<string, SubLayerDef[]> = {
  'Natural Disasters': [
    { kind: 'disaster:quake', label: 'Earthquakes', emoji: '🌎' },
    { kind: 'disaster:eruption', label: 'Volcanoes', emoji: '🌋' },
    { kind: 'disaster:tsunami', label: 'Tsunamis', emoji: '🌊' },
    { kind: 'disaster:flood', label: 'Floods', emoji: '💧' },
    { kind: 'disaster:storm', label: 'Storms', emoji: '🌀' },
    { kind: 'disaster:landslide', label: 'Landslides', emoji: '⛰️' },
    { kind: 'disaster:fire', label: 'Great Fires', emoji: '🔥' },
    { kind: 'disaster:plague', label: 'Plagues', emoji: '🦠' },
    { kind: 'disaster:famine', label: 'Famines', emoji: '🌾' },
    { kind: 'disaster:impact', label: 'Impacts', emoji: '☄️' },
  ],
  'Science & Discoveries': [
    { kind: 'science:discovery', label: 'Discoveries', emoji: '🔬' },
    { kind: 'science:invention', label: 'Inventions', emoji: '💡' },
  ],
  'Notable People': [
    { kind: 'people:documented', label: 'Documented Lives', emoji: '👤' },
    { kind: 'people:legendary', label: 'Legends', emoji: '🐉' },
    { kind: 'people:traditional', label: 'Traditional Figures', emoji: '📖' },
  ],
};

/** How many loaded events fall into each sub-kind — shown beside each row so
 * the panel tells the truth about what is actually in there (the disaster set
 * is 94% earthquakes, which is worth seeing rather than guessing). */
export function countSubKinds(events: TimelineEvent[]): Record<SubKind, number> {
  const out: Record<SubKind, number> = {};
  for (const ev of events) {
    const k = subKindOf(ev);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
