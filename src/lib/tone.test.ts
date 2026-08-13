/**
 * The rule these tests exist to enforce: a tone may change HOW something is
 * said, never WHAT is said. Every date, number and proper noun must survive
 * every transform intact.
 */
import { describe, expect, it } from 'vitest';
import { applyTone, TONES, isToneId, DEFAULT_TONE } from './tone';
import type { PanelContent } from './types';

const panel: PanelContent = {
  kicker: '🏛️ Ancient monument',
  title: 'Stonehenge',
  date: '3000 BCE',
  summary:
    'The monument was constructed in approximately 3000 BCE by numerous people who ' +
    'previously inhabited the plain, and the sarsens were subsequently raised, ' +
    'although the bluestones had already been dragged 250 km from Wales.',
  sections: [
    {
      heading: '⭐ Why it matters',
      body: 'Excavations established a significant alignment on the solstice sunrise.',
      bullets: ['Built about 2500 BCE', 'Utilised for over 1,500 years'],
    },
  ],
};

describe('tone — the facts survive every register', () => {
  const facts = ['Stonehenge', 'Wales', '3000', '250', '2500', '1,500'];

  for (const tone of TONES.map((t) => t.id)) {
    it(`keeps every date, number and name in ${tone}`, () => {
      const out = applyTone(panel, tone);
      const all = JSON.stringify(out);
      for (const fact of facts) expect(all).toContain(fact);
      // A name is a name in any voice.
      expect(out.title).toBe('Stonehenge');
    });
  }

  it('never drops a clause when shortening — Wales survives the split', () => {
    const out = applyTone(panel, 'casual');
    expect(out.summary).toContain('Wales');
    expect(out.summary).toContain('bluestones');
  });
});

describe('tone — explorer is the identity', () => {
  it('returns the very same object, so the default reader pays nothing', () => {
    expect(applyTone(panel, 'explorer')).toBe(panel);
  });
});

describe('tone — scholar', () => {
  it('strips decoration and puts the date in front', () => {
    const out = applyTone(panel, 'scholar');
    expect(out.kicker).toBe('3000 BCE · Ancient monument');
    expect(out.sections![0].heading).toBe('Why it matters');
    expect(out.kicker).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('leaves the prose itself alone — it only removes ornament', () => {
    const out = applyTone(panel, 'scholar');
    expect(out.summary).toContain('approximately');
    expect(out.summary).toContain('subsequently');
  });
});

describe('tone — casual', () => {
  it('swaps long words for short ones', () => {
    const out = applyTone(panel, 'casual');
    expect(out.summary).toContain('about');
    expect(out.summary).toContain('built');
    expect(out.summary).not.toContain('approximately');
    expect(out.summary).not.toContain('subsequently');
  });

  it('breaks a long sentence into shorter ones', () => {
    const out = applyTone(panel, 'casual');
    const longest = Math.max(
      ...out.summary!.split(/(?<=[.!?])\s+/).map((s) => s.split(/\s+/).length),
    );
    expect(longest).toBeLessThan(panel.summary!.split(/\s+/).length);
    expect(out.summary!.split(/(?<=[.!?])\s+/).length).toBeGreaterThan(1);
  });

  it('keeps the emoji — friendliness is the point here', () => {
    expect(applyTone(panel, 'casual').kicker).toContain('🏛️');
  });

  it('does not soften what happened', () => {
    const grim: PanelContent = {
      kicker: 'Battle',
      title: 'Siege',
      summary: 'The city was destroyed and its people were killed.',
    };
    const out = applyTone(grim, 'casual');
    expect(out.summary).toContain('destroyed');
    expect(out.summary).toContain('killed');
  });
});

describe('tone — the stored choice', () => {
  it('recognises only real tones', () => {
    expect(isToneId('scholar')).toBe(true);
    expect(isToneId('nonsense')).toBe(false);
    expect(isToneId(null)).toBe(false);
    expect(TONES.some((t) => t.id === DEFAULT_TONE)).toBe(true);
  });
});
