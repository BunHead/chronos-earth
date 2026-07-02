/**
 * markerIcons.ts — builds small circular icon images (as data URLs) for the
 * globe markers, so battles and landmarks show a recognisable symbol instead of
 * a plain coloured dot. Icons are drawn once on a canvas and cached.
 */

const cache = new Map<string, string>();

function makeIcon(key: string, emoji: string, bg: string): string {
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

  // The symbol on top. Crossed swords are drawn as a crisp white glyph — the
  // ⚔️ emoji turns to an unreadable coloured blob at marker size — while every
  // other category keeps its (legible) emoji.
  const cx = size / 2;
  const cy = size / 2 + 2;
  if (emoji === '⚔️') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4.5;
    // two blades crossing in an X, hilts at the bottom corners
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 13);
    ctx.lineTo(cx + 14, cy - 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy + 13);
    ctx.lineTo(cx - 14, cy - 14);
    ctx.stroke();
    // short crossguards near the hilts so it reads as swords, not just an X
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 17, cy + 4);
    ctx.lineTo(cx - 5, cy + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 17, cy + 4);
    ctx.lineTo(cx + 5, cy + 10);
    ctx.stroke();
  } else if (emoji === '👤') {
    // A white bust silhouette — the 👤 emoji is invisible at marker size.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 6.5, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 12, 11, 0, Math.PI, 2 * Math.PI); // shoulders (top half)
    ctx.fill();
  } else {
    ctx.font = '30px "Segoe UI Emoji", "Apple Color Emoji", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);
  }

  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export const ICONS = {
  battle: () => makeIcon('battle', '⚔️', '#b23b3b'),
  monument: () => makeIcon('monument', '🏛️', '#b9892e'),
  settlement: () => makeIcon('settlement', '🏘️', '#2e8b73'),
  precursor: () => makeIcon('precursor', '☄️', '#c0392b'),
};

/** Icon badge for a prehistoric animal (one per species, cached by id). */
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
  battle: ['⚔️', '#b23b3b'],
  monument: ['🏛️', '#b9892e'],
  city: ['🏙️', '#2f6fb0'],
  disaster: ['🌋', '#c0562a'],
  invention: ['💡', '#2e8b57'],
  discovery: ['🔬', '#6a4cae'],
  person: ['👤', '#3a7d6e'],
  event: ['📜', '#8a6d3b'],
};

export function eventIcon(category: string): string {
  const [emoji, bg] = EVENT_ICON[category] ?? ['•', '#777777'];
  return makeIcon(`event-${category}`, emoji, bg);
}
