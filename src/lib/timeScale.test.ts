import { describe, it, expect } from 'vitest';
import {
  OLDEST_BP,
  PRESENT_YEAR,
  yearsBPToPos,
  posToYearsBP,
  yearsBPToYear,
  yearToYearsBP,
  formatTime,
  getEra,
  clamp,
  ZOOM_SPANS,
  clampWindow,
  bpToWindowPos,
  windowPosToBP,
  niceTicks,
} from './timeScale';

describe('timeline position mapping', () => {
  it('maps the oldest time to position 0 (far left)', () => {
    expect(yearsBPToPos(OLDEST_BP)).toBeCloseTo(0, 6);
  });

  it('maps the present (0 BP) to position 1 (far right)', () => {
    expect(yearsBPToPos(0)).toBeCloseTo(1, 6);
  });

  it('places recent history in the right-hand portion of the bar', () => {
    // The year 1815 (Waterloo) should sit comfortably in the right-hand third
    // of the bar, not crushed against the edge — that is the point of the log scale.
    const pos = yearsBPToPos(yearToYearsBP(1815));
    expect(pos).toBeGreaterThan(0.7);
    expect(pos).toBeLessThan(1);
  });

  it('is monotonic: older time is always further left', () => {
    expect(yearsBPToPos(100_000_000)).toBeLessThan(yearsBPToPos(1_000_000));
    expect(yearsBPToPos(1_000_000)).toBeLessThan(yearsBPToPos(2000));
    expect(yearsBPToPos(2000)).toBeLessThan(yearsBPToPos(50));
  });
});

describe('round-trip conversion (position <-> years BP)', () => {
  const samples = [0, 50, 226, 2000, 12_000, 1_000_000, 66_000_000, OLDEST_BP];

  for (const bp of samples) {
    it(`survives a round trip for ${bp} BP`, () => {
      const roundTripped = posToYearsBP(yearsBPToPos(bp));
      // Allow a small relative tolerance because of floating point.
      const tolerance = Math.max(1, bp * 1e-6);
      expect(Math.abs(roundTripped - bp)).toBeLessThanOrEqual(tolerance);
    });
  }

  it('round-trips an arbitrary position back to itself', () => {
    for (const pos of [0, 0.1, 0.37, 0.5, 0.83, 0.99, 1]) {
      expect(yearsBPToPos(posToYearsBP(pos))).toBeCloseTo(pos, 6);
    }
  });
});

describe('calendar year conversion', () => {
  it('treats the present year correctly', () => {
    expect(yearsBPToYear(0)).toBe(PRESENT_YEAR);
    expect(yearToYearsBP(PRESENT_YEAR)).toBe(0);
  });

  it('handles BCE years', () => {
    // 44 BCE (assassination of Caesar) is PRESENT_YEAR + 44 - 1 years before now.
    expect(yearToYearsBP(-43)).toBe(PRESENT_YEAR + 43);
  });
});

describe('formatTime', () => {
  it('formats deep time in millions of years', () => {
    expect(formatTime(250_000_000)).toBe('250 Mya');
    expect(formatTime(201_400_000)).toBe('201 Mya');
  });

  it('formats prehistory in thousands of years', () => {
    expect(formatTime(12_000)).toBe('12 kya');
  });

  it('formats historical years as BCE / CE', () => {
    expect(formatTime(yearToYearsBP(1815))).toBe('1815 CE');
    // Data convention: year -44 means 44 BCE (Caesar's assassination),
    // matching the dateLabel strings used across battles.json.
    expect(formatTime(yearToYearsBP(-44))).toBe('44 BCE');
    expect(formatTime(yearToYearsBP(-216))).toBe('216 BCE');
    expect(formatTime(yearToYearsBP(0))).toBe('1 BCE');
  });
});

describe('era lookup', () => {
  it('finds geological eras in deep time', () => {
    expect(getEra(200_000_000)?.name).toBe('Jurassic');
    expect(getEra(100_000_000)?.name).toBe('Cretaceous');
  });

  it('finds historical eras in recent time', () => {
    expect(getEra(yearToYearsBP(1000))?.name).toBe('Medieval');
    expect(getEra(yearToYearsBP(2000))?.name).toBe('Modern');
  });
});

describe('clamp', () => {
  it('keeps values within bounds', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('zoom window math', () => {
  it('offers a sensible ladder of zoom spans ending at the full range', () => {
    expect(ZOOM_SPANS[0]).toBe(100);
    expect(ZOOM_SPANS[ZOOM_SPANS.length - 1]).toBe(OLDEST_BP);
    // strictly increasing
    for (let i = 1; i < ZOOM_SPANS.length; i++) {
      expect(ZOOM_SPANS[i]).toBeGreaterThan(ZOOM_SPANS[i - 1]);
    }
  });

  it('round-trips between years-BP and window position', () => {
    const win = { centerBP: 1000, span: 200 };
    for (const bp of [900, 950, 1000, 1050, 1100]) {
      expect(windowPosToBP(bpToWindowPos(bp, win), win)).toBeCloseTo(bp, 6);
    }
  });

  it('maps window edges to 0/1 with older time on the left', () => {
    const win = { centerBP: 1000, span: 200 };
    expect(bpToWindowPos(1100, win)).toBeCloseTo(0, 6); // older edge → left
    expect(bpToWindowPos(1000, win)).toBeCloseTo(0.5, 6); // centre
    expect(bpToWindowPos(900, win)).toBeCloseTo(1, 6); // younger edge → right
  });

  it('reports positions outside 0..1 for moments beyond the window', () => {
    const win = { centerBP: 1000, span: 200 };
    expect(bpToWindowPos(1300, win)).toBeLessThan(0);
    expect(bpToWindowPos(700, win)).toBeGreaterThan(1);
  });
});

describe('clampWindow', () => {
  it('slides a window inward at the present edge', () => {
    const w = clampWindow({ centerBP: 10, span: 100 });
    expect(w.centerBP - w.span / 2).toBeGreaterThanOrEqual(0);
    expect(w.span).toBe(100);
  });

  it('slides a window inward at the deep-time edge', () => {
    const w = clampWindow({ centerBP: OLDEST_BP - 10, span: 100 });
    expect(w.centerBP + w.span / 2).toBeLessThanOrEqual(OLDEST_BP);
    expect(w.span).toBe(100);
  });

  it('caps a span wider than the whole timeline and centres it', () => {
    const w = clampWindow({ centerBP: 1000, span: OLDEST_BP * 2 });
    expect(w.span).toBe(OLDEST_BP);
    expect(w.centerBP).toBe(OLDEST_BP / 2);
  });
});

describe('niceTicks', () => {
  it('produces round calendar-year ticks in recent history', () => {
    const ticks = niceTicks({ centerBP: yearToYearsBP(1800), span: 100 });
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.some((t) => t.label === '1800 CE')).toBe(true);
    // oldest-first ⇒ years-BP strictly decreasing
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].yearsBP).toBeLessThan(ticks[i - 1].yearsBP);
    }
  });

  it('labels deep time with kya / Mya', () => {
    const ticks = niceTicks({ centerBP: 1_000_000, span: 1_000_000 });
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.every((t) => /Mya|kya/.test(t.label))).toBe(true);
  });

  it('keeps every tick inside the window', () => {
    const win = { centerBP: 5000, span: 4000 };
    for (const t of niceTicks(win)) {
      expect(t.yearsBP).toBeGreaterThanOrEqual(win.centerBP - win.span / 2 - 1e-6);
      expect(t.yearsBP).toBeLessThanOrEqual(win.centerBP + win.span / 2 + 1e-6);
    }
  });
});
