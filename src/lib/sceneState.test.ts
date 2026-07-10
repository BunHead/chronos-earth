import { describe, expect, it } from 'vitest';
import { OLDEST_BP, ZOOM_SPANS } from './timeScale';
import { buildSceneUrl, readSceneState } from './sceneState';

describe('scene links', () => {
  it('uses the opening scene when the URL has no state', () => {
    expect(readSceneState('')).toEqual({
      yearsBP: OLDEST_BP,
      zoomIdx: ZOOM_SPANS.length - 1,
      layers: null,
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
    expect(readSceneState(parsed.search)).toEqual({
      yearsBP: 960,
      zoomIdx: 3,
      layers: new Set(['borders', 'battles']),
    });
  });
});
