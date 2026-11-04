/**
 * Code health round 6: the Wikipedia picture panel and the Sky and Weather window.
 * (No jsdom in this repo, so the wiring is checked in the source, like a11yLabels.test.ts.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pictureAlt } from './wikiImage';

const src = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

describe('Wikipedia picture panel', () => {
  it('a broken picture is hidden with state, not a leftover DOM attribute', () => {
    // Bug: onError set `hidden` on the <figure> by hand. React reuses that
    // element for the next panel and never removes the attribute, so after
    // one broken picture every later panel's picture stayed hidden.
    const panel = src('components/InfoPanel.tsx');
    expect(panel).not.toMatch(/setAttribute\('hidden'/);
    expect(panel).toContain('onError={() => setBrokenThumb(wiki.thumb ?? null)}');
    expect(panel).toContain('wiki.thumb !== brokenThumb');
  });

  it('the credit link says it opens Wikipedia in a new tab', () => {
    expect(src('components/InfoPanel.tsx')).toMatch(/aria-label=\{`Image source: Wikipedia article \$\{imageTitle\} \(opens in a new tab\)`\}/);
  });

  it('alt text drops the leading emoji of a creature title', () => {
    expect(pictureAlt('🦖 Tyrannosaurus')).toBe('Tyrannosaurus');
    expect(pictureAlt('🕊️ Archaeopteryx')).toBe('Archaeopteryx');
    expect(pictureAlt('Battle of Hastings')).toBe('Battle of Hastings');
    expect(pictureAlt('🦕')).toBe('🦕');
  });
});

describe('Sky and Weather window', () => {
  it('Escape closes it', () => {
    expect(src('App.tsx')).toContain('useEscape(() => setSkyOpen(false), skyOpen);');
  });
});
