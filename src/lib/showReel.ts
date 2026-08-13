/**
 * showReel.ts — "play all of history" as a show, not a scrub.
 *
 * Roadmap item 12. Everything this needs already exists: monuments rise and
 * ruin, borders breathe, battles flare, the terminator rolls. What was missing
 * was the DIRECTION — something that decides where to linger, what to switch
 * on, and what to hurry past.
 *
 * THREE PROBLEMS, and this module is the three answers.
 *
 * 1. THE TIMELINE IS LOGARITHMIC AND HISTORY IS NOT. Played at a constant rate
 *    over years, 250 million of them arrive before anything with a name in it;
 *    played at a constant rate over the log scale, the Cretaceous gets the same
 *    screen time as the twentieth century. Neither is a show. `CHAPTERS` below
 *    divides deep time into stretches that are each ABOUT something, and the
 *    pacing curve then hands each one a share of the clock.
 *
 * 2. DEAD AIR. Long spans of the record hold nothing this app can draw. Rather
 *    than guess where those are, the script is built from the REAL event
 *    density: a chapter's share of the running time is scaled by how much there
 *    actually is to see in it. Sub-linear (a square root), because a chapter
 *    with a hundred times the events does not deserve a hundred times the
 *    screen — that would hand almost the whole show to the last two centuries.
 *    Every chapter keeps a floor, so nothing is silently skipped: a quiet
 *    stretch is passed over briskly, never cut.
 *
 * 3. LAYERS THAT SUIT THE MOMENT. Drift belongs to deep time and borders do
 *    not; battles are noise before there are armies. Each chapter names the
 *    layers that make it legible.
 *
 * BEHIND `?show=1`, DEFAULT OFF — and deliberately unfinished. The roadmap says
 * the final pacing wants the Captain's live eye, so this lands the engine and a
 * defensible default script and stops there. See the live-review note in
 * docs/roadmap-queue.md.
 *
 * Pure module: no React, no Cesium, no DOM beyond the flag read. Tested in
 * showReel.test.ts.
 */
import { OLDEST_BP } from './timeScale';

/** Which layers a chapter wants lit. Mirrors App's own layer switches. */
export interface ShowLayers {
  drift: boolean;
  borders: boolean;
  battles: boolean;
  sites: boolean;
  fauna: boolean;
}

export interface ShowChapter {
  id: string;
  /** Older edge, years before present. */
  fromBP: number;
  /** Younger edge, years before present. */
  toBP: number;
  /** One line, shown as the show plays. Plain, never breathless. */
  caption: string;
  layers: ShowLayers;
  /** Never give this chapter less than this share of the clock, however empty
   * it is — the Earth without us is part of the story, not dead air. */
  minShare: number;
}

const L = (
  drift: boolean,
  borders: boolean,
  battles: boolean,
  sites: boolean,
  fauna: boolean,
): ShowLayers => ({ drift, borders, battles, sites, fauna });

/**
 * The default script. Boundaries are real transitions, not round numbers, and
 * each caption states what is on screen rather than selling it.
 */
export const CHAPTERS: ShowChapter[] = [
  {
    id: 'pangea',
    fromBP: OLDEST_BP,
    toBP: 66_000_000,
    caption: 'One ocean, one continent. Pangea begins to come apart.',
    layers: L(true, false, false, false, true),
    minShare: 0.1,
  },
  {
    id: 'after-the-impact',
    fromBP: 66_000_000,
    toBP: 2_600_000,
    caption: 'After the impact: the continents take the shapes you know.',
    layers: L(true, false, false, false, true),
    minShare: 0.08,
  },
  {
    id: 'ice',
    fromBP: 2_600_000,
    toBP: 12_000,
    caption: 'Ice advances and retreats. Sea levels fall; land bridges open.',
    layers: L(true, false, false, true, true),
    minShare: 0.08,
  },
  {
    id: 'first-builders',
    fromBP: 12_000,
    toBP: 3_000,
    caption: 'The first monuments. People begin to build in stone.',
    layers: L(false, false, false, true, false),
    minShare: 0.08,
  },
  {
    id: 'empires',
    fromBP: 3_000,
    toBP: 500,
    caption: 'Borders appear, and begin to move.',
    layers: L(false, true, true, true, false),
    minShare: 0.1,
  },
  {
    id: 'modern',
    fromBP: 500,
    toBP: 0,
    caption: 'The last five centuries — the map redrawn, and redrawn again.',
    layers: L(false, true, true, true, false),
    minShare: 0.12,
  },
];

export interface ShowBeat extends ShowChapter {
  /** When this beat starts, seconds from the top of the show. */
  startSec: number;
  /** How long it runs. */
  seconds: number;
  /** How many dated things the corpus holds inside it — the density that
   * earned it its time. Reported so the pacing can be argued with. */
  events: number;
}

/**
 * Cut the running time between the chapters according to how much there is to
 * see in each.
 *
 * `marks` is simply every dated thing's position in years before present; the
 * caller passes the events it has actually loaded, so the pacing reflects the
 * real corpus rather than an assumption about it. An empty corpus is fine and
 * falls back to the floors.
 */
export function buildShowScript(marks: number[], totalSeconds = 180): ShowBeat[] {
  const counts = CHAPTERS.map(
    (c) => marks.filter((bp) => bp <= c.fromBP && bp > c.toBP).length,
  );
  // Square root, so a chapter with 100x the events gets 10x the screen — not
  // 100x, which would give the whole show to the modern era.
  const weights = counts.map((n) => Math.sqrt(n));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Floors first; whatever is left over is shared by density.
  const floorSum = CHAPTERS.reduce((a, c) => a + c.minShare, 0);
  const spare = Math.max(0, 1 - floorSum);

  let startSec = 0;
  return CHAPTERS.map((c, i) => {
    const density = weightSum > 0 ? weights[i] / weightSum : 1 / CHAPTERS.length;
    const share = c.minShare + spare * density;
    const seconds = totalSeconds * share;
    const beat: ShowBeat = { ...c, startSec, seconds, events: counts[i] };
    startSec += seconds;
    return beat;
  });
}

/** The whole show's running time — the last beat's end. */
export function showDuration(script: ShowBeat[]): number {
  const last = script[script.length - 1];
  return last ? last.startSec + last.seconds : 0;
}

export interface ShowFrame {
  yearsBP: number;
  beat: ShowBeat;
  /** 0..1 through this beat. */
  beatProgress: number;
  /** True once the show has run past its end. */
  done: boolean;
}

/**
 * Where the playhead should be `elapsed` seconds into the show.
 *
 * Inside a beat the travel is LOGARITHMIC in years-before-present, not linear.
 * A beat spanning 66 million to 2.6 million years would otherwise sit at 60
 * million for most of its length and then flicker through the last stretch;
 * log travel gives every order of magnitude equal screen time, which is what
 * makes deep time watchable at all.
 */
export function showFrameAt(script: ShowBeat[], elapsed: number): ShowFrame | null {
  if (script.length === 0) return null;
  const end = showDuration(script);
  const last = script[script.length - 1];
  if (elapsed >= end) {
    return { yearsBP: last.toBP, beat: last, beatProgress: 1, done: true };
  }
  const beat = script.find((b) => elapsed < b.startSec + b.seconds) ?? script[0];
  const t = beat.seconds > 0 ? (elapsed - beat.startSec) / beat.seconds : 1;
  const p = Math.min(1, Math.max(0, t));

  // +1 keeps the logarithm finite when a chapter runs all the way to the
  // present (toBP === 0), which the last one does.
  const from = Math.log10(beat.fromBP + 1);
  const to = Math.log10(beat.toBP + 1);
  const yearsBP = Math.max(0, 10 ** (from + (to - from) * p) - 1);
  return { yearsBP, beat, beatProgress: p, done: false };
}

/* ------------------------------------------------------------------ *
 * The flag
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'chronos.show';

/**
 * `?show=1` turns the show engine on for this load (and remembers it);
 * `?show=0` turns it off and forgets. Default OFF, per the roadmap — this is an
 * unfinished feature and must not appear on the live site by accident.
 */
export function showEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search).get('show');
    if (p === '1' || p === 'on') {
      try { window.localStorage.setItem(STORAGE_KEY, 'on'); } catch { /* private mode */ }
      return true;
    }
    if (p === '0' || p === 'off') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}
