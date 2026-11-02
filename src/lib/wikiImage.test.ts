import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clearWikiSummaryCache,
  fetchWikiSummary,
  parseWikiSummary,
  wikiImageTitleFor,
  wikiPageUrl,
  wikiSummaryUrl,
  wikiTitleFromUrl,
} from './wikiImage';

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe('wikiTitleFromUrl', () => {
  it('reads an English Wikipedia article title', () => {
    expect(wikiTitleFromUrl('https://en.wikipedia.org/wiki/Argentinosaurus')).toBe('Argentinosaurus');
    expect(wikiTitleFromUrl('https://en.wikipedia.org/wiki/Battle_of_Moh%C3%A1cs#Aftermath')).toBe('Battle of Mohács');
  });
  it('ignores other sites and other languages', () => {
    expect(wikiTitleFromUrl('https://www.wikidata.org/wiki/Q123')).toBeNull();
    expect(wikiTitleFromUrl('https://fr.wikipedia.org/wiki/Rome')).toBeNull();
    expect(wikiTitleFromUrl('https://example.com/')).toBeNull();
  });
});

describe('wikiImageTitleFor', () => {
  it('prefers wikiTitle', () => {
    expect(wikiImageTitleFor({ wikiTitle: 'Tyrannosaurus', links: [{ label: 'x', url: 'https://en.wikipedia.org/wiki/Other' }] })).toBe('Tyrannosaurus');
  });
  it('falls back to the first Wikipedia link (a fossil panel with only a link)', () => {
    expect(
      wikiImageTitleFor({
        links: [
          { label: 'DB', url: 'https://paleobiodb.org/x' },
          { label: 'Wikipedia: Argentinosaurus', url: 'https://en.wikipedia.org/wiki/Argentinosaurus' },
        ],
      }),
    ).toBe('Argentinosaurus');
  });
  it('is null with no Wikipedia link, or when a real image is already shown', () => {
    expect(wikiImageTitleFor({})).toBeNull();
    expect(wikiImageTitleFor({ links: [{ label: 'x', url: 'https://example.com' }] })).toBeNull();
    expect(
      wikiImageTitleFor({ wikiTitle: 'Map', realImage: { wikiTitle: 'Map', caption: 'c', licence: 'l' } as never }),
    ).toBeNull();
  });
});

describe('parseWikiSummary', () => {
  it('takes the thumbnail and extract', () => {
    expect(parseWikiSummary({ extract: 'Hi', thumbnail: { source: 'https://thumb.wikimedia.org/a.png' } })).toEqual({
      extract: 'Hi',
      thumb: 'https://thumb.wikimedia.org/a.png',
    });
  });
  it('gives no picture when there is none, or it is not https', () => {
    expect(parseWikiSummary({ extract: 'Hi' }).thumb).toBeUndefined();
    expect(parseWikiSummary({ thumbnail: { source: 'http://x/a.png' } }).thumb).toBeUndefined();
    expect(parseWikiSummary(null)).toEqual({ extract: undefined, thumb: undefined });
  });
});

describe('urls', () => {
  it('builds the REST and page urls', () => {
    expect(wikiSummaryUrl('Argentinosaurus')).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Argentinosaurus');
    expect(wikiSummaryUrl('Battle of Mohács')).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Battle_of_Moh%C3%A1cs');
    expect(wikiPageUrl('Tyrannosaurus rex')).toBe('https://en.wikipedia.org/wiki/Tyrannosaurus_rex');
  });
});

describe('fetchWikiSummary', () => {
  beforeEach(() => clearWikiSummaryCache());

  it('returns the picture and caches the answer', async () => {
    const f = vi.fn(() => ok({ extract: 'A titanosaur', thumbnail: { source: 'https://thumb.wikimedia.org/a.png' } }));
    const a = await fetchWikiSummary('Argentinosaurus', f as never);
    const b = await fetchWikiSummary('Argentinosaurus', f as never);
    expect(a.thumb).toBe('https://thumb.wikimedia.org/a.png');
    expect(b).toEqual(a);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('shows nothing (rejects) offline or on a 404, and retries next time', async () => {
    const bad = vi.fn(() => Promise.reject(new TypeError('offline')));
    await expect(fetchWikiSummary('Trilobite', bad as never)).rejects.toBeDefined();
    const notFound = vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response));
    await expect(fetchWikiSummary('Trilobite', notFound as never)).rejects.toBeDefined();
    const good = vi.fn(() => ok({ thumbnail: { source: 'https://thumb.wikimedia.org/t.png' } }));
    expect((await fetchWikiSummary('Trilobite', good as never)).thumb).toBe('https://thumb.wikimedia.org/t.png');
  });

  it('a page with no image resolves with no thumb', async () => {
    const f = vi.fn(() => ok({ extract: 'Text only' }));
    expect((await fetchWikiSummary('No Image Page', f as never)).thumb).toBeUndefined();
  });
});

describe('creature panels', () => {
  it('every creature has a Wikipedia title, so the panel can fetch its picture', () => {
    const d = JSON.parse(readFileSync('public/data/fauna.json', 'utf8')) as Record<string, unknown>;
    const list = Object.values(d).find(Array.isArray) as { name: string; wiki?: string }[];
    expect(list.length).toBeGreaterThan(100);
    for (const f of list) expect(f.wiki, f.name).toBeTruthy();
  });
  it('the creature panel passes its wiki title (keeps its own blurb)', () => {
    const src = readFileSync('src/components/fauna.ts', 'utf8');
    expect(src).toMatch(/wikiTitle: entry\.wiki,\s*\n\s*summaryChecked: true/);
  });
});
