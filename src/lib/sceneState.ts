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

/** Where the camera is looking — so a shared link restores not just WHEN but
 * WHERE. Degrees / metres, plus the orbital heading and pitch. */
export interface CameraState {
  lon: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
}

export interface SceneState {
  yearsBP: number;
  zoomIdx: number;
  layers: Set<SceneLayerKey> | null;
  /** Present only when the URL carried a `cam` param. */
  camera: CameraState | null;
}

/** Parse `cam=lon,lat,height,heading,pitch` (all finite), or null. */
function readCamera(raw: string | null): CameraState | null {
  if (!raw) return null;
  const p = raw.split(',').map(Number);
  if (p.length !== 5 || p.some((n) => !Number.isFinite(n))) return null;
  const [lon, lat, height, heading, pitch] = p;
  // Reject nonsense (a corrupted/hand-mangled link) rather than fly to space.
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || height <= 0 || height > 6e7) return null;
  return { lon, lat, height, heading, pitch };
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

  return { yearsBP, zoomIdx, layers, camera: readCamera(params.get('cam')) };
}

/** Create a link that reconstructs the important parts of the current scene. */
export function buildSceneUrl(
  currentUrl: string,
  state: {
    yearsBP: number;
    zoomIdx: number;
    layers: Iterable<SceneLayerKey>;
    camera?: CameraState | null;
  },
): string {
  const url = new URL(currentUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('time', String(Math.round(clamp(state.yearsBP, 0, OLDEST_BP))));
  url.searchParams.set('zoom', String(Math.round(clamp(state.zoomIdx, 0, ZOOM_SPANS.length - 1))));
  url.searchParams.set('layers', [...state.layers].join(','));
  if (state.camera) {
    const c = state.camera;
    // Trim precision: ~1 m of lon/lat, whole metres of height, 0.1° of angle —
    // enough to land in the same spot, short enough to keep the link tidy.
    url.searchParams.set(
      'cam',
      [c.lon.toFixed(4), c.lat.toFixed(4), Math.round(c.height), c.heading.toFixed(1), c.pitch.toFixed(1)].join(','),
    );
  }
  return url.toString();
}
