import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SearchBox from './SearchBox';
import CompareMode from './CompareMode';

const noop = () => {};

describe('screen-reader labels', () => {
  it('the search box is a labelled list-autocomplete combobox', () => {
    const html = renderToStaticMarkup(
      createElement(SearchBox, {
        sites: [], battles: [], events: [], fauna: [],
        onPickBattle: noop, onPickSite: noop, onPickEra: noop, onPickEvent: noop,
        onPickFauna: noop, onPickYear: noop, onWebSearch: noop,
      }),
    );
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Search people, places, battles and eras"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
  });

  it('the Time Rift is a named region with a labelled slider and close button', () => {
    const html = renderToStaticMarkup(
      createElement(CompareMode, {
        snapshot: 'data:,', leftYearsBP: 1000, rightYearsBP: 0, split: 50,
        onSplitChange: noop, onCaptureLeft: noop, onClose: noop,
      }),
    );
    expect(html).toContain('role="region" aria-label="Time Rift comparison"');
    expect(html).toContain('Rift position');
    expect(html).toContain('aria-label="Close Time Rift"');
  });
});

describe('screen-reader labels: tours and compass', () => {
  it('each tour stop dot names its stop and marks the current one', async () => {
    const { default: Tours } = await import('./Tours');
    const tour = {
      id: 't', emoji: '🎬', title: 'Test', description: '',
      steps: [
        { title: 'First', text: 'a' },
        { title: 'Second', text: 'b' },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(Tours, { active: tour as never, step: 1, onStep: noop, onExit: noop }),
    );
    expect(html).toContain('aria-label="Stop 1: First"');
    expect(html).toMatch(/aria-label="Stop 2: Second" aria-current="step"/);
    expect(html).not.toMatch(/aria-label="Stop 1: First" aria-current/);
  });

  it('the compass rose says what it does', async () => {
    const { default: CompassFrame } = await import('./CompassFrame');
    const html = renderToStaticMarkup(
      createElement(CompassFrame, { getHeading: () => 0, onResetNorth: noop, onClose: noop }),
    );
    expect(html).toContain('aria-label="Face north"');
  });
});
