import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CompareMode from './CompareMode';
import InfoPanel from './InfoPanel';

const noop = () => {};
const colosseum = { model: 'colosseum', title: 'Colosseum', lat: 41.8902, lon: 12.4922, builtYear: 80 };

describe('the Colosseum panel', () => {
  it('no longer shows a model toggle or a side-by-side compare button', () => {
    const html = renderToStaticMarkup(
      createElement(InfoPanel, {
        content: { kicker: 'Ancient monument', title: 'Colosseum', monument3d: colosseum },
        tone: 'standard',
        onClose: noop, onFly: noop, onZoomToBattle: noop, onViewMonument: noop,
      } as unknown as Parameters<typeof InfoPanel>[0]),
    );
    expect(html).not.toContain('Which 3D model to show');
    expect(html).not.toContain('Current model');
    expect(html).not.toContain('New true-size model');
    expect(html).not.toContain('Compare side by side');
  });
});

describe('CompareMode', () => {
  it('can still name the two sides instead of dates, and hides "Set left"', () => {
    const html = renderToStaticMarkup(
      createElement(CompareMode, {
        snapshot: 'data:,', leftYearsBP: 0, rightYearsBP: 0, split: 50,
        onSplitChange: noop, onCaptureLeft: noop, onClose: noop,
        labels: { left: 'Then', right: 'Now' },
      }),
    );
    expect(html).toContain('Then');
    expect(html).toContain('Now');
    expect(html).toContain('Compare models');
    expect(html).not.toContain('Set left');
    expect(html).toContain('aria-label="Close Time Rift"');
  });

  it('the ordinary Time Rift is unchanged', () => {
    const html = renderToStaticMarkup(
      createElement(CompareMode, {
        snapshot: 'data:,', leftYearsBP: 1000, rightYearsBP: 0, split: 50,
        onSplitChange: noop, onCaptureLeft: noop, onClose: noop,
      }),
    );
    expect(html).toContain('THEN');
    expect(html).toContain('Set left');
  });
});
