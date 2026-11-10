/**
 * modelChoice.ts — "which model stands here?" for a site that has TWO.
 *
 * The Colosseum has the stylised 'amphitheatre' archetype (the default, the
 * one the pin has always used) and the newer true-metre 'colosseum' model
 * (components/colosseum.ts). The Captain asked for a switch between the two
 * (10 Nov 2026), so the globe keeps the current one unless the visitor picks
 * the new one; the pick is remembered on this device only (localStorage).
 *
 * Pure helpers + a tiny store. No Cesium here, so it is cheap to test.
 */

/** 'current' = the model the pin has always used; 'new' = the alternative. */
export type ModelChoice = 'current' | 'new';

/** Sites with an alternative model: the pin's own model → the new one. */
export const MODEL_ALTERNATIVES: Readonly<Record<string, { alt: string; currentLabel: string; newLabel: string }>> = {
  amphitheatre: { alt: 'colosseum', currentLabel: 'Current model', newLabel: 'New true-size model' },
};

const KEY_PREFIX = 'chronos.modelChoice.';

/** The alternative model for a pin's model, or null if it has none. */
export function alternativeFor(model: string): string | null {
  return MODEL_ALTERNATIVES[model]?.alt ?? null;
}

/** Read a string out of localStorage, safely (private mode, no window). */
function readStore(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string | null): void {
  try {
    if (value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    /* storage full or blocked: the choice just won't be remembered */
  }
}

/** In-memory choices (a Compare run flips one without remembering it). */
const live = new Map<string, ModelChoice>();
const listeners = new Set<(model: string, choice: ModelChoice) => void>();

/** The visitor's pick for this pin model. Default: 'current'. */
export function getModelChoice(model: string): ModelChoice {
  const held = live.get(model);
  if (held) return held;
  return readStore(KEY_PREFIX + model) === 'new' && alternativeFor(model) ? 'new' : 'current';
}

/** Set the pick. persist=false (Compare) changes it for now, not for next time. */
export function setModelChoice(model: string, choice: ModelChoice, persist = true): void {
  if (!alternativeFor(model)) return;
  live.set(model, choice);
  // Only 'new' is stored: 'current' is the default, so it just clears the key.
  if (persist) writeStore(KEY_PREFIX + model, choice === 'new' ? 'new' : null);
  for (const fn of listeners) fn(model, choice);
}

/** Be told when a pick changes (the globe re-points its model). */
export function onModelChoice(fn: (model: string, choice: ModelChoice) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The model id the globe should actually load for a pin model: the
 * alternative only when it is picked AND it was exported (has a footprint in
 * the manifest). Anything else falls back to the pin's own model, so a
 * missing file can never leave the site empty.
 */
export function effectiveModel(
  model: string,
  choice: ModelChoice,
  manifest: Record<string, { footprint?: number } | undefined>,
): string {
  const alt = alternativeFor(model);
  if (choice !== 'new' || !alt || !manifest[alt]?.footprint) return model;
  return alt;
}

/** Test hook: forget in-memory picks. */
export function _resetModelChoices(): void {
  live.clear();
  listeners.clear();
}
