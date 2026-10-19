/**
 * The 19 Oct 2026 batch: six human relatives younger than 2 Ma
 * (scripts/add-prehistoric-animals.mjs) and six fossil sites
 * (scripts/add-fossil-sites.mjs). Their Q-ids are new to the globe, their
 * points are sane, their ages run older -> younger, and each animal is in
 * fauna.json standing still at its find site.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_ANIMALS } from '../../scripts/add-prehistoric-animals.mjs';
import { FOSSIL_SITES } from '../../scripts/add-fossil-sites.mjs';

interface Animal {
  id: string;
  wikidata: string;
  locality: string;
  lat: number;
  lon: number;
  fromMa: number;
  toMa: number;
  track?: { ma: number; lon: number; lat: number }[];
}
interface Site {
  id: string;
  wikidataId: string;
  lat: number;
  lon: number;
  startYear: number;
}

const ANIMAL_IDS = ['homo-naledi', 'homo-floresiensis', 'homo-luzonensis', 'homo-antecessor',
  'homo-heidelbergensis', 'homo-rhodesiensis'];
const SITE_IDS = ['olduvai', 'zhoukoudian', 'rising-star', 'liang-bua', 'dinosaur-cove', 'wadi-al-hitan']
  .map((s) => `cur-fossil-${s}`);

const root = join(__dirname, '..', '..', 'public', 'data');
const fauna: (Animal & { wikidata?: string })[] = JSON.parse(readFileSync(join(root, 'fauna.json'), 'utf8')).fauna;
const events: { id: string; wikidataId?: string }[] =
  JSON.parse(readFileSync(join(root, 'imported', 'events.json'), 'utf8')).events;
const animals = (NEW_ANIMALS as Animal[]).filter((a) => ANIMAL_IDS.includes(a.id));
const sites = (FOSSIL_SITES as Site[]).filter((s) => SITE_IDS.includes(s.id));

describe('prehistoric batch of 19 Oct 2026', () => {
  it('lists every animal and site', () => {
    expect(animals.map((a) => a.id).sort()).toEqual([...ANIMAL_IDS].sort());
    expect(sites.map((s) => s.id).sort()).toEqual([...SITE_IDS].sort());
  });

  it('Q-ids are unique, and no other pin on the globe has them', () => {
    const qids = [...animals.map((a) => a.wikidata), ...sites.map((s) => s.wikidataId)];
    expect(new Set(qids).size).toBe(qids.length);
    for (const s of sites) {
      expect(events.filter((e) => e.wikidataId === s.wikidataId).map((e) => e.id), s.id).toEqual([s.id]);
    }
    for (const a of animals) {
      expect(fauna.filter((f) => f.wikidata === a.wikidata).map((f) => f.id), a.id).toEqual([a.id]);
    }
  });

  it('points are sane: on the planet, not 0,0', () => {
    for (const p of [...animals, ...sites]) {
      expect(Math.abs(p.lat), p.id).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon), p.id).toBeLessThanOrEqual(180);
      expect(p.lat === 0 && p.lon === 0, p.id).toBe(false);
    }
  });

  it('ages run older -> younger, all under 2 Ma, and the find year is in the past', () => {
    for (const a of animals) {
      expect(a.fromMa, a.id).toBeGreaterThan(a.toMa);
      expect(a.toMa, a.id).toBeGreaterThan(0);
      expect(a.fromMa, a.id).toBeLessThan(2);
    }
    for (const s of sites) {
      expect(s.startYear, s.id).toBeGreaterThan(1800);
      expect(s.startYear, s.id).toBeLessThanOrEqual(2026);
    }
  });

  it('each animal is in fauna.json, standing still at its find site', () => {
    for (const a of animals) {
      const row = fauna.find((f) => f.id === a.id);
      expect(row, a.id).toBeDefined();
      expect(row!.track?.map((p) => p.ma), a.id).toEqual([a.toMa, a.fromMa]);
      for (const p of row!.track!) expect([p.lat, p.lon], a.id).toEqual([a.lat, a.lon]);
    }
  });
});
