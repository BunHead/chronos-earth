/**
 * capitals.ts — which cities were capitals, when, and when that changed.
 *
 * A capital is not a kind of city, it is a ROLE a city holds for a while, and
 * the interesting part is the handover: Kyoto was the capital of Japan for
 * 1,075 years and then, in 1869, it was not. Philadelphia held the United
 * States for ten. Melbourne held Australia from 1901 until Canberra was ready
 * in 1927. A timeline that cannot show that is wasting a timeline.
 *
 * The data comes from Wikidata's P1376 ("capital of") with its P580/P582
 * qualifiers, harvested by scripts/fetch-capitals.mjs and attached to city
 * rows as `capitalOf`.
 *
 * A missing `from` means Wikidata records the role but not when it started.
 * That is common and it is NOT the same as "since the beginning" — so an
 * undated record makes a city a capital whenever it exists, and never counts
 * as a change. Inventing a start year to make an animation fire would be
 * inventing history for the sake of a glow.
 */
import type { TimelineEvent } from './types';

export interface CapitalRole {
  /** The polity: "Japan", "United States", "Achaemenid Empire". */
  of: string;
  /** Year the role began; null when Wikidata does not record one. */
  from: number | null;
  /** Year it ended; null means it still holds. */
  to: number | null;
}

/** How near a handover has to be before the marker draws attention to it.
 * Wide enough that scrubbing at speed cannot skip straight over the moment,
 * narrow enough that it means "about now" rather than "this century". */
export const CHANGE_WINDOW_YEARS = 30;

/**
 * How near the MOMENT a marker has to be before it pulses.
 *
 * Much tighter than CHANGE_WINDOW_YEARS, and deliberately. That window is about
 * PROMINENCE — it lifts a city into view in good time so you are already
 * looking at Kyoto when it hands Japan to Tokyo. This one is about the ANIMATION,
 * and the Captain's instruction was "only pulse when they're founded or change".
 * Thirty years of pulsing either side is not a moment, it is a mood; ten years
 * reads as an event even when the timeline is running fast.
 */
export const PULSE_WINDOW_YEARS = 10;

/**
 * Should this place be drawing attention to itself right now?
 *
 * Two occasions, and only two: the year it appears at all, and the year the
 * capital role changes hands — gained or lost, because Kyoto dimming and Tokyo
 * brightening are one movement seen from two places.
 */
export function pulseAt(e: TimelineEvent, year: number): boolean {
  if (Math.abs(year - e.startYear) <= PULSE_WINDOW_YEARS) return true;
  return capitalChangeAt(e, year, PULSE_WINDOW_YEARS) !== null;
}

function roles(e: TimelineEvent): CapitalRole[] {
  return (e as TimelineEvent & { capitalOf?: CapitalRole[] }).capitalOf ?? [];
}

/**
 * Is this row a PLACE — somewhere that can hold the capital role?
 *
 * City and monument are one family. Wikidata files a place under either
 * depending on who edited it, which is why the duplicate-pin dedupe already
 * treats them as one, and why Brasília — a purpose-built national capital —
 * sits on the globe typed as a monument. Gating the capital treatment on
 * `category === 'city'` alone gave it no gold badge and none of the
 * prominence that goes with it, so the Captain could not find it.
 */
export function isPlaceRow(e: TimelineEvent): boolean {
  return e.category === 'city' || e.category === 'monument';
}

export function isCapitalRow(e: TimelineEvent): boolean {
  return roles(e).length > 0;
}

/**
 * What this city is capital OF at a given year — the most significant role if
 * it holds several, which in practice means the one listed first, since the
 * harvester sorts them newest-first.
 */
export function capitalAt(e: TimelineEvent, year: number): CapitalRole | null {
  for (const r of roles(e)) {
    const started = r.from === null || year >= r.from;
    const ended = r.to !== null && year > r.to;
    if (started && !ended) return r;
  }
  return null;
}

/**
 * Is a handover happening about now? Returns the year it happens, so the
 * caller can say WHAT changed rather than merely that something did.
 *
 * Both ends count: a city gaining the role and a city losing it are the same
 * event seen from two places, and on the globe you want both to light up —
 * that is what makes Kyoto dimming and Tokyo brightening read as one movement
 * rather than two coincidences.
 */
export function capitalChangeAt(
  e: TimelineEvent,
  year: number,
  window = CHANGE_WINDOW_YEARS,
): { year: number; of: string; gained: boolean } | null {
  let best: { year: number; of: string; gained: boolean } | null = null;
  for (const r of roles(e)) {
    for (const [y, gained] of [[r.from, true], [r.to, false]] as const) {
      if (y === null) continue;
      if (Math.abs(year - y) > window) continue;
      // The nearest change wins, so a city with a long history does not
      // flicker over a handover four hundred years away.
      if (!best || Math.abs(year - y) < Math.abs(year - best.year)) {
        best = { year: y, of: r.of, gained };
      }
    }
  }
  return best;
}

/**
 * How strongly the globe should fight to keep this city on screen.
 *
 * THE CAPTAIN'S COMPLAINT, and the reason this exists: Melbourne and Perth
 * took far too long to appear. Cities are culled by notability — Wikipedia
 * sitelink count — and at a wide view the ten city slots were going to
 * hand-curated rows carrying an artificial score of 400, so Melbourne (207)
 * and Perth (171) could not get in however important they are.
 *
 * Being a capital is a fact about a place's importance that sitelinks do not
 * capture, so it is added rather than substituted: a capital outranks a
 * non-capital of similar fame, and a capital in the middle of a handover
 * outranks a settled one, because that is the moment worth looking at.
 */
export function cityProminence(e: TimelineEvent, year: number): number {
  const base = e.notability ?? 0;
  const role = capitalAt(e, year);
  if (!role) return base;
  const change = capitalChangeAt(e, year);
  // THE HANDOVER BONUS DECAYS, and it has to.
  //
  // It was a flat +150 anywhere inside the window, and at 2026 that quietly
  // wrecked the modern map: Kabul, Astana, Rabat, Katowice, Malabo and Bujumbura
  // all outranked Paris, London, Rome and Washington DC — not because they are
  // more important but because their capital status happened to change within
  // the last thirty years. Washington fell to 18th of 1,200 and off a globe with
  // ten city slots, which is precisely what the Captain could not find.
  //
  // The bonus exists to catch the eye AT the moment, so it is strongest at the
  // moment and gone by the edge of the window. Smaller, too: a handover is
  // worth noticing, not worth more than being Paris.
  const boost = change
    ? 90 * (1 - Math.min(1, Math.abs(year - change.year) / CHANGE_WINDOW_YEARS))
    : 0;
  return base + 250 + boost;
}
