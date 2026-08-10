import { describe, expect, it } from 'vitest';
import { ELSEWHERE, laneRegionFor, greatCircleKm, viewReachKm } from './laneRegions';

describe('laneRegionFor — timeline lanes name their patch of Earth', () => {
  it('puts the obvious capitals in the obvious lanes', () => {
    expect(laneRegionFor(52.92, -1.47)).toBe('Britain & Ireland'); // Derby
    expect(laneRegionFor(41.9, 12.5)).toBe('Italy'); // Rome
    expect(laneRegionFor(48.85, 2.35)).toBe('France'); // Paris
    expect(laneRegionFor(35.01, 135.77)).toBe('East Asia'); // Kyoto
    expect(laneRegionFor(30.05, 31.24)).toBe('North Africa'); // Cairo
    expect(laneRegionFor(40.71, -74.01)).toBe('North America'); // New York
  });

  it('order matters: specific homelands beat the continental catch-alls', () => {
    expect(laneRegionFor(37.98, 23.73)).toBe('Greece & Balkans'); // Athens, not Eastern Europe
    expect(laneRegionFor(50.95, 1.85)).toBe('France'); // Calais, not Britain
    expect(laneRegionFor(31.78, 35.22)).toBe('Middle East'); // Jerusalem, not North Africa
  });

  it('open ocean falls into the catch-all lane', () => {
    expect(laneRegionFor(0, -140)).toBe(ELSEWHERE); // mid-Pacific
  });
});

describe('greatCircleKm', () => {
  it('matches published distances', () => {
    // London → New York, 5570 km by great circle.
    expect(greatCircleKm(51.5, -0.13, 40.71, -74.01)).toBeGreaterThan(5500);
    expect(greatCircleKm(51.5, -0.13, 40.71, -74.01)).toBeLessThan(5620);
    expect(greatCircleKm(52.9, -1.47, 52.9, -1.47)).toBe(0);
  });

  it('measures across the dateline the short way', () => {
    // 179°E to 179°W is 2° apart, not 358°.
    expect(greatCircleKm(0, 179, 0, -179)).toBeLessThan(250);
  });
});

describe('viewReachKm — the mural looks in a circle, not a box', () => {
  // The Captain's own report: parked over Brazil, the wall filled with
  // Britain & Ireland. The bounding box reached that far through its corner.
  const brazil = { w: -74, s: -34, e: -34, n: 6 };
  const BRAZIL_CENTRE = { lat: -14, lon: -54 };

  it('does not reach Britain from Brazil', () => {
    const reach = viewReachKm(brazil);
    // Derby is over 8000 km from central Brazil — far outside any honest reach.
    expect(greatCircleKm(BRAZIL_CENTRE.lat, BRAZIL_CENTRE.lon, 52.92, -1.47)).toBeGreaterThan(reach);
  });

  it('still reaches the rest of Brazil', () => {
    const reach = viewReachKm(brazil);
    for (const [lat, lon] of [[-22.9, -43.2], [-23.5, -46.6], [-3.1, -60.0], [-15.8, -47.9]]) {
      expect(greatCircleKm(BRAZIL_CENTRE.lat, BRAZIL_CENTRE.lon, lat, lon)).toBeLessThan(reach);
    }
  });

  it('takes the larger of half-height and half-width, not the diagonal', () => {
    // A wide, short view: the width governs, and the corner is excluded.
    const wide = { w: -30, s: -5, e: 30, n: 5 };
    const reach = viewReachKm(wide);
    expect(reach).toBeGreaterThan(3000); // half-width ~3340 km at the equator
    expect(reach).toBeLessThan(4000);
    // The box's own corner sits beyond that reach — which is the whole point.
    expect(greatCircleKm(0, 0, 5, 30)).toBeGreaterThan(reach * 0.9);
  });

  it('is floored for a deep zoom and capped for a near-global one', () => {
    expect(viewReachKm({ w: -0.01, s: 51.5, e: 0.01, n: 51.51 })).toBe(250);
    expect(viewReachKm({ w: -180, s: -90, e: 180, n: 90 })).toBe(5_000);
  });

  it('keeps Britain off Brazil\'s wall even when the view rect goes global', () => {
    // From about 6000 km up, Cesium's view rectangle snaps to the whole globe
    // while the camera still points at one hemisphere. That case swept in 183
    // British events before the cap — the Captain's original report.
    const global = viewReachKm({ w: -180, s: -90, e: 180, n: 90 });
    const toDerby = greatCircleKm(BRAZIL_CENTRE.lat, BRAZIL_CENTRE.lon, 52.92, -1.47);
    const toStonehenge = greatCircleKm(BRAZIL_CENTRE.lat, BRAZIL_CENTRE.lon, 51.18, -1.83);
    expect(toDerby).toBeGreaterThan(global);
    expect(toStonehenge).toBeGreaterThan(global);
    // …while South America still fits comfortably inside it.
    expect(greatCircleKm(BRAZIL_CENTRE.lat, BRAZIL_CENTRE.lon, -22.9, -43.2)).toBeLessThan(global);
    expect(greatCircleKm(BRAZIL_CENTRE.lat, BRAZIL_CENTRE.lon, -13.5, -71.98)).toBeLessThan(global); // Cusco
  });
});
