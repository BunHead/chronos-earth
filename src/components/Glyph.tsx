import { GLYPHS, GLYPH_BOX } from '../lib/glyphs';

interface GlyphProps {
  /** Key into GLYPHS — e.g. "battle", "monument", "quake". */
  name: string;
  size?: number;
  /** Overrides the inherited text colour when a row wants its own tint. */
  color?: string;
  className?: string;
}

/**
 * One of the app's drawn marks, inline.
 *
 * Stroked in `currentColor` by default, so a mark simply takes the colour of
 * whatever row it sits in and every skin repaints them for free — which is the
 * main thing emoji could never do.
 *
 * Decorative by default: these always sit beside a text label, so announcing
 * them again would just make a screen reader say everything twice.
 */
export default function Glyph({ name, size = 15, color, className }: GlyphProps) {
  const d = GLYPHS[name];
  if (!d) return null;
  return (
    <svg
      className={className ? `glyph ${className}` : 'glyph'}
      width={size}
      height={size}
      viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`}
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
