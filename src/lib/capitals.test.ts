/**
 * Capitals, and the handovers that are the point of having them.
 *
 * The Captain asked for three things: major cities to be more prominent,
 * capitals to look different, and the moment a capital CHANGES to be visible —
 * "Kyoto to Tokyo, Philadelphia to Washington DC". These tests hold all three
 * to the real shipped data, because a capital layer that is right in the unit
 * tests and wrong about Kyoto is worth nothing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  capitalAt, capitalChangeAt, isCapitalRow, isPlaceRow, cityProminence, CHANGE_WINDOW_YEARS,
  type CapitalRole,
} from './capitals';
import type { TimelineEvent } from './types';

const events: TimelineEvent[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'imported', 'events.json'), 'utf8'),
).events;

const city = (name: string) =>
  events.find((e) => e.name === name && e.category === 'city' &&
    (e as TimelineEvent & { capitalOf?: CapitalRole[] }).capitalOf);

const make = (capitalOf: CapitalRole[], notability = 100): TimelineEvent =>
  ({ id: 'x', name: 'X', startYear: 0, lat: 0, lon: 0, category: 'city', notability, capitalOf } as
    TimelineEvent & { capitalOf: CapitalRole[] });

describe('holding the role', () => {
  it('holds it between from and to', () => {
    const e = make([{ of: 'Japan', from: 794, to: 1869 }]);
    expect(capitalAt(e, 700)).toBeNull();
    expect(capitalAt(e, 794)?.of).toBe('Japan');
    expect(capitalAt(e, 1500)?.of).toBe('Japan');
    expect(capitalAt(e, 1869)?.of).toBe('Japan'); // the last year still counts
    expect(capitalAt(e, 1870)).toBeNull();
  });

  it('treats a null `to` as "still", and a null `from` as "whenever it existed"', () => {
    expect(capitalAt(make([{ of: 'France', from: 987, to: null }]), 2026)?.of).toBe('France');
    expect(capitalAt(make([{ of: 'Egypt', from: null, to: null }]), -2000)?.of).toBe('Egypt');
  });

  it('an undated role is NOT a change — inventing a year to earn a glow is inventing history', () => {
    expect(capitalChangeAt(make([{ of: 'Egypt', from: null, to: null }]), 1000)).toBeNull();
  });
});

describe('the handover', () => {
  it('fires on both gaining and losing, within the window', () => {
    const e = make([{ of: 'United States', from: 1790, to: 1800 }]);
    expect(capitalChangeAt(e, 1790)).toMatchObject({ year: 1790, gained: true });
    expect(capitalChangeAt(e, 1800)).toMatchObject({ year: 1800, gained: false });
    expect(capitalChangeAt(e, 1790 - CHANGE_WINDOW_YEARS - 1)).toBeNull();
  });

  it('picks the NEAREST change, so a long history does not flicker', () => {
    const e = make([{ of: 'Old', from: 100, to: 200 }, { of: 'New', from: 1900, to: null }]);
    expect(capitalChangeAt(e, 1895)?.year).toBe(1900);
    expect(capitalChangeAt(e, 205)?.year).toBe(200);
  });
});

describe('prominence — why Melbourne and Perth were late', () => {
  it('lifts a capital above a more-linked ordinary city', () => {
    const melbourne = make([{ of: 'Australia', from: 1901, to: 1927 }], 207);
    const ordinary = { ...make([], 300), id: 'y' } as TimelineEvent;
    expect(cityProminence(melbourne, 1910)).toBeGreaterThan(cityProminence(ordinary, 1910));
  });

  it('lifts a capital mid-handover above a settled one', () => {
    const settled = make([{ of: 'Somewhere', from: 1000, to: null }], 200);
    const changing = make([{ of: 'Elsewhere', from: 1900, to: null }], 200);
    expect(cityProminence(changing, 1901)).toBeGreaterThan(cityProminence(settled, 1901));
  });

  it('leaves a city alone when it is not a capital at that moment', () => {
    const e = make([{ of: 'Japan', from: 794, to: 1869 }], 260);
    expect(cityProminence(e, 1900)).toBe(260);
  });
});

describe('the shipped data says what the Captain said it does', () => {
  it('Kyoto holds Japan until 1869, then does not', () => {
    const kyoto = city('Kyoto');
    expect(kyoto, 'Kyoto is missing from the globe').toBeTruthy();
    expect(capitalAt(kyoto!, 1600)?.of).toBe('Japan');
    expect(capitalAt(kyoto!, 1600)).toBeTruthy();
    const japan = (kyoto as TimelineEvent & { capitalOf: CapitalRole[] }).capitalOf
      .find((r) => r.of === 'Japan');
    expect(japan?.from).toBe(794);
    expect(japan?.to).toBe(1869);
  });

  it('Philadelphia holds the United States for exactly its ten years', () => {
    const p = city('Philadelphia');
    expect(p, 'Philadelphia is missing').toBeTruthy();
    const us = (p as TimelineEvent & { capitalOf: CapitalRole[] }).capitalOf
      .find((r) => r.of === 'United States');
    expect(us).toMatchObject({ from: 1790, to: 1800 });
    expect(capitalChangeAt(p!, 1800)).toMatchObject({ gained: false });
  });

  it('Washington takes it and keeps it', () => {
    const w = city('Washington, D.C.');
    expect(w, 'Washington DC is missing').toBeTruthy();
    const us = (w as TimelineEvent & { capitalOf: CapitalRole[] }).capitalOf
      .find((r) => r.of === 'United States');
    expect(us?.to, 'Washington should still hold it').toBeNull();
  });

  it('Melbourne held Australia before Canberra — the Captain\'s own example, and real', () => {
    const m = city('Melbourne');
    expect(m, 'Melbourne is missing').toBeTruthy();
    const au = (m as TimelineEvent & { capitalOf: CapitalRole[] }).capitalOf
      .find((r) => r.of === 'Australia');
    expect(au).toMatchObject({ from: 1901, to: 1927 });
    expect(isCapitalRow(m!)).toBe(true);
  });

  it('carries enough capitals to be a layer, and enough handovers to be worth animating', () => {
    const caps = events.filter((e) => isCapitalRow(e));
    expect(caps.length).toBeGreaterThan(500);
    const withHandover = caps.filter((e) =>
      (e as TimelineEvent & { capitalOf: CapitalRole[] }).capitalOf.some((r) => r.to !== null));
    expect(withHandover.length).toBeGreaterThan(50);
  });
});

describe('the handover bonus decays, and a capital filed as a monument still counts', () => {
  it('the bonus is strongest at the moment and gone by the edge of the window', () => {
    const e = make([{ of: 'Ruritania', from: 2000, to: null }]);
    const at = (y: number) => cityProminence(e, y);
    // Flat, it was +150 anywhere inside the window, and at 2026 that put Kabul,
    // Astana, Rabat, Katowice, Malabo and Bujumbura above Paris and London and
    // knocked Washington DC off a globe with ten city slots.
    expect(at(2000)).toBeGreaterThan(at(2010));
    expect(at(2010)).toBeGreaterThan(at(2025));
    expect(at(2000 + CHANGE_WINDOW_YEARS)).toBeCloseTo(at(2000 + CHANGE_WINDOW_YEARS + 50), 5);
  });

  it('a handover never outweighs simply being a more famous capital', () => {
    const famous = make([{ of: 'France', from: 987, to: null }], 366); // Paris
    const obscure = make([{ of: 'Kazakhstan', from: 1997, to: null }], 180); // Astana
    expect(cityProminence(famous, 1997)).toBeGreaterThan(cityProminence(obscure, 1997));
  });

  it('city and monument are one family — Brasília is filed as a monument', () => {
    const b = events.find((e) => e.wikidataId === 'Q2844');
    expect(b, 'Brasília is missing from the globe').toBeTruthy();
    expect(isPlaceRow(b!), 'a place filed as a monument must still be a place').toBe(true);
    const br = (b as TimelineEvent & { capitalOf?: CapitalRole[] }).capitalOf
      ?.find((r) => r.of === 'Brazil');
    expect(br, 'Brasília has no capital-of-Brazil record').toBeTruthy();
    expect(br!.from).toBe(1960);
    // The whole point: the prominence must actually apply to it.
    expect(cityProminence(b!, 2026)).toBeGreaterThan(b!.notability ?? 0);
  });

  it('is not a place row for things that are not places', () => {
    expect(isPlaceRow({ category: 'battle' } as TimelineEvent)).toBe(false);
    expect(isPlaceRow({ category: 'person' } as TimelineEvent)).toBe(false);
    expect(isPlaceRow({ category: 'monument' } as TimelineEvent)).toBe(true);
  });
});
