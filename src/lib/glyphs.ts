/**
 * glyphs.ts — the app's own drawn marks, replacing emoji.
 *
 * WHY. Emoji were the loudest thing making Chronos Earth look like every other
 * AI-built site in a curator's inbox ("they blur into one" — Web Curios, 30 Jul
 * 2026). They also render differently on every platform, and at marker size
 * most of them collapse into an unreadable coloured blob — a problem this
 * codebase had already hit once and solved by hand-drawing the crossed swords.
 * This module finishes that job for everything else.
 *
 * ONE SET, TWO SURFACES — and that is the point. The Layers panel doubles as a
 * LEGEND for the markers on the globe, so the two must never drift apart.
 * Every mark below is defined once as SVG path data on a 24×24 grid, then:
 *   • drawn as inline <svg> in the panel and menus (see components/Glyph.tsx)
 *   • stroked onto the canvas badges via Path2D (see lib/markerIcons.ts)
 *
 * DRAWING RULES, so a new mark fits the set:
 *   • 24×24 box, and keep the ink inside 3…21 so nothing clips in a circle.
 *   • STROKE, don't fill — these are engraved marks, and stroking stays legible
 *     down to 14px where a filled silhouette turns to mud.
 *   • Two or three strokes at most. A mark that needs detail to be recognised
 *     is the wrong mark.
 */

/** Marks keyed by the thing they stand for, not by what they look like. */
export const GLYPHS: Record<string, string> = {
  // ── Layers ──────────────────────────────────────────────────────────────
  /** Crossed swords — kept from the hand-drawn original, which was right. */
  battle: 'M5 19 L19 5 M7 5 L21 19 M4 16 l3 3 M20 16 l-3 3',
  /** A classical portico: pediment over columns. */
  monument: 'M2.5 9.5 L12 4 L21.5 9.5 M4.5 11.5 V19 M9.5 11.5 V19 M14.5 11.5 V19 M19.5 11.5 V19 M3 21 H21',
  /** A skyline of three blocks. */
  city: 'M3 20.5 V12 h4 v8.5 M9 20.5 V5.5 h5.5 V20.5 M16.5 20.5 V14 H21 v6.5',
  /** A volcano, with the plume that makes it not a triangle. */
  disaster: 'M3 20 L9.5 9 h5 L21 20 Z M9.5 9 q2.5 -5 5 0 M12 4.5 v-2',
  /** A lamp — the invention. */
  invention: 'M12 3.5 a5.5 5.5 0 0 1 3.5 9.8 V16 h-7 v-2.7 A5.5 5.5 0 0 1 12 3.5 Z M9.5 18.5 h5 M10.5 21 h3',
  /** A lens — the discovery. */
  discovery: 'M10.5 4.5 a6 6 0 1 0 0.01 0 M14.9 14.9 L20.5 20.5',
  /** Head and shoulders. */
  person: 'M12 4 a3.6 3.6 0 1 0 0.01 0 M4.5 21 a7.5 7.5 0 0 1 15 0',
  /** A scroll, for treaties and events. */
  event: 'M6 3.5 h11 v17 h-11 Z M6 3.5 a2 2 0 0 0 0 4 h2 M17 20.5 a2 2 0 0 0 0-4 h-2 M9.5 9 h5 M9.5 12.5 h5',
  /** Two roofs — a settlement. */
  settlement: 'M2.5 20.5 V13 L7 9 l4.5 4 v7.5 Z M12.5 20.5 V15 l4-3.5 l4 3.5 v5.5 Z',
  /** A comet, head and tail. */
  impact: 'M17 7 a3.2 3.2 0 1 0 0.01 0 M14.6 9.4 L4 20 M17.5 11.5 L9 20 M12.2 7.2 L4.5 14.5',
  /** A sauropod in profile — unmistakable at any size. */
  fauna: 'M3 18 q1 -5 6 -5 h4 q4 0 5 -4 q0.5 -3 -2 -3.5 q-2.5 -0.5 -2.5 2 M3 18 q-1.5 1 -1.5 2.5 M9 18 v3 M15 18 v3 M13 13 q4 1 7 6',
  /** Ice: a shelf over water. */
  seas: 'M3 10.5 l4 -4.5 l4 4.5 l4 -4.5 l4 4.5 M3 15 q3 -2 6 0 t6 0 t6 0 M3 19.5 q3 -2 6 0 t6 0 t6 0',
  /** A meandering river between its banks. */
  rivers: 'M6 3 q4 5 0 9 t0 9 M14.5 3 q4 5 0 9 t0 9',
  /** A bounded territory — the border itself. */
  borders: 'M3.5 6.5 h7 v5 h-7 Z M10.5 11.5 h10 v8 h-10 Z M10.5 6.5 v5',
  /** A standard planted on the line. */
  campaign: 'M6.5 21 V3.5 M6.5 4.5 h12 l-3 3.5 l3 3.5 h-12',

  // ── Disaster sub-kinds ──────────────────────────────────────────────────
  quake: 'M2.5 12 h3.5 l2.5 -6 l3.5 12 l3 -9 l2.5 3 h4',
  eruption: 'M3 20 L9.5 9 h5 L21 20 Z M9.5 9 q2.5 -5 5 0',
  tsunami: 'M2.5 18.5 q3 -2.5 6 0 t6 0 t6 0 M4 13 q4 -8 11 -6 q4 1 4 5 q-3 -3 -6 -1',
  flood: 'M12 3 q5 7 5 10.5 a5 5 0 0 1 -10 0 Q7 10 12 3 Z',
  storm: 'M6 9 a4 4 0 0 1 8 -2 a3.5 3.5 0 0 1 3 5.5 H7 A3.5 3.5 0 0 1 6 9 Z M11 14 l-2 4 h4 l-2 4',
  landslide: 'M2.5 20.5 L11 7 l4 6 l3 -3 l3.5 10.5 Z M8 13 l3 2 M14 16 l2.5 1.5',
  fire: 'M12 21 a5.5 5.5 0 0 1 -3.5 -9.5 q0 3 2 3.5 q-1.5 -5 3 -8.5 q-0.5 3.5 2 5.5 q2.5 2 2 5 A5.5 5.5 0 0 1 12 21 Z',
  plague: 'M12 6.5 a5.5 5.5 0 1 0 0.01 0 M12 3 v3.5 M12 17.5 V21 M3 12 h3.5 M17.5 12 H21 M5.6 5.6 l2.5 2.5 M15.9 15.9 l2.5 2.5 M18.4 5.6 l-2.5 2.5 M8.1 15.9 l-2.5 2.5',
  famine: 'M12 21 V9 M12 9 q-4 -1 -4 -5 q4 1 4 5 M12 9 q4 -1 4 -5 q-4 1 -4 5 M8 21 h8',

  // ── People sub-kinds ────────────────────────────────────────────────────
  documented: 'M12 4 a3.6 3.6 0 1 0 0.01 0 M4.5 21 a7.5 7.5 0 0 1 15 0',
  legendary: 'M12 3 l2.6 5.9 l6.4 0.6 l-4.8 4.3 l1.4 6.2 L12 16.8 L6.4 20 l1.4 -6.2 L3 9.5 l6.4 -0.6 Z',
  traditional: 'M4 5 h6 a2 2 0 0 1 2 2 v13 a2 2 0 0 0 -2 -2 H4 Z M20 5 h-6 a2 2 0 0 0 -2 2 v13 a2 2 0 0 1 2 -2 h6 Z',
};

/** Every mark shares one box, so the panel and the canvas agree on scale. */
export const GLYPH_BOX = 24;

/** True when a mark exists — callers fall back to their old emoji if not. */
export function hasGlyph(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(GLYPHS, name);
}
