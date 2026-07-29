import { describe, expect, it } from 'vitest';
import { OLDEST_BP, ZOOM_SPANS } from './timeScale';
import { buildSceneUrl, readSceneState } from './sceneState';

describe('scene links', () => {
  it('uses the opening scene when the URL has no state', () => {
    expect(readSceneState('')).toEqual({
      yearsBP: OLDEST_BP,
      zoomIdx: ZOOM_SPANS.length - 1,
      layers: null,
      camera: null,
    });
  });

  it('restores time, zoom and known layers while ignoring unknown ones', () => {
    const scene = readSceneState('?time=960&zoom=2&layers=borders,battles,nope');
    expect(scene.yearsBP).toBe(960);
    expect(scene.zoomIdx).toBe(2);
    expect([...scene.layers!]).toEqual(['borders', 'battles']);
  });

  it('clamps hostile or stale numeric values', () => {
    expect(readSceneState('?time=999999999&zoom=99').yearsBP).toBe(OLDEST_BP);
    expect(readSceneState('?time=-5&zoom=-2').zoomIdx).toBe(0);
  });

  it('builds a clean, round-trippable link', () => {
    const url = buildSceneUrl('https://example.test/chronos/?old=1#fragment', {
      yearsBP: 960,
      zoomIdx: 3,
      layers: ['borders', 'battles'],
    });
    const parsed = new URL(url);
    expect(parsed.hash).toBe('');
    expect(parsed.searchParams.get('old')).toBeNull();
    expect(parsed.searchParams.get('cam')).toBeNull(); // no camera given → no cam param
    expect(readSceneState(parsed.search)).toEqual({
      yearsBP: 960,
      zoomIdx: 3,
      layers: new Set(['borders', 'battles']),
      camera: null,
    });
  });

  it('round-trips the camera (WHERE you are looking, not just WHEN)', () => {
    const camera = { lon: -1.8262, lat: 51.1789, height: 1200, heading: 12.3, pitch: -42.7 };
    const url = buildSceneUrl('https://example.test/chronos/', {
      yearsBP: 4520, // 2500 BCE-ish, standing over Stonehenge
      zoomIdx: 3,
      layers: ['sites'],
      camera,
    });
    const back = readSceneState(new URL(url).search).camera!;
    expect(back.lon).toBeCloseTo(camera.lon, 3);
    expect(back.lat).toBeCloseTo(camera.lat, 3);
    expect(back.height).toBe(1200);
    expect(back.heading).toBeCloseTo(12.3, 1);
    expect(back.pitch).toBeCloseTo(-42.7, 1);
  });

  it('rejects a corrupted or out-of-range camera rather than flying to nowhere', () => {
    expect(readSceneState('?cam=10,25,24000000').camera).toBeNull(); // too few numbers
    expect(readSceneState('?cam=200,99,1000,0,0').camera).toBeNull(); // lat/lon out of range
    expect(readSceneState('?cam=0,0,-5,0,0').camera).toBeNull(); // height ≤ 0
    expect(readSceneState('?cam=a,b,c,d,e').camera).toBeNull(); // not numbers
  });
});
