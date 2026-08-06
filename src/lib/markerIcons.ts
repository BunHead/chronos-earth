import { GLYPHS, GLYPH_BOX } from './glyphs';
/**
 * markerIcons.ts — builds small circular icon images (as data URLs) for the
 * globe markers, so battles and landmarks show a recognisable symbol instead of
 * a plain coloured dot. Icons are drawn once on a canvas and cached.
 */

const cache = new Map<string, string>();

function makeIcon(key: string, glyph: string, bg: string): string {
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Circular badge with a soft shadow + white rim.
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.stroke();

  // THE SYMBOL. Every category is now one of the app's own drawn marks
  // (lib/glyphs), stroked through Path2D — the same path data the Layers panel
  // renders inline, so the panel genuinely IS the legend for these markers
  // rather than merely resembling one. Emoji were unreliable here anyway: they
  // render differently on every platform and most collapse into a coloured
  // blob at this size, which is why swords and the bust were already hand-drawn.
  const d = GLYPHS[glyph];
  if (d) {
    ctx.save();
    // Centre the 24x24 glyph box in the badge and scale it to fill ~34px.
    const scale = 34 / GLYPH_BOX;
    ctx.translate(size / 2 - (GLYPH_BOX * scale) / 2, size / 2 - (GLYPH_BOX * scale) / 2 + 1);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Stroke width is in glyph units, so it stays even after the scale above.
    ctx.lineWidth = 2.1;
    ctx.stroke(new Path2D(d));
    ctx.restore();
  } else {
    // No drawn mark for this one — render the symbol as text. This is the
    // path PREHISTORIC LIFE takes: fauna.json gives every creature its own
    // emoji (a sauropod, a mammoth, a trilobite), which is genuinely more
    // informative than one generic "extinct animal" mark could ever be. So the
    // chrome categories get drawn marks and the data keeps its own symbols.
    ctx.font = '30px "Segoe UI Emoji", "Apple Color Emoji", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + 2);
  }
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export const ICONS = {
  battle: () => makeIcon('battle', 'battle', '#b23b3b'),
  monument: () => makeIcon('monument', 'monument', '#b9892e'),
  settlement: () => makeIcon('settlement', 'settlement', '#2e8b73'),
  precursor: () => makeIcon('precursor', 'impact', '#c0392b'),
};

/** Icon badge for a prehistoric animal (one per species, cached by id). */
/** Fauna keep their own per-creature emoji from fauna.json — see the fallback
 * in makeIcon. A single generic "extinct animal" mark would say less. */
export function faunaIcon(emoji: string, key: string): string {
  return makeIcon(`fauna-${key}`, emoji, '#2f5d46');
}

export function siteIcon(category: 'monument' | 'settlement' | 'precursor-hypothesis'): string {
  if (category === 'settlement') return ICONS.settlement();
  if (category === 'precursor-hypothesis') return ICONS.precursor();
  return ICONS.monument();
}

/** Icon badge for an imported history event, by category. */
const EVENT_ICON: Record<string, [string, string]> = {
  battle: ['battle', '#b23b3b'],
  monument: ['monument', '#b9892e'],
  city: ['city', '#2f6fb0'],
  disaster: ['disaster', '#c0562a'],
  invention: ['invention', '#2e8b57'],
  discovery: ['discovery', '#6a4cae'],
  person: ['person', '#3a7d6e'],
  event: ['event', '#8a6d3b'],
};

export function eventIcon(category: string): string {
  const [emoji, bg] = EVENT_ICON[category] ?? ['•', '#777777'];
  return makeIcon(`event-${category}`, emoji, bg);
}
