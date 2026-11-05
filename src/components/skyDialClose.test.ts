/**
 * The Sky and Weather window has an × to close it (Spencer, Nov 2026: "Sky
 * and weather needs a closing 'x'"). The × only shows where a close action is
 * given — the app's window — not in the monument viewer or the workshop,
 * which mount the same dial without one.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import SkyDial, { type SkyDialProps } from './SkyDial';

const base: SkyDialProps = {
  date: new Date(Date.UTC(1914, 7, 28)),
  solarHours: 9.5,
  auto: false,
  moonPhase: 0.3,
  temperature: 17,
  cloud: 0.4,
  latitude: 53.5,
  title: 'the globe',
  onChange: () => {},
};

describe('Sky and Weather close button', () => {
  it('shows an × with a label when the dial can be closed', () => {
    const html = renderToStaticMarkup(createElement(SkyDial, { ...base, onClose: () => {} }));
    expect(html).toContain('class="sky-close"');
    expect(html).toContain('aria-label="Close sky and weather"');
    expect(html).toMatch(/>×<\/button>/);
  });

  it('shows no × where the dial cannot be closed (monument viewer, workshop)', () => {
    const html = renderToStaticMarkup(createElement(SkyDial, base));
    expect(html).not.toContain('sky-close');
  });

  it('the app closes the Sky and Weather window from the ×', () => {
    const app = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8');
    expect(app).toContain('onClose={() => setSkyOpen(false)}');
  });
});
