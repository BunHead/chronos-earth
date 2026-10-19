import * as Cesium from 'cesium';

/**
 * HORIZON CULLING for markers and labels (19 Oct 2026).
 *
 * Markers skip the depth test within MARKER_DEPTH_TEST_DISTANCE (so the
 * ground cannot bury them from above) and the polity names skip it always;
 * either way, a label on the far side of the world, just past the horizon,
 * drew straight through the Earth, or hung in space over the limb with its
 * point behind the globe. Here every label and pin whose ground point is
 * behind the globe as seen from the camera is hidden, frame by frame.
 *
 * The test is the sphere's horizon: a point P is in view from the camera C
 * when (C - P) . P >= 0, i.e. C . P >= |P|^2 (on the camera's side of the
 * tangent plane at P). HORIZON_SLACK_M lets a point a little beyond the
 * horizon stay (a hilltop, or a pin rising off the limb), so pins don't
 * flicker there.
 */
export const HORIZON_SLACK_M = 1500;

/**
 * The slack for a camera: it must shrink as the camera comes down. At street
 * level the horizon is only ~15 km off, and a fixed 1.5 km slack let points
 * hundreds of km past it through (Winchester's labels from 20 m over the Mall).
 * About 2% of the camera's height, 5 m to HORIZON_SLACK_M.
 */
export function slackFor(cam: { x: number; y: number; z: number }): number {
  const h = Math.hypot(cam.x, cam.y, cam.z) - 6_371_000;
  return Math.min(HORIZON_SLACK_M, Math.max(5, h * 0.02));
}

export function overHorizon(
  cam: { x: number; y: number; z: number },
  p: { x: number; y: number; z: number },
  slackM = HORIZON_SLACK_M,
): boolean {
  const pp = p.x * p.x + p.y * p.y + p.z * p.z;
  const cp = cam.x * p.x + cam.y * p.y + cam.z * p.z;
  return cp >= pp - slackM * Math.sqrt(pp);
}

const collections = new Set<Cesium.LabelCollection | Cesium.BillboardCollection>();
/** Raw primitive collections (not entity-made) to cull too: the polity names. */
export function cullBeyondHorizon(c: Cesium.LabelCollection | Cesium.BillboardCollection): void {
  collections.add(c);
}

/** What we hid, so we only ever restore our own hiding. */
const hidden = new WeakSet<object>();

function setGraphicShow(g: Cesium.LabelGraphics | Cesium.BillboardGraphics | undefined, visible: boolean): boolean {
  if (!g) return false;
  if (!visible) {
    if (hidden.has(g)) return false;
    // Respect a graphic already switched off by its owner.
    const own = g.show?.getValue(Cesium.JulianDate.now());
    if (own === false) return false;
    hidden.add(g);
    g.show = new Cesium.ConstantProperty(false);
    return true;
  }
  if (!hidden.has(g)) return false;
  hidden.delete(g);
  g.show = new Cesium.ConstantProperty(true);
  return true;
}

const scratch = new Cesium.Cartesian3();

/** Hook the culling into the scene; returns the remover. */
export function installHorizonCull(viewer: Cesium.Viewer): () => void {
  let lastCam = new Cesium.Cartesian3();
  let lastCount = -1;
  let lastAt = 0;
  const run = () => {
    const cam = viewer.camera.positionWC;
    const ents = viewer.entities.values;
    const now = performance.now();
    // Only when the view moved, the markers changed, or now and then.
    if (Cesium.Cartesian3.distance(cam, lastCam) < 1 && ents.length === lastCount && now - lastAt < 1000) return;
    lastCam = Cesium.Cartesian3.clone(cam, lastCam);
    lastCount = ents.length;
    lastAt = now;
    let changed = false;
    const slack = slackFor(cam);
    const t = viewer.clock.currentTime;
    for (const e of ents) {
      if (!e.label && !e.billboard) continue;
      const pos = e.position?.getValue(t, scratch);
      if (!pos) continue;
      const vis = overHorizon(cam, pos, slack);
      if (setGraphicShow(e.label, vis)) changed = true;
      if (setGraphicShow(e.billboard, vis)) changed = true;
    }
    for (const c of collections) {
      if (c.isDestroyed()) { collections.delete(c); continue; }
      for (let i = 0; i < c.length; i++) {
        const g = c.get(i) as Cesium.Label | Cesium.Billboard;
        const vis = overHorizon(cam, g.position, slack);
        if (!vis && g.show) { g.show = false; hidden.add(g); changed = true; }
        else if (vis && !g.show && hidden.has(g)) { g.show = true; hidden.delete(g); changed = true; }
      }
    }
    // Entity changes reach the screen on the next frame; ask for it
    // (render-on-demand would otherwise leave them stale).
    if (changed) viewer.scene.requestRender();
  };
  viewer.scene.preRender.addEventListener(run);
  return () => viewer.scene.preRender.removeEventListener(run);
}
