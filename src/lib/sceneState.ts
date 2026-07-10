import { OLDEST_BP, ZOOM_SPANS, clamp } from './timeScale';

export const SCENE_LAYER_KEYS = [
  'sites',
  'borders',
  'flags',
  'battles',
  'campaigns',
  'fauna',
  'seas',
  'rivers',
  'cities',
  'disasters',
  'events',
  'science',
  'people',
] as const;

export type SceneLayerKey = (typeof SCENE_LAYER_KEYS)[number];

export interface SceneState {
  yearsBP: number;
  zoomIdx: number;
  layers: Set<SceneLayerKey> | null;
}

/** Read a compact, deliberately human-editable scene state from the URL. */
export function readSceneState(search: string): SceneState {
  const params = new URLSearchParams(search);
  const rawTime = params.has('time') ? Number(params.get('time')) : Number.NaN;
  const rawZoom = params.has('zoom') ? Number(params.get('zoom')) : Number.NaN;
  const rawLayers = params.get('layers');

  const yearsBP = Number.isFinite(rawTime) ? clamp(rawTime, 0, OLDEST_BP) : OLDEST_BP;
  const zoomIdx = Number.isFinite(rawZoom)
    ? Math.round(clamp(rawZoom, 0, ZOOM_SPANS.length - 1))
    : ZOOM_SPANS.length - 1;
  const layers = rawLayers === null
    ? null
    : new Set(
        rawLayers
          .split(',')
          .filter((key): key is SceneLayerKey => SCENE_LAYER_KEYS.includes(key as SceneLayerKey)),
      );

  return { yearsBP, zoomIdx, layers };
}

/** Create a link that reconstructs the important parts of the current scene. */
export function buildSceneUrl(
  currentUrl: string,
  state: { yearsBP: number; zoomIdx: number; layers: Iterable<SceneLayerKey> },
): string {
  const url = new URL(currentUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('time', String(Math.round(clamp(state.yearsBP, 0, OLDEST_BP))));
  url.searchParams.set('zoom', String(Math.round(clamp(state.zoomIdx, 0, ZOOM_SPANS.length - 1))));
  url.searchParams.set('layers', [...state.layers].join(','));
  return url.toString();
}
