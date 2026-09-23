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
