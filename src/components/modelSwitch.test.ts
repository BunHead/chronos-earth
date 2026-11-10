import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CompareMode from './CompareMode';
import InfoPanel from './InfoPanel';

const noop = () => {};
const colosseum = { model: 'amphitheatre', title: 'Colosseum', lat: 41.8902, lon: 12.4922, builtYear: 80 };

function panel(choice: 'current' | 'new', model = 'amphitheatre') {
  return renderToStaticMarkup(
    createElement(InfoPanel, {
      content: { kicker: 'Ancient monument', title: 'Colosseum', monument3d: { ...colosseum, model } },
      tone: 'standard',
      onClose: noop, onFly: noop, onZoomToBattle: noop, onViewMonument: noop,
      modelSwitch: {
        model: 'amphitheatre', choice, currentLabel: 'Current model', newLabel: 'New true-size model',
        onChange: noop, onCompare: noop,
      },
    } as unknown as Parameters<typeof InfoPanel>[0]),
  );
}

describe('the Colosseum panel model switch', () => {
  it('shows both choices and marks the picked one', () => {
    const html = panel('current');
    expect(html).toContain('aria-label="Which 3D model to show"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Current model</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>New true-size model</);
    expect(html).toContain('Compare side by side');
    expect(panel('new')).toMatch(/aria-pressed="true"[^>]*>New true-size model</);
  });

  it('is not shown for a site without a second model', () => {
    expect(panel('current', 'castle')).not.toContain('Which 3D model to show');
  });
});

describe('Compare with two models', () => {
  it('names the two sides instead of dates, and hides "Set left"', () => {
    const html = renderToStaticMarkup(
      createElement(CompareMode, {
        snapshot: 'data:,', leftYearsBP: 0, rightYearsBP: 0, split: 50,
        onSplitChange: noop, onCaptureLeft: noop, onClose: noop,
        labels: { left: 'Current model', right: 'New true-size model' },
      }),
    );
    expect(html).toContain('Current model');
    expect(html).toContain('New true-size model');
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
