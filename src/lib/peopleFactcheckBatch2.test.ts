import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineEvent } from './types';
import { eventToPanel } from './panel';

// People fact-check, batch 2 (Oct 2026): the 150 most notable people the first
// fact-check left as doubtful, checked by hand against Wikidata (P569, P570,
// P19 + P625). Fixes and "uncertain" notes live in accuracy-fixes.json, so the
// nightly harvest cannot undo them. Checked against the real shipped data.
const read = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
const events = read('public/data/imported/events.json').events as TimelineEvent[];
const byId = new Map(events.map((e) => [e.id, e]));
const fixes = read('scripts/data/accuracy-fixes.json').fixes as Record<string, Record<string, unknown>>;
const batch = Object.keys(fixes).filter((id) => String(fixes[id].why).startsWith('People fact-check batch 2'));

const km = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// [id, name, lat, lon] — pins moved from a country/region centre or the wrong town.
const PINS: Array<[string, string, number, number]> = [
  ['q296898', 'George Washington Carver', 36.9944, -94.3139], // Diamond, Missouri — was the middle of the USA
  ['q236017', 'Jiang Qing', 36.0, 119.4167], // Zhucheng — was the middle of China
  ['q154448', 'Victor Vasarely', 46.0708, 18.2331], // Pécs — was the middle of Hungary
  ['q210069', 'Milton Obote', 1.7398, 32.395], // Akokoro — was the middle of Uganda
  ['q162296', 'Robert Clive', 52.9177, -2.53], // Styche Hall — was the middle of Shropshire
  ['q273051', 'Savimbi', -12.16, 18.5534], // Munhango — was the middle of Moxico
  ['q347891', 'Chamfort', 45.7797, 3.0869], // Clermont-Ferrand — was Clermont (Oise)
  ['q295919', 'Sam Cooke', 34.2006, -90.5702], // Clarksdale — was Chicago
  ['q271532', 'John Sulston', 51.561, -0.558], // Fulmer — was Cambridge
  ['q211356', 'Isaac Levitan', 54.6389, 22.7556], // Kybartai — was Kėdainiai
  ['q41980', 'Democritus', 40.9337, 24.9733], // Abdera — was Miletus
  ['q158825', 'Jeremiah', 31.8141, 35.2647], // Anathoth — was Egypt
  ['q7333', 'Zheng He', 24.667, 102.601], // Kunyang — was central Kunming
  ['q466330', 'Meera', 26.45, 74.25], // Kudki — was Merta
  ['q125133', 'Víctor Jara', -36.7998, -72.0304], // San Ignacio — was Lonquén
];

// [id, name, startYear, endYear] — wrong birth / death years.
const YEARS: Array<[string, string, number, number]> = [
  ['q8739', 'Archimedes', -287, -212],
  ['q360512', 'Baltasar Gracián', 1601, 1658],
  ['q288441', 'Ramana Maharshi', 1879, 1950],
  ['q150712', 'Charles the Fat', 839, 888],
  ['q347891', 'Chamfort', 1741, 1794],
  ['q183528', 'Philip Johnson', 1906, 2005],
  ['q84497471', 'Li Wenliang', 1986, 2020],
  ['q205485', 'George Vancouver', 1757, 1798],
  ['q229162', 'Elena Ceaușescu', 1916, 1989],
  ['q219572', 'Marie Tussaud', 1761, 1850],
  ['q76975', 'Rudolf Höss', 1901, 1947],
  ['q315017', 'Sadegh Hedayat', 1903, 1951],
  ['q81627', 'al-Jazari', 1136, 1206],
  ['q171520', 'Urban III', 1120, 1187],
  ['q167610', 'Eugene III', 1080, 1153],
  ['q219484', 'Theocritus', -300, -260],
  ['q242270', 'Hecataeus', -550, -476],
];

describe('people fact-check, batch 2 (Oct 2026)', () => {
  it('covers the batch: fixes and uncertain notes for 110 of the 150 people checked', () => {
    expect(batch.length).toBe(110);
  });

  for (const [id, name, lat, lon] of PINS) {
    it(`${name} is pinned at the birthplace`, () => {
      const e = byId.get(id)!;
      expect(e.name).toContain(name.split(' ').pop()!);
      expect(km(e.lat, e.lon, lat, lon)).toBeLessThan(1);
    });
  }

  for (const [id, name, start, end] of YEARS) {
    it(`${name} has the right years`, () => {
      const e = byId.get(id)!;
      expect(e.startYear, id).toBe(start);
      expect(e.endYear, id).toBe(end);
    });
  }

  it('no one in the batch is shown being born after they died', () => {
    for (const id of batch) {
      const e = byId.get(id)!;
      if (e.endYear != null) expect(e.startYear, id).toBeLessThan(e.endYear);
    }
  });

  it('says "not certain" in the panel where sources still differ, instead of guessing', () => {
    const panel = (id: string) => JSON.stringify(eventToPanel(byId.get(id)!));
    expect(panel('q9333')).toContain('legendary'); // Laozi
    expect(panel('q43423')).toContain('Phrygia'); // Aesop's birthplace
    expect(panel('q184906')).toContain('1902'); // Nâzım Hikmet, 1901 or 1902
    expect(panel('q193678')).toContain('placeholder'); // Olybrius, died 472, "born 500"
    expect(panel('q179577')).toContain('Cusco'); // Atahualpa, Quito or Cusco
  });

  it('every batch entry cites its Wikidata page and is applied to the data', () => {
    for (const id of batch) {
      const fix = fixes[id];
      expect(String(fix.source), id).toContain(`https://www.wikidata.org/wiki/${id.toUpperCase()}`);
      const e = byId.get(id) as unknown as Record<string, unknown>;
      for (const k of ['lat', 'lon', 'startYear', 'endYear', 'placeNote', 'dateNote']) {
        if (fix[k] != null) expect(e[k], `${id} ${k}`).toBe(fix[k]);
      }
    }
  });
});
