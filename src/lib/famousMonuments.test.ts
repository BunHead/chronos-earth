/**
 * The famous curated monuments carry their Wikidata id and exact P625
 * coordinates (scripts/add-curated-places.mjs, MONUMENT_FIXES), and a 3D
 * button appears only where the fleet holds an honest model for that place.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { monumentModelForName } from './panel';

type Row = { id: string; name: string; lat: number; lon: number; wikidataId?: string };
const events: Row[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;
const byId = new Map(events.map((e) => [e.id, e]));

describe('famous monuments', () => {
  it('carry Wikidata ids and P625 coordinates (spot check)', () => {
    const spot: Array<[string, string, number, number]> = [
      ['cur-great-pyramid', 'Q37200', 29.97915, 31.13422],
      ['cur-colosseum', 'Q10285', 41.89028, 12.49222],
      ['cur-angkor-wat', 'Q43473', 13.4125, 103.86667],
      ['cur-taj-mahal', 'Q9141', 27.175, 78.04194],
      ['cur-forbidden-city', 'Q80290', 39.916, 116.397], // on the palace's axis, at the Hall of Supreme Harmony
      ['cur-ahu-tongariki', 'Q3448354', -27.1258, -109.2769],
    ];
    for (const [id, qid, lat, lon] of spot) {
      const row = byId.get(id);
      expect(row, `${id} missing`).toBeTruthy();
      expect(row!.wikidataId).toBe(qid);
      expect(row!.lat).toBeCloseTo(lat, 3);
      expect(row!.lon).toBeCloseTo(lon, 3);
    }
  });

  it('get a 3D model only where one is accurate', () => {
    for (const id of ['cur-great-pyramid', 'cur-colosseum', 'cur-parthenon', 'cur-angkor-wat', 'cur-machu-picchu', 'cur-forbidden-city']) {
      expect(monumentModelForName(byId.get(id)!.name), id).not.toBeNull();
    }
    // No model in the fleet looks like these — and never the impact crater.
    for (const id of ['cur-taj-mahal', 'cur-petra', 'cur-rapa-nui', 'cur-ahu-tongariki']) {
      expect(monumentModelForName(byId.get(id)!.name), id).toBeNull();
    }
  });
});
