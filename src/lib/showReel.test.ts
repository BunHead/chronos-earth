import { describe, expect, it } from 'vitest';
import { buildShowScript, showDuration, showFrameAt, CHAPTERS } from './showReel';
import { OLDEST_BP } from './timeScale';

/** A corpus shaped like the real one: almost everything in the last 500 years. */
const realistic = [
  ...Array.from({ length: 3 }, (_, i) => 200_000_000 - i * 1000),
  ...Array.from({ length: 5 }, (_, i) => 20_000_000 - i * 1000),
  ...Array.from({ length: 20 }, (_, i) => 100_000 - i * 100),
  ...Array.from({ length: 60 }, (_, i) => 8_000 - i * 10),
  ...Array.from({ length: 300 }, (_, i) => 2_500 - i * 5),
  ...Array.from({ length: 2000 }, (_, i) => 480 - i * 0.2),
];

describe('buildShowScript — pacing', () => {
  it('covers the whole timeline with no gaps and no overlaps', () => {
    const s = buildShowScript(realistic, 180);
    expect(s[0].fromBP).toBe(OLDEST_BP);
    expect(s[s.length - 1].toBP).toBe(0);
    for (let i = 1; i < s.length; i++) expect(s[i].fromBP).toBe(s[i - 1].toBP);
  });

  it('spends the requested running time, near enough', () => {
    const s = buildShowScript(realistic, 180);
    expect(showDuration(s)).toBeCloseTo(180, 5);
  });

  it('gives the crowded modern era more time than the empty deep past', () => {
    const s = buildShowScript(realistic, 180);
    const modern = s.find((b) => b.id === 'modern')!;
    const pangea = s.find((b) => b.id === 'pangea')!;
    expect(modern.seconds).toBeGreaterThan(pangea.seconds);
  });

  it('but never lets one chapter swallow the show — the square root holds', () => {
    const s = buildShowScript(realistic, 180);
    const modern = s.find((b) => b.id === 'modern')!;
    // 2000 events against 3 is a ratio of ~667; screen time must not follow it.
    expect(modern.seconds / showDuration(s)).toBeLessThan(0.5);
  });

  it('never silently skips a chapter, however empty', () => {
    const s = buildShowScript([], 180);
    for (const beat of s) expect(beat.seconds).toBeGreaterThan(0);
    expect(showDuration(s)).toBeCloseTo(180, 5);
  });

  it('reports the density that earned each chapter its time', () => {
    const s = buildShowScript(realistic, 180);
    expect(s.find((b) => b.id === 'modern')!.events).toBe(2000);
    expect(s.reduce((a, b) => a + b.events, 0)).toBe(realistic.length);
  });
});

describe('showFrameAt — the playhead', () => {
  const script = buildShowScript(realistic, 180);

  it('starts at the deepest past and ends at the present', () => {
    expect(showFrameAt(script, 0)!.yearsBP).toBeCloseTo(OLDEST_BP, -3);
    const end = showFrameAt(script, showDuration(script) + 1)!;
    expect(end.yearsBP).toBe(0);
    expect(end.done).toBe(true);
  });

  it('only ever travels toward the present', () => {
    let previous = Infinity;
    for (let t = 0; t <= showDuration(script); t += 1.5) {
      const f = showFrameAt(script, t)!;
      expect(f.yearsBP).toBeLessThanOrEqual(previous + 1e-6);
      previous = f.yearsBP;
    }
  });

  it('travels logarithmically inside a beat, so deep time stays watchable', () => {
    const ice = script.find((b) => b.id === 'ice')!;
    const mid = showFrameAt(script, ice.startSec + ice.seconds / 2)!;
    // Linear would sit near 1.3 million; log puts the halfway point near the
    // geometric mean of 2.6 My and 12 ky — about 177 000 years.
    expect(mid.yearsBP).toBeLessThan(600_000);
    expect(mid.yearsBP).toBeGreaterThan(50_000);
  });

  it('hands back the chapter it is in, with its layers and caption', () => {
    const f = showFrameAt(script, 1)!;
    expect(f.beat.id).toBe('pangea');
    expect(f.beat.layers.drift).toBe(true);
    expect(f.beat.layers.battles).toBe(false);
    expect(f.beat.caption).toMatch(/Pangea/);
  });

  it('lights borders and battles only once there are any', () => {
    for (const beat of script) {
      if (beat.layers.battles) expect(beat.fromBP).toBeLessThanOrEqual(3_000);
      if (beat.layers.drift) expect(beat.toBP).toBeGreaterThanOrEqual(12_000);
    }
  });

  it('returns null for an empty script rather than guessing', () => {
    expect(showFrameAt([], 5)).toBeNull();
  });
});

describe('the default script itself', () => {
  it('reaches from the oldest edge to the present', () => {
    expect(CHAPTERS[0].fromBP).toBe(OLDEST_BP);
    expect(CHAPTERS[CHAPTERS.length - 1].toBP).toBe(0);
  });

  it('leaves room for density — the floors do not consume the whole clock', () => {
    const floors = CHAPTERS.reduce((a, c) => a + c.minShare, 0);
    expect(floors).toBeLessThan(1);
    expect(floors).toBeGreaterThan(0.3);
  });
});
