/**
 * Data batch 2026-10b (scripts/add-data-batch-2026-10b.mjs): battles, people,
 * discoveries and states for the thin parts of the globe. The batch file holds
 * what Wikidata said when it was added; this checks events.json still carries
 * each row once, with sane dates, a source, and a pin in the right country.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Row {
  id: string;
  name: string;
  startYear: number;
  endYear?: number;
  lat: number;
  lon: number;
  category: string;
  wikidataId: string;
  wikiTitle: string;
  sourceUrl: string;
  sides?: string[];
  result?: string;
  country: string;
}
interface State {
  wikidataId: string;
  name: string;
  from: number;
  to: number;
  capitalQid: string;
  capitalName: string;
  lat: number;
  lon: number;
  sourceUrl: string;
  country: string;
}
interface Event {
  id: string;
  name: string;
  category: string;
  startYear: number;
  lat: number;
  lon: number;
  wikidataId?: string;
  wikiTitle?: string;
  capitalOf?: { of: string; from: number | null; to: number | null }[];
}

const root = join(__dirname, '..', '..');
const batch = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'data-batch-2026-10b.json'), 'utf8')) as {
  battles: Row[];
  people: Row[];
  discoveries: Row[];
  states: State[];
};
const events: Event[] = JSON.parse(readFileSync(join(root, 'public', 'data', 'imported', 'events.json'), 'utf8')).events;
const battlesJson: { name: string; links?: { url: string }[] }[] = JSON.parse(
  readFileSync(join(root, 'public', 'data', 'battles.json'), 'utf8'),
).battles;

const rows = [...batch.battles, ...batch.people, ...batch.discoveries];
const key = (s: string | undefined) =>
  String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// [Q-id, country, lat min, lat max, lon min, lon max] — rough country boxes.
const SPOT: [string, string, number, number, number, number][] = [
  ['Q4870293', 'Ghana', 4.5, 11.2, -3.3, 1.2], // Battle of Amoaful
  ['Q4870242', 'Philippines', 4.5, 21.2, 116.9, 126.7], // Battle of Alapan
  ['Q4872293', 'Peru', -18.4, 0, -81.4, -68.6], // Battle of Sangarará
  ['Q949495', 'New Zealand', -47.4, -34.3, 166, 178.6], // Battle of Ōhaeawai
  ['Q4871927', 'United States', 18.9, 22.3, -160.3, -154.8], // Battle of Nuʻuanu (Hawaiʻi)
  ['Q60429', 'India', 6.5, 35.7, 68, 97.4], // C. V. Raman
  ['Q1373764', 'Indonesia', -11, 6, 95, 141], // Kartini
  ['Q554264', 'Cuba', 19.8, 23.3, -85, -74.1], // Antonio Maceo
  ['Q1315748', 'Chad', 7.4, 23.5, 13.5, 24], // Toumaï
  ['Q672146', 'Tanzania', -11.8, -1, 29.3, 40.5], // Laetoli
];

describe('data batch 2026-10b', () => {
  it('has the expected size', () => {
    expect(batch.battles.length).toBeGreaterThanOrEqual(40);
    expect(batch.people.length).toBeGreaterThanOrEqual(30);
    expect(batch.discoveries.length).toBeGreaterThanOrEqual(10);
    expect(batch.states.length).toBeLessThanOrEqual(10);
  });

  it('uses each Q-id once', () => {
    const qids = [...rows.map((r) => r.wikidataId), ...batch.states.map((s) => s.wikidataId)];
    expect(new Set(qids).size).toBe(qids.length);
    for (const q of qids) expect(q).toMatch(/^Q\d+$/);
  });

  it('every row is in events.json exactly once, and nowhere twice', () => {
    for (const r of rows) {
      const byQ = events.filter((e) => e.wikidataId === r.wikidataId);
      expect(byQ.length, r.wikidataId).toBe(1);
      expect(byQ[0].id).toBe(r.id);
      // No other row of the same kind under the same name (curated rows have no Q-id).
      const byName = events.filter(
        (e) => e.category === r.category && (key(e.name) === key(r.name) || key(e.wikiTitle) === key(r.wikiTitle)),
      );
      expect(byName.map((e) => e.id), r.name).toEqual([r.id]);
    }
  });

  it('never repeats a battle already in battles.json', () => {
    const curated = new Set(battlesJson.map((b) => key(b.name)));
    const curatedQ = new Set(battlesJson.flatMap((b) => (b.links ?? []).map((l) => l.url.split('/').pop())));
    for (const b of batch.battles) {
      expect(curated.has(key(b.name)), b.name).toBe(false);
      expect(curatedQ.has(b.wikidataId), b.wikidataId).toBe(false);
    }
  });

  it('has sane dates', () => {
    for (const r of rows) {
      expect(Number.isInteger(r.startYear), r.name).toBe(true);
      expect(r.startYear, `${r.name}: there is no year 0`).not.toBe(0);
      expect(r.startYear).toBeLessThanOrEqual(2026);
    }
    for (const b of batch.battles) expect(b.startYear).toBeGreaterThan(-3000);
    for (const p of batch.people) {
      expect(p.startYear).toBeGreaterThan(1000);
      if (p.endYear !== undefined) {
        expect(p.endYear - p.startYear, p.name).toBeGreaterThan(10);
        expect(p.endYear - p.startYear, p.name).toBeLessThan(110);
      }
    }
    for (const d of batch.discoveries) expect(d.startYear).toBeGreaterThanOrEqual(1900);
    for (const s of batch.states) {
      expect(s.to, s.name).toBeGreaterThan(s.from);
      expect(s.from).not.toBe(0);
    }
  });

  it('carries a source and, for battles, both sides and a result', () => {
    for (const r of rows) expect(r.sourceUrl, r.name).toMatch(/^https:\/\/(en\.wikipedia\.org\/wiki\/|doi\.org\/10\.)/);
    for (const d of batch.discoveries) expect(d.sourceUrl, d.name).toMatch(/^https:\/\/doi\.org\/10\./);
    for (const s of batch.states) expect(s.sourceUrl).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    for (const b of batch.battles) {
      expect(b.sides?.length, b.name).toBe(2);
      expect(b.result, b.name).toBeTruthy();
    }
  });

  it('no pin sits on a whole-degree guess', () => {
    for (const r of rows) expect(Number.isInteger(r.lat) && Number.isInteger(r.lon), r.name).toBe(false);
  });

  it.each(SPOT)('%s lands inside %s', (qid, country, la0, la1, lo0, lo1) => {
    const r = rows.find((x) => x.wikidataId === qid)!;
    expect(r, qid).toBeDefined();
    expect(r.country).toBe(country);
    const e = events.find((x) => x.wikidataId === qid)!;
    expect(e.lat).toBeGreaterThanOrEqual(la0);
    expect(e.lat).toBeLessThanOrEqual(la1);
    expect(e.lon).toBeGreaterThanOrEqual(lo0);
    expect(e.lon).toBeLessThanOrEqual(lo1);
  });

  it('puts each state on its capital as a capitalOf role', () => {
    for (const s of batch.states) {
      const cities = events.filter(
        (e) => e.category === 'city' && (e.capitalOf ?? []).some((r) => r.of === s.name && r.from === s.from && r.to === s.to),
      );
      expect(cities.length, s.name).toBe(1);
      const c = cities[0];
      expect(Math.abs(c.lat - s.lat) < 0.1 && Math.abs(c.lon - s.lon) < 0.1, `${s.name} capital ${c.name}`).toBe(true);
    }
  });
});
