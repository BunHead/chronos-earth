/**
 * focusMarker.ts — the event the visitor searched for or flew to ALWAYS gets a
 * marker.
 *
 * The Battle of Tangdao (1161, notability 6) never showed, even after "Fly
 * here": a search pick of a quiet event is built from the search index, not
 * from the events in memory, so the globe looked its id up, found nothing, and
 * drew nothing. And it was appended AFTER the capped list, so a full list
 * could slice it off. Now the event object itself travels with the focus, and
 * it goes to the FRONT of the list.
 */
import type { TimelineEvent } from './types';

export function withFocusedEvent(
  visList: TimelineEvent[],
  focusId: string | null,
  lookup: (id: string) => TimelineEvent | undefined,
  focusEvent: TimelineEvent | null | undefined,
  cap: number,
): TimelineEvent[] {
  if (!focusId) return visList.slice(0, cap);
  const fev = lookup(focusId) ?? (focusEvent?.id === focusId ? focusEvent : undefined);
  if (!fev) return visList.slice(0, cap);
  return [fev, ...visList.filter((e) => e.id !== focusId)].slice(0, cap);
}
