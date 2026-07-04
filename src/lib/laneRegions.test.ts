import { describe, expect, it } from 'vitest';
import { ELSEWHERE, laneRegionFor } from './laneRegions';

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
