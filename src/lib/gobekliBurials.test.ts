import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 19 Oct 2026: Göbekli Tepe's human remains — the 2017 carved skull fragments
// (Gresky, Haelm & Clare, Science Advances) and the first two intact burials
// (Gresky & Clare, PLOS One, 22 Sep 2026) — with their sources, hedged.
const site = (JSON.parse(readFileSync('public/data/ancient-sites.json', 'utf8')).sites as Array<{
  id: string; keyFacts: string[]; links: Array<{ url: string }>;
}>).find((s) => s.id === 'gobekli-tepe')!;

describe('Göbekli Tepe human remains', () => {
  it('tells of the carved skulls and the first burials, and cites both papers', () => {
    const facts = site.keyFacts.join(' ');
    expect(facts).toMatch(/2017: fragments of three skulls/);
    expect(facts).toMatch(/first two intact burials/);
    expect(facts).toMatch(/8700–8000 BCE/);
    const urls = site.links.map((l) => l.url);
    expect(urls).toContain('https://doi.org/10.1126/sciadv.1700564');
    expect(urls).toContain('https://doi.org/10.1371/journal.pone.0358979');
  });
  it('keeps the uncertain readings hedged', () => {
    const facts = site.keyFacts.join(' ');
    expect(facts).toMatch(/possible 'skull cult'/);
    expect(facts).toMatch(/still debated/);
    expect(facts).toMatch(/may have slid down/);
  });
});
