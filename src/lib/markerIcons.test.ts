import { describe, it, expect } from 'vitest';
import { EVENT_ICON, SITE_GLYPH } from './markerIcons';
import { SUB_LAYERS } from './subLayers';
import { GLYPHS } from './glyphs';

describe("only impact events wear the 'impact' glyph", () => {
  it('precursor-hypothesis sites do NOT use the impact mark', () => {
    expect(SITE_GLYPH['precursor-hypothesis']).not.toBe('impact');
    expect(SITE_GLYPH['precursor-hypothesis']).toBe('legendary');
  });

  it('no curated-site category uses the impact mark', () => {
    for (const [cat, glyph] of Object.entries(SITE_GLYPH)) {
      expect(glyph, cat).not.toBe('impact');
      expect(GLYPHS[glyph], `${cat} → ${glyph} must be a real drawn mark`).toBeTruthy();
    }
  });

  it('no event-category badge uses the impact mark', () => {
    for (const [cat, [glyph]] of Object.entries(EVENT_ICON)) {
      expect(glyph, cat).not.toBe('impact');
    }
  });

  it('in the Layers legend, only the Impacts sub-layer uses it', () => {
    const users = Object.values(SUB_LAYERS)
      .flat()
      .filter((d) => d.glyph === 'impact')
      .map((d) => d.kind);
    expect(users).toEqual(['disaster:impact']);
  });
});
