/**
 * Late October 2026 discoveries (scripts/add-discoveries-oct-2026b.mjs, the
 * three new dinosaurs in scripts/add-dinosaurs.mjs and the Denisova Cave and
 * Hell Creek lines in scripts/add-fossil-sites.mjs), plus the Don Walsh
 * birthplace fix in scripts/data/accuracy-fixes.json.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_PINS, NOTES } from '../../scripts/add-discoveries-oct-2026b.mjs';
import { HAND_PLACED } from '../../scripts/add-dinosaurs.mjs';

interface Row {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  startYear: number;
  wikidataId?: string;
  dateNote?: string;
  sourceUrl?: string;
  born?: string;
  birthplaceApprox?: string;
}

const root = join(__dirname, '..', '..');
const data = join(root, 'public', 'data');
const events: Row[] = JSON.parse(readFileSync(join(data, 'imported', 'events.json'), 'utf8')).events;
const fauna: (Row & { fromMa: number; toMa: number; track: { ma: number }[] })[] =
  JSON.parse(readFileSync(join(data, 'fauna.json'), 'utf8')).fauna;
const byId = new Map(events.map((e) => [e.id, e]));

describe('late October 2026 discoveries', () => {
  it('pins Xujiayao and the Saqqara tombs, once each, with their sources', () => {
    const want: Record<string, [string, number, number]> = {
      'cur-find-xujiayao': ['Q10887280', 40.1007, 113.97817], // the site's Wikidata P625
      'cur-find-saqqara-sabu': ['Q192134', 29.8745, 31.215], // by the mastaba of Ti: no published point
    };
    expect((NEW_PINS as Row[]).map((p) => p.id).sort()).toEqual(Object.keys(want).sort());
    for (const [id, [qid, lat, lon]] of Object.entries(want)) {
      const row = byId.get(id);
      expect(row, id).toBeDefined();
      expect([row!.wikidataId, row!.lat, row!.lon, row!.category, row!.startYear], id)
        .toEqual([qid, lat, lon, 'discovery', 2026]);
      expect(events.filter((e) => e.wikidataId === qid).map((e) => e.id), id).toEqual([id]);
      expect(row!.sourceUrl, id).toMatch(/^https:\/\//);
    }
    expect(byId.get('cur-find-xujiayao')!.sourceUrl).toBe('https://www.nature.com/articles/s41586-026-11132-z');
    expect(byId.get('cur-find-saqqara-sabu')!.dateNote).toMatch(/exact spot is not published/);
  });

  it('hedges the claims as the sources do', () => {
    expect(byId.get('cur-find-xujiayao')!.dateNote).toMatch(/may be Denisovan too; that is not yet shown/);
    expect(byId.get('cur-terracotta-army')!.dateNote).toMatch(/suggests women and teenage apprentices/);
    expect(byId.get('cur-terracotta-army')!.dateNote).toMatch(/counts prints, not people/);
  });

  it('adds each one-line note, with its source, exactly once', () => {
    for (const n of NOTES as { id: string; note: string; sourceUrl: string }[]) {
      const row = byId.get(n.id);
      expect(row, n.id).toBeDefined();
      expect(row!.dateNote!.split(n.note).length - 1, n.id).toBe(1);
      expect(row!.sourceUrl, n.id).toBe(n.sourceUrl);
    }
    const names = Object.fromEntries((NOTES as { id: string }[]).map((n) => [n.id, byId.get(n.id)!.name]));
    expect(names).toEqual({
      q107344401: 'Harbin cranium',
      'cur-terracotta-army': 'Terracotta Army',
      q22647: 'Troy',
      pl707596: '(Palai)Paphos',
      pl517771600: 'Metsamor',
    });
  });

  it('names Xujiayao on the Denisova Cave panel and Infernogallus on Hell Creek', () => {
    expect(byId.get('cur-fossil-denisova')!.dateNote).toMatch(/Xujiayao/);
    expect(byId.get('cur-fossil-denisova')!.sourceUrl).toMatch(/nature\.com/);
    expect(byId.get('cur-fossil-hell-creek')!.dateNote).toMatch(/Infernogallus jamesi/);
    expect(byId.get('cur-fossil-hell-creek')!.sourceUrl).toMatch(/eurekalert\.org/);
  });

  it('puts the three new dinosaurs where they were found, with sources', () => {
    const want: Record<string, [number, number]> = {
      infernogallus: [46.02, -104.48], // Hell Creek, Montana
      paludohadros: [51.1243, -0.4115], // Smokejack Clay Pit, Surrey
      rinconraptor: [-37.71, -69.33], // Cerro Overo, Neuquén
    };
    const ids = HAND_PLACED.map((a: { id: string }) => a.id);
    for (const [id, [lat, lon]] of Object.entries(want)) {
      expect(ids, id).toContain(id);
      const a = fauna.filter((f) => f.id === id);
      expect(a.length, id).toBe(1);
      expect([a[0].lat, a[0].lon], id).toEqual([lat, lon]);
      expect(a[0].fromMa, id).toBeGreaterThan(a[0].toMa);
      expect(a[0].track.map((p) => p.ma), id).toEqual([a[0].toMa, a[0].fromMa]);
      expect(a[0].sourceUrl, id).toMatch(/^https:\/\//);
    }
  });
});

describe('Don Walsh birthplace', () => {
  const fixes = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'accuracy-fixes.json'), 'utf8')).fixes;

  it('is pinned in Berkeley, California, not the middle of Uruguay', () => {
    const row = byId.get('q714483')!;
    expect(row.name).toBe('Don Walsh');
    expect([row.lat, row.lon]).toEqual([37.8716, -122.2727]);
    expect(row.born).toBe('2 November 1931, Berkeley, California');
    expect(fixes.q714483.source).toMatch(/wikipedia\.org\/wiki\/Don_Walsh/);
  });

  it('is never flagged as born somewhere in a region', () => {
    expect(byId.get('q714483')!.birthplaceApprox).toBeUndefined();
    // When the region-birthplace list lands (PR #106), a row in
    // accuracy-fixes.json is never flagged, whichever merges first.
    const file = join(root, 'scripts', 'data', 'region-birthplaces.json');
    if (existsSync(file)) {
      const flagged = JSON.parse(readFileSync(file, 'utf8')).people;
      if ('q714483' in flagged) expect('q714483' in fixes).toBe(true);
    }
  });
});
