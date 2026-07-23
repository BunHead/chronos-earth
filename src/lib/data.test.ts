import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * These tests validate the bundled JSON content (loaded at runtime via fetch).
 * Reading the files directly here lets us catch malformed data and broken
 * cross-references before they ever reach the browser.
 */
const DATA = join(process.cwd(), 'public', 'data');
const read = (file: string) => JSON.parse(readFileSync(join(DATA, file), 'utf-8'));

describe('battles.json', () => {
  const { battles } = read('battles.json');

  it('has at least 40 battles', () => {
    expect(battles.length).toBeGreaterThanOrEqual(40);
  });

  it('every battle has the required fields with sane values', () => {
    for (const b of battles) {
      expect(typeof b.id).toBe('string');
      expect(typeof b.name).toBe('string');
      expect(typeof b.year).toBe('number');
      expect(b.lat).toBeGreaterThanOrEqual(-90);
      expect(b.lat).toBeLessThanOrEqual(90);
      expect(b.lon).toBeGreaterThanOrEqual(-180);
      expect(b.lon).toBeLessThanOrEqual(180);
      expect(b.belligerents.side1).toBeTruthy();
      expect(b.belligerents.side2).toBeTruthy();
      expect(Array.isArray(b.links)).toBe(true);
      expect(b.links[0].url).toMatch(/^https?:\/\//);
    }
  });

  it('has unique ids', () => {
    const ids = battles.map((b: { id: string }) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('commanders are well-formed and cover both sides', () => {
    let withCommanders = 0;
    for (const b of battles) {
      if (!b.commanders) continue;
      withCommanders++;
      const sides = new Set<number>();
      for (const c of b.commanders) {
        expect(c.name, `${b.id} commander name`).toBeTruthy();
        expect(c.wiki, `${b.id} commander wiki title`).toBeTruthy();
        expect([1, 2], `${b.id} commander side`).toContain(c.side);
        sides.add(c.side);
      }
      expect(sides.size, `${b.id} should list commanders for both sides`).toBe(2);
    }
    expect(withCommanders).toBeGreaterThanOrEqual(70);
  });
});

describe('portraits manifest', () => {
  it('exists, is well-stocked, and every listed image file is present', () => {
    const manifestPath = join(DATA, 'portraits', 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const { portraits } = read('portraits/manifest.json');
    const entries = Object.entries<{ file: string; page: string }>(portraits);
    expect(entries.length).toBeGreaterThanOrEqual(100);
    for (const [wiki, entry] of entries) {
      expect(existsSync(join(DATA, 'portraits', entry.file)), `image for ${wiki}`).toBe(true);
      expect(entry.page).toMatch(/^https:\/\/en\.wikipedia\.org\//);
    }
  });
});

describe('battle maps manifest', () => {
  it('every listed map file exists and has a credit', () => {
    const manifestPath = join(DATA, 'battlemaps', 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const { maps } = read('battlemaps/manifest.json');
    expect(Object.keys(maps).length).toBeGreaterThanOrEqual(5);
    for (const [id, m] of Object.entries<{ file: string; credit: string; page: string }>(maps)) {
      expect(existsSync(join(DATA, 'battlemaps', m.file)), `map image for ${id}`).toBe(true);
      expect(m.credit).toBeTruthy();
      expect(m.page).toMatch(/^https?:\/\//);
    }
  });
});

describe('ancient-sites.json', () => {
  const { sites } = read('ancient-sites.json');

  it('every site has required fields and at least one link', () => {
    for (const s of sites) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.builtYear).toBe('number');
      expect(s.links.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('alternative hypotheses always include a reality-check note', () => {
    for (const s of sites) {
      if (s.alternative) {
        expect(s.alternative.note.length).toBeGreaterThan(10);
        expect(s.alternative.proponent).toBeTruthy();
      }
    }
  });
});

describe('battle-views.json cross-references battles.json', () => {
  const { battles } = read('battles.json');
  const { battleViews } = read('battle-views.json');

  it('every hasBattleView battle has phase data', () => {
    for (const b of battles) {
      if (b.hasBattleView) {
        expect(battleViews[b.id], `missing battle view for ${b.id}`).toBeTruthy();
      }
    }
  });

  it('every battle gets at least four phases', () => {
    // The Captain's rule: four steps is roughly twelve hours, a single day's
    // fighting. Fewer than that and a battle is a caption, not a course —
    // deployment, the manoeuvre, the turn and the decision is the minimum
    // shape. Multi-day battles should scale up from there.
    for (const [id, view] of Object.entries<{ phases: unknown[] }>(battleViews)) {
      expect(view.phases.length, `${id} needs at least 4 phases`).toBeGreaterThanOrEqual(4);
    }
  });

  it('a view claiming real strengths gives them to every unit', () => {
    // Half a roster of strengths would silently starve the units without
    // them down to the floor, which reads as an army that was not there.
    for (const [id, view] of Object.entries<{ units: { strength?: number }[] }>(battleViews)) {
      const withStrength = view.units.filter((u) => typeof u.strength === 'number');
      if (withStrength.length === 0) continue;
      expect(withStrength.length, `${id} mixes units with and without strength`).toBe(
        view.units.length,
      );
      for (const u of withStrength) expect(u.strength).toBeGreaterThan(0);
    }
  });

  it('each unit defines a position for every phase', () => {
    for (const [id, view] of Object.entries<{ phases: unknown[]; units: { pos: unknown[] }[] }>(battleViews)) {
      const phaseCount = view.phases.length;
      expect(phaseCount, `${id} should have phases`).toBeGreaterThan(0);
      for (const unit of view.units) {
        expect(unit.pos.length, `${id} unit pos length`).toBe(phaseCount);
      }
    }
  });
});

describe('fauna.json', () => {
  const { fauna } = read('fauna.json');

  it('has a healthy roster with valid ranges and drift tracks', () => {
    expect(fauna.length).toBeGreaterThanOrEqual(20);
    for (const f of fauna) {
      expect(f.name, f.id).toBeTruthy();
      expect(f.emoji, f.id).toBeTruthy();
      expect(f.fromMa, `${f.id} fromMa older than toMa`).toBeGreaterThan(f.toMa);
      expect(f.fromMa).toBeLessThanOrEqual(250);
      expect(Array.isArray(f.track) && f.track.length >= 1, `${f.id} has a track`).toBe(true);
      for (let i = 1; i < f.track.length; i++) {
        expect(f.track[i].ma, `${f.id} track sorted`).toBeGreaterThan(f.track[i - 1].ma);
      }
      for (const p of f.track) {
        expect(Math.abs(p.lat), `${f.id} track lat`).toBeLessThanOrEqual(90);
        expect(Math.abs(p.lon), `${f.id} track lon`).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('imported events (Wikidata)', () => {
  const path = join(DATA, 'imported', 'events.json');
  const present = existsSync(path);

  it('every imported event is well-formed (when the import has been run)', () => {
    if (!present) return; // optional layer — fine if the import hasn't run yet
    const { events } = read('imported/events.json');
    expect(events.length).toBeGreaterThan(0);
    const cats = new Set(['monument', 'city', 'battle', 'disaster', 'invention', 'discovery', 'person', 'event']);
    const ids = new Set<string>();
    for (const e of events) {
      expect(typeof e.id, e.id).toBe('string');
      expect(e.name, e.id).toBeTruthy();
      expect(typeof e.startYear, e.id).toBe('number');
      // Bulk imports are floored at -12000 by the fetcher; hand-curated deep-time
      // events (Ice Age, cave art, Toba) legitimately reach back to ~-72000.
      // A HAND-CURATED event may go deeper still — the Chicxulub impact is 66
      // million years old, and the timeline runs to 250 million — but a
      // HARVESTED one may not: out there, a wild date means a parsing bug, which
      // is exactly what this guard is for.
      const floor = e.id.startsWith('cur-') ? -250_000_000 : -80_000;
      expect(e.startYear, e.id).toBeGreaterThanOrEqual(floor);
      expect(e.startYear, e.id).toBeLessThanOrEqual(new Date().getFullYear());
      if (e.endYear !== undefined) expect(e.endYear, e.id).toBeGreaterThanOrEqual(e.startYear);
      expect(Math.abs(e.lat), `${e.id} lat`).toBeLessThanOrEqual(90);
      expect(Math.abs(e.lon), `${e.id} lon`).toBeLessThanOrEqual(180);
      expect(cats.has(e.category), `${e.id} category ${e.category}`).toBe(true);
      ids.add(e.id);
    }
    expect(ids.size, 'unique ids').toBe(events.length);
  });
});

describe('reconstruction + border manifests exist', () => {
  it('paleo manifest lists frames', () => {
    expect(existsSync(join(DATA, 'paleo', 'manifest.json'))).toBe(true);
    const m = read('paleo/manifest.json');
    expect(m.frames.length).toBeGreaterThan(10);
  });

  it('borders manifest lists frames', () => {
    expect(existsSync(join(DATA, 'borders', 'manifest.json'))).toBe(true);
    const m = read('borders/manifest.json');
    expect(m.frames.length).toBeGreaterThan(10);
  });
});
