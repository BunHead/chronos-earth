import { describe, expect, it } from 'vitest';
import { isSiteTwin } from './siteTwin';

const byzantium = { name: 'Byzantine Empire', lat: 41.0086, lon: 28.9802 };
const stonehenge = { name: 'Stonehenge', lat: 51.1789, lon: -1.8262 };

describe('isSiteTwin — one place, not one neighbourhood', () => {
  it('a different monument nearby is NOT a twin (the 33 km box hid 119 of them)', () => {
    expect(isSiteTwin(byzantium, { name: 'Chora Church', lat: 41.0312, lon: 28.9389 })).toBe(false);
    expect(isSiteTwin(stonehenge, { name: 'Woodhenge', lat: 51.1894, lon: -1.7859 })).toBe(false);
  });

  it('the same name nearby is a twin, brackets and accents aside', () => {
    expect(isSiteTwin({ name: 'Pumapunku (Tiwanaku)', lat: -16.5617, lon: -68.68 }, { name: 'Pumapunku', lat: -16.5, lon: -68.7 })).toBe(true);
    expect(isSiteTwin({ name: 'Göbekli Tepe', lat: 37.2233, lon: 38.9224 }, { name: 'Gobekli Tepe', lat: 37.25, lon: 38.95 })).toBe(true);
  });

  it('two pins on the same spot are a twin whatever they are called', () => {
    expect(isSiteTwin(stonehenge, { name: 'Stonehenge, Avebury and Associated Sites', lat: 51.179, lon: -1.826 })).toBe(true);
    expect(isSiteTwin(stonehenge, { name: 'The Stones', lat: 51.18, lon: -1.83 })).toBe(true);
  });

  it('the same name far away is not a twin', () => {
    expect(isSiteTwin(stonehenge, { name: 'Stonehenge', lat: 40, lon: -1.8 })).toBe(false);
  });

  it('tiny names do not match by containment', () => {
    expect(isSiteTwin({ name: 'Ur', lat: 30.96, lon: 46.1 }, { name: 'Temple of Ur-Nammu', lat: 31.0, lon: 46.15 })).toBe(false);
  });
});
