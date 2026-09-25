/**
 * No two pins may be the same thing in the same place at the same time.
 *
 * WHAT WENT WRONG. The curated rows carry no `wikidataId`, and every harvester
 * deduped on the Q-id alone — so nothing the harvest found could ever match a
 * curated row. The world-monuments sweep asks for the top three monuments of
 * every country, which is exactly the set the curated rows already cover, and
 * it quietly pinned all of them a second time. Sixteen of the most famous
 * places on the site were doubled, metres apart: the Great Pyramid, the
 * Colosseum, Angkor Wat, Machu Picchu, the Taj Mahal, the Statue of Liberty,
 * the Sydney Opera House.
 *
 * THE RULE, and it is deliberately narrow. Sharing a Wikipedia article is NOT
 * on its own enough to call two rows the same pin — the dataset has honest
 * counter-examples, and each one would have been silently destroyed by a
 * sloppier rule:
 *
 *   • `cur-hiroshima-bomb` and `cur-nagasaki-bomb` both cite "Atomic bombings
 *     of Hiroshima and Nagasaki". Two cities, two bombs, 298 km apart.
 *   • `q935` is Isaac Newton the man; `cur-newton-gravity` is the publication
 *     of universal gravitation in 1687. One article, two different things.
 *   • `q7341` is the Auschwitz camp; `cur-auschwitz-liberation` is the day it
 *     was liberated. A place and an event at that place.
 *
 * So a duplicate is: same article, SAME CATEGORY, within 25 km, and within 200
 * years. Anything else stands.
 *
 * STILL OPEN, and left open on purpose — these are curation calls, not code
 * ones. Petra (499 years apart), Cusco (434), Benin City (719) and Mesa Verde
 * (1,306) each have a curated row and a harvested row a few hundred metres
 * apart that DISAGREE ABOUT THE DATE. Picking one would be inventing a date.
 * They need a human to say which is right; until then both stand.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Row {
  id: string;
  name: string;
  lat: number;
  lon: number;
  startYear: number;
  category: string;
  wikiTitle?: string;
}

const events: Row[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;

/** Rough great-circle distance in km — plenty good enough at these scales. */
function km(a: Row, b: Row): number {
  const dLat = (a.lat - b.lat) * 111;
  const dLon = (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

const SAME_PLACE_KM = 25;
const SAME_TIME_YEARS = 200;

describe('the globe never pins the same thing twice', () => {
  it('no two same-family rows share an article within 25 km and 200 years', () => {
    // CITY AND MONUMENT ARE ONE FAMILY, and that was learned the hard way.
    // Wikidata types an ancient site either way depending on who edited it, so
    // the moment the city query was widened to walk subclasses it pinned
    // Machu Picchu, Persepolis, Chichen Itza, Cahokia and Karakorum a second
    // time — each one already on the globe under the other category, so a
    // per-category check waved them all through. A place is a place.
    const family = (c: string) => (c === 'city' || c === 'monument' ? 'place' : c);
    const byArticle = new Map<string, Row[]>();
    for (const e of events) {
      if (!e.wikiTitle) continue;
      const k = `${family(e.category)}|${e.wikiTitle.toLowerCase().trim()}`;
      if (!byArticle.has(k)) byArticle.set(k, []);
      byArticle.get(k)!.push(e);
    }

    const clashes: string[] = [];
    for (const rows of byArticle.values()) {
      if (rows.length < 2) continue;
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const d = km(rows[i], rows[j]);
          const dy = Math.abs(rows[i].startYear - rows[j].startYear);
          if (d < SAME_PLACE_KM && dy <= SAME_TIME_YEARS) {
            clashes.push(
              `${rows[i].wikiTitle}: ${rows[i].id} + ${rows[j].id} ` +
                `(${d.toFixed(1)} km, ${dy} y apart)`,
            );
          }
        }
      }
    }
    expect(clashes, `duplicate pins:\n  ${clashes.join('\n  ')}`).toEqual([]);
  });

  it('keeps the honest counter-examples that a sloppier rule would delete', () => {
    const byId = new Map(events.map((e) => [e.id, e]));
    // Both bombs, both curated, one article between them.
    const hiroshima = byId.get('cur-hiroshima-bomb');
    const nagasaki = byId.get('cur-nagasaki-bomb');
    expect(hiroshima, 'cur-hiroshima-bomb missing').toBeTruthy();
    expect(nagasaki, 'cur-nagasaki-bomb missing').toBeTruthy();
    expect(km(hiroshima!, nagasaki!)).toBeGreaterThan(SAME_PLACE_KM);

    // The man and the publication — different categories, both must stand.
    const newton = byId.get('q935');
    const gravitation = byId.get('cur-newton-gravity');
    expect(newton, 'q935 (Isaac Newton the person) missing').toBeTruthy();
    expect(gravitation, 'cur-newton-gravity missing').toBeTruthy();
    expect(newton!.category).not.toBe(gravitation!.category);
  });

  it('kept the curated row, not the harvested twin, for the famous sixteen', () => {
    // The curated rows carry the better title, the notes and the headline slot.
    for (const id of [
      'cur-great-pyramid', 'cur-colosseum', 'cur-angkor-wat', 'cur-machu-picchu',
      'cur-taj-mahal', 'cur-statue-liberty', 'cur-sydney-opera', 'cur-yellowstone',
    ]) {
      expect(events.find((e) => e.id === id), `${id} should still be here`).toBeTruthy();
    }
    for (const id of ['q37200', 'q10285', 'q43473', 'q676203', 'q9141', 'q9202', 'q45178', 'q351']) {
      expect(events.find((e) => e.id === id), `${id} was a duplicate and should be gone`).toBeUndefined();
    }
  });
});

/**
 * The second way a place gets two pins: by NAME, from two different harvesters.
 *
 * The rule above matches on the shared Wikipedia article, and a Pleiades row
 * has none — no Q-id, no wiki title, nothing to match on. fetch-pleiades.mjs
 * guards its own writes spatially, but the city harvest that runs later dedupes
 * by wiki title and cannot see a Pleiades row at all. So whichever arrived
 * first stayed, and Pompeii, Cyrene, Ostia, Frankfurt, Babylon and Sparta each
 * carried a second nameless marker a few hundred metres away.
 *
 * On a globe with ten city slots at a wide view, the duplicate is a slot taken
 * from somewhere else in the world. scripts/dedupe-places.mjs is the fix.
 */
describe('one place, one pin — by name as well as by article', () => {
  const places = events.filter(
    (e) => (e.category === 'city' || e.category === 'monument') && Number.isFinite(e.lat),
  );

  it('no place carries a second pin of the same name in the same spot and era', () => {
    const cells = new Map<string, Row[]>();
    for (const e of places) {
      const k = `${Math.round(e.lat * 20)}|${Math.round(e.lon * 20)}`;
      const l = cells.get(k) ?? [];
      l.push(e);
      cells.set(k, l);
    }

    const doubled: string[] = [];
    for (const l of cells.values()) {
      for (let i = 0; i < l.length; i++) {
        for (let j = i + 1; j < l.length; j++) {
          if (String(l[i].name).trim() !== String(l[j].name).trim()) continue;
          if (km(l[i], l[j]) > 2) continue;
          // Dates far apart are a SOURCE DISAGREEMENT about one place, not a
          // duplicate to delete — Çatalhöyük is -10000 and -7499. Those are
          // reported in date-disagreements.json for curation, never resolved
          // by code, because picking one invents history to tidy the map.
          if (Math.abs((l[i].startYear ?? 0) - (l[j].startYear ?? 0)) > SAME_TIME_YEARS) continue;
          doubled.push(`${l[i].name} (${l[i].id} / ${l[j].id})`);
        }
      }
    }
    expect(doubled, `doubled pins: ${doubled.slice(0, 10).join(', ')}`).toEqual([]);
  });

  it('no pin is nameless — "Untitled" is Pleiades saying it has no name', () => {
    // 1,430 of these got in: no name, no Wikidata id, two sitelinks, and a
    // marker on the globe reading "Untitled". A pin that cannot tell you what
    // it is has nothing to offer a reader, and they crowd the Mediterranean,
    // which is already the densest part of this layer.
    const nameless = events.filter((e) => {
      const n = String(e.name ?? '').trim();
      return !n || /^untitled$/i.test(n);
    });
    expect(nameless.map((e) => e.id).slice(0, 10)).toEqual([]);
  });
});

/**
 * Same place, different name — and the opposite mistake, different things with
 * one name. See scripts/dedupe-places.mjs and scripts/disambiguate-names.mjs.
 */
describe('one place, one pin — even under two names', () => {
  const named = (n: string) => events.filter((e) => e.name === n);

  it('a World Heritage listing never stands beside the place it lists', () => {
    // "Historic Sanctuary of Machu Picchu" sat 6.7 km from Machu Picchu.
    for (const n of ['Historic Sanctuary of Machu Picchu', 'Historic City of Sucre', 'Old City of Zamość', 'archaeological Site of Delphi']) {
      expect(named(n), `${n} is back`).toEqual([]);
    }
  });

  it('a listing never lends the place its inscription date', () => {
    // Wikidata dates "Archaeological Site of Delphi" by UNESCO inscription:
    // 1987. Merged the ordinary way, Delphi would have moved to 1987.
    // The Greek one only: the harvest rightly has Delphi, Indiana (1828) too.
    const delphi = events.filter((e) => e.name === 'Delphi' && e.category !== 'person'
      && Math.abs(e.lat - 38.48) < 0.5 && Math.abs(e.lon - 22.5) < 0.5);
    expect(delphi.length).toBeGreaterThan(0);
    for (const d of delphi) expect(d.startYear).toBeLessThan(0);
  });

  it('a region is not a second copy of its city', () => {
    expect(named('Kyoto Prefecture')).toEqual([]);
  });
});

describe('different things with one label are told apart, not deleted', () => {
  it('both battles of Canton (1841) and of Thessalonica (1040) survive, by their own names', () => {
    // They LOOKED doubled: identical labels, same spot, same year. They are two
    // battles each, and deleting one would have erased a real battle.
    const names = new Set(events.map((e) => e.name));
    for (const n of ['Battle of Canton (March 1841)', 'Battle of Canton (May 1841)',
      'Battle of Thessalonica (1040)', 'Battle of Thessalonica (2nd 1040)']) {
      expect(names.has(n), `${n} missing`).toBe(true);
    }
  });
});
