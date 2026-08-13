/**
 * tone.ts — the same history, told to three different readers.
 *
 * Roadmap item 10. Chronos Earth has one voice: warm, plain, a bit of an
 * emoji. That voice is right for most people and wrong for two of them — the
 * teacher who wants the date and the source before the story, and the eight
 * year old who bounces off a forty-word sentence.
 *
 * THIS IS A COPY-TRANSFORM LAYER, NOT THREE DATASETS. Every panel is built
 * exactly as it always was, then passed through `applyTone` on its way to the
 * screen. There is one set of facts and there always will be; a second copy
 * would drift from the first within a month.
 *
 * THE IRON RULE, and the reason this file is so cautious: A TONE MAY CHANGE
 * HOW SOMETHING IS SAID, NEVER WHAT IS SAID. No date, name, number, place or
 * claim is altered by any transform here. Scholar drops decoration and reorders
 * what is already present. Casual shortens sentences and swaps a small, hand-
 * checked list of long words for short ones. Neither invents, softens or
 * removes a fact — an eight year old reading "the city was destroyed" must not
 * be told it "had a bad day".
 *
 * Pure module: no React, no DOM. Unit-tested in tone.test.ts, including the
 * rule above (the numbers and proper nouns in a panel survive every tone).
 */
import type { PanelContent, PanelSection } from './types';

export const TONES = [
  {
    id: 'explorer',
    name: 'Explorer',
    blurb: 'The ship’s own voice — warm, plain, a little wonder. The default.',
  },
  {
    id: 'scholar',
    name: 'Scholar',
    blurb: 'Dates and sources first, no decoration. For teaching and citing.',
  },
  {
    id: 'casual',
    name: 'Curious Reader',
    blurb: 'Shorter sentences, everyday words, bigger type. For younger readers.',
  },
] as const;

export type ToneId = (typeof TONES)[number]['id'];

export const DEFAULT_TONE: ToneId = 'explorer';

const KEY = 'chronos.tone';

export function isToneId(v: unknown): v is ToneId {
  return typeof v === 'string' && TONES.some((t) => t.id === v);
}

export function getTone(): ToneId {
  try {
    const v = window.localStorage.getItem(KEY);
    return isToneId(v) ? v : DEFAULT_TONE;
  } catch {
    return DEFAULT_TONE;
  }
}

export function setTone(id: ToneId): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* private browsing — the choice simply won't outlive the tab */
  }
  applyToneClass(id);
}

/**
 * Casual mode wants bigger, looser type. That is a presentation matter, so it
 * rides on the root element next to `data-skin` rather than through the copy.
 */
export function applyToneClass(id: ToneId): void {
  try {
    document.documentElement.setAttribute('data-tone', id);
  } catch {
    /* no DOM (tests) */
  }
}

/* ------------------------------------------------------------------ *
 * The transforms
 * ------------------------------------------------------------------ */

/** Emoji and dingbats. Scholar strips these; nothing else touches them. */
const DECORATION =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F0FF}]/gu;

function stripDecoration(s: string): string {
  return s.replace(DECORATION, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Long word → short word. Hand-checked, deliberately small, and deliberately
 * boring: every pair means the same thing in every context this app uses it.
 * Nothing here softens a fact — "destroyed" is not on this list and never will
 * be. Order matters only in that longer keys are replaced first.
 */
const PLAINER: Array<[RegExp, string]> = [
  [/\bapproximately\b/gi, 'about'],
  [/\bsubsequently\b/gi, 'later'],
  [/\bpreviously\b/gi, 'before'],
  [/\bconstructed\b/gi, 'built'],
  [/\bconstruction\b/gi, 'building'],
  [/\bestablished\b/gi, 'started'],
  [/\binhabited\b/gi, 'lived in'],
  [/\bfortification\b/gi, 'fort'],
  [/\bfortifications\b/gi, 'forts'],
  [/\bsettlement\b/gi, 'town'],
  [/\bcommenced\b/gi, 'began'],
  [/\butilised\b/gi, 'used'],
  [/\butilized\b/gi, 'used'],
  [/\bnumerous\b/gi, 'many'],
  [/\bsignificant\b/gi, 'important'],
  [/\bsubstantial\b/gi, 'large'],
  [/\badditionally\b/gi, 'also'],
  [/\bhowever\b/gi, 'but'],
  [/\btherefore\b/gi, 'so'],
  [/\bapproximate\b/gi, 'rough'],
  [/\bcontemporary\b/gi, 'of the time'],
  [/\bexcavated\b/gi, 'dug up'],
  [/\bexcavations\b/gi, 'digs'],
];

function plainerWords(s: string): string {
  return PLAINER.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

/**
 * Break a long sentence at its joins. Only ever splits — never drops a clause,
 * so no fact can go missing. Splitting on "; " and on ", and " / ", but " keeps
 * the words in the same order with a full stop where the breath was.
 */
function shortenSentences(s: string, maxWords = 22): string {
  return s
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) => {
      if (sentence.split(/\s+/).length <= maxWords) return [sentence];
      const parts = sentence
        .split(/;\s+|,\s+(?=and\b|but\b|which\b|while\b|although\b)/i)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length < 2) return [sentence];
      return parts.map((p, i) => {
        // Drop a leading conjunction left behind by the split, and re-capitalise.
        const cleaned = i === 0 ? p : p.replace(/^(and|but|which|while|although)\s+/i, '');
        const cap = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        return /[.!?]$/.test(cap) ? cap : `${cap}.`;
      });
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function toneText(text: string, tone: ToneId): string {
  if (tone === 'scholar') return stripDecoration(text);
  if (tone === 'casual') return shortenSentences(plainerWords(text));
  return text;
}

function toneSection(section: PanelSection, tone: ToneId): PanelSection {
  const out: PanelSection = { ...section };
  out.heading = toneText(section.heading, tone);
  if (section.body) out.body = toneText(section.body, tone);
  if (section.bullets) out.bullets = section.bullets.map((b) => toneText(b, tone));
  return out;
}

/**
 * Retell a built panel in the reader's own register.
 *
 * Explorer is the identity transform — it returns the very same object, so the
 * default reader pays nothing at all for this feature existing.
 */
export function applyTone(content: PanelContent, tone: ToneId): PanelContent {
  if (tone === 'explorer') return content;

  const out: PanelContent = { ...content };
  out.kicker = toneText(content.kicker, tone);
  out.title = content.title; // never touched: it is a name
  if (content.summary) out.summary = toneText(content.summary, tone);
  if (content.sections) out.sections = content.sections.map((s) => toneSection(s, tone));

  // Scholar wants the date before the story, not after it. The date is already
  // in the panel — this only moves it to the front of the line.
  if (tone === 'scholar' && content.date) {
    out.kicker = out.kicker ? `${content.date} · ${out.kicker}` : content.date;
  }
  return out;
}
