import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 10 (Oct 2026): region-centre pins, continued from
// batch 9. Wikidata gives only a country, province, county or region as the
// birthplace, so the pin was the middle of that region (found by
// scripts/find-region-birthplaces.mjs). Fixes and "uncertain" notes live in
// accuracy-fixes.json, so the nightly harvest cannot undo them. Checked against
// the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 10'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a region's centre to the real birthplace.
const PINS: Array<[string, string, number, number]> = [
  ['q232151', 'Melisende', 37.15, 38.7825],
  ['q317149', 'John Fisher', 53.8425, -0.4316],
  ['q25259', 'Gedun Gyatso', 29.25, 88.8833],
  ['q316661', 'Daniel Boone', 40.2981, -75.7978],
  ['q234525', 'Julia Gardiner Tyler', 41.0979, -72.1034],
  ['q288301', 'William Thomas Stead', 55.496, -1.635],
  ['q208203', 'Kim Seong-su', 35.429, 126.7035],
  ['q319678', 'Theodoros Kolokotronis', 37.2508, 21.8847],
  ['q361026', 'William Beckford', 51.5153, -0.1322],
  ['q25242', 'Dalai Lama 11 Khedrub Gyatso', 30.5653, 101.4921],
  ['q151180', 'Olive Schreiner', -30.6161, 27.1619],
  ['q316317', 'Josefa Iloilo', -17.6832, 177.3832],
  ['q557348', 'Mukhtar Auezov', 49, 79.25],
  ['q43227', 'James Hilton', 53.4975, -2.515],
  ['q259331', 'Yusof bin Ishak', 4.85, 100.7333],
  ['q333500', 'Qian Xuesen', 31.2325, 121.4692],
  ['q378425', 'Fujiwara no Teika', 35.0117, 135.7683],
  ['q336247', 'Justo José de Urquiza', -32.3851, -58.2399],
  ['q317990', 'Juan Vicente Gómez', 7.8119, -72.3653],
  ['q55234', 'Michael Powell', 51.26, 1.1413],
  ['q358051', 'Phạm Văn Đồng', 14.9515, 108.8868],
  ['q545539', 'Trường Chinh', 20.2917, 106.3339],
  ['q379232', 'Ieng Sary', 9.9369, 106.3411],
  ['q396606', 'Omar Karami', 34.4367, 35.8344],
  ['q433993', 'Samuel Wallis', 50.617, -4.683],
  ['q558794', 'Sadriddin Ayni', 40.1, 64.6667],
  ['q368862', 'Khaqani', 40.6339, 48.6392],
  ['q49979', 'Steven Runciman', 54.992, -1.706],
];

describe('people fact-check, batch 10: region-centre pins (Oct 2026)', () => {
  it('covers the batch: 28 moved pins, 2 date fixes and 48 uncertain notes from the 120 people checked', () => {
    expect(PINS.length).toBe(28);
    expect(batch.length).toBe(77);
    expect(batch.filter((id) => String(fixes[id].why).includes(', fixed:')).length).toBe(29);
    expect(batch.filter((id) => String(fixes[id].why).includes('still uncertain')).length).toBe(48);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace, not the middle of a region`, () => {
      const e = byId.get(id)!;
      expect(e.name).toBe(name);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  it('the big moves land in the right place', () => {
    // Trường Chinh: Nam Định in the north, not Quảng Ngãi.
    const tc = byId.get('q545539')!;
    expect(tc.lat).toBeGreaterThan(20);
    // Mukhtar Auezov: Kazakhstan, not the middle of the Russian Empire in Siberia.
    const ma = byId.get('q557348')!;
    expect(km(ma.lat, ma.lon, 58.65, 70.1167)).toBeGreaterThan(1000);
    // Omar Karami: Tripoli, Lebanon, not Damascus.
    const ok = byId.get('q396606')!;
    expect(km(ok.lat, ok.lon, 33.5167, 36.3)).toBeGreaterThan(100);
  });

  it('the "Born" line names the town, not just the region', () => {
    expect(byId.get('q317149')!.born).toContain('Beverley');
    expect(byId.get('q234525')!.born).toContain('Gardiners Island');
    expect(byId.get('q545539')!.born).toContain('Hành Thiện');
    expect(byId.get('q151180')!.born).toContain('Wittebergen');
  });

  it('fixes wrong death dates', () => {
    expect(byId.get('q298162')!.died).toBe('21 February 4, Limyra'); // Gaius Caesar
    expect(byId.get('q316768')!.died).toBe('22 January 1188, Benavente'); // Ferdinand II of León
  });

  it('says the birthplace is not known instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q311996')).toContain('not recorded'); // Magnus Barefoot, "Norway"
    expect(panel('q354384')).toContain('Alexandria'); // Theon: pin is Rome, the point for the Roman Empire
    expect(panel('q353547')).toContain('Lithang'); // Bogd Khan: sources differ
    expect(panel('q25248')).toContain('Lhari Gang'); // 8th Dalai Lama: village has no point
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['lat', 'lon', 'placeNote', 'born', 'died']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});
