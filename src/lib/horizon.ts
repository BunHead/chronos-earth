/**
 * horizon.ts — is a point on the near side of the Earth from the camera?
 *
 * Prehistoric-life and migration pins showed THROUGH the globe: standing at
 * Stonehenge in 2800 BCE, the woolly mammoth's label hung in the English sky
 * from 7,000 km away in Siberia (11 Oct 2026), and "White Sands footprints"
 * floated over the globe's edge. A pin whose spot is below the horizon hides.
 */
import * as Cesium from 'cesium';

/** A checker for the camera's current position; build once per update pass. */
export function horizonCheck(viewer: Cesium.Viewer): (p: Cesium.Cartesian3) => boolean {
  const cam = Cesium.Cartesian3.clone(viewer.camera.positionWC);
  const toCam = new Cesium.Cartesian3();
  const up = new Cesium.Cartesian3();
  // A spot on the ground faces the camera when the camera is above its local
  // horizon: the line to the camera points into the spot's "up" half-space.
  return (p) => {
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(p, up);
    Cesium.Cartesian3.subtract(cam, p, toCam);
    return Cesium.Cartesian3.dot(toCam, up) > 0;
  };
}

/** Re-run `fn` whenever the camera moves enough to change what is over the horizon. */
export function onCameraTurn(viewer: Cesium.Viewer, fn: () => void): () => void {
  const cam = viewer.camera;
  const offChanged = cam.changed.addEventListener(fn);
  const offEnd = cam.moveEnd.addEventListener(fn);
  return () => { offChanged(); offEnd(); };
}
