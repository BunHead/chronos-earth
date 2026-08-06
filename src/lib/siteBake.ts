/**
 * siteBake.ts — THE MASON. The Captain surveys; this dresses what he surveyed.
 *
 * `buildSiteFromPlan(plan)` turns a SitePlan's plain primitives into detailed
 * masonry (docs/plan-site-detail-bake.md). The division of labour is absolute:
 *
 *   Captain = surveyor. Positions, lengths, thicknesses and heights are FACT.
 *   Mason   = ornament only. It may never move, lengthen or resize a part.
 *
 * VERTICAL SLICE (queue item 11): one role — `curtain-wall` — which grows a
 * crenellated parapet (merlons + crenels) and a wall-walk on top of each traced
 * run. Every other role is left to its live Cesium primitive, so this bake adds
 * detail without taking anything over that it can't yet draw better.
 *
 * FRAME (calibrated, do not re-derive — MODELLER-CRAFT rule 2):
 *   real east  = +X
 *   real north = −Z
 *   up         = +Y
 * and ONE UNIT IS ONE METRE. The bake is authored true-sized, so the globe
 * places it at scale 1 with no fit-table scaling — the survey's own metres are
 * the only measurements involved. That is what keeps the battlements standing
 * exactly on the Captain's traced lines.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stoneMat } from '../components/Monument3D';
import { bakedParts, offsetM, type SitePart, type SitePlan } from './sitePlan';

/**
 * How far the masonry is buried below the plan's ground datum, so a rigid
 * baked wall still meets the terrain on a slope's downhill side instead of
 * floating. Mirrors FOUNDATION_SINK in sitePlanRender.ts — the primitives it
 * replaces bury exactly the same skirt, so the swap changes nothing but detail.
 */
export const BAKE_SINK = 12;

/** Default masonry colour when the Captain hasn't tinted the part. */
const WALL_COLOR = '#b8b2a4';

/**
 * Turn a part's traced [lat, lon] vertices into local metre positions
 * (x = east, z = −north) relative to the plan origin.
 */
function localVerts(plan: SitePlan, part: SitePart): Array<{ x: number; z: number }> {
  const o: [number, number] = [plan.origin.lat, plan.origin.lon];
  return (part.verts ?? []).map(([la, lo]) => {
    const { eastM, northM } = offsetM(o, [la, lo]);
    return { x: eastM, z: -northM }; // north is −Z
  });
}

/**
 * The crenellation proportions for a wall of surveyed height `h`.
 *
 * The parapet is grown INSIDE the surveyed height, never above it: the wall
 * body rises to `bodyH`, the wall-walk sits on that, and the merlons rise from
 * the walk to exactly `h`. So the silhouette the Captain traced is preserved to
 * the metre — a battlement that ADDED 1.7 m would be the mason resizing his
 * survey, which the plan forbids. Crenels (the gaps) cut down to the walk,
 * which is what actually reads as "castle" from the air.
 */
export function crenelSpec(h: number, thicknessM: number): {
  parapetH: number;
  bodyH: number;
  merlonD: number;
  inset: number;
} {
  const parapetH = Math.min(1.7, Math.max(0.4, h * 0.35));
  const merlonD = Math.min(0.75, Math.max(0.2, thicknessM * 0.3));
  return {
    parapetH,
    bodyH: h - parapetH,
    merlonD,
    // Centre-offset of each merlon row: hard against its face of the wall.
    inset: Math.max(0, thicknessM / 2 - merlonD / 2),
  };
}

/**
 * How many merlons march along a run of `len` metres, and their width.
 * Real merlons sit roughly 1.5–2.2 m apart; we solve for a whole number so the
 * teeth land evenly on the run instead of leaving a stub at one end.
 */
export function merlonLayout(len: number): { count: number; width: number; pitch: number } {
  const PITCH = 1.85;
  const count = Math.max(2, Math.round(len / PITCH));
  const pitch = len / count;
  return { count, width: pitch * 0.55, pitch }; // 55% tooth, 45% crenel
}

/** A box geometry pre-positioned in the site frame (cheap — merged later). */
function box(w: number, h: number, d: number, x: number, y: number, z: number, ry: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/**
 * Dress ONE traced curtain wall: body, wall-walk, and two rows of merlons.
 *
 * The geometry is emitted per SEGMENT (verts[i] → verts[i+1]) in the segment's
 * own heading, plus a square post at each vertex. The posts are what close the
 * mitre where two runs meet at an angle — without them a corner shows a wedge
 * of daylight, which is exactly the artefact Cesium's CornerType.MITERED was
 * hiding for the primitives this replaces.
 */
function dressCurtainWall(plan: SitePlan, part: SitePart): THREE.BufferGeometry[] {
  const pts = localVerts(plan, part);
  if (pts.length < 2) return [];
  const h = part.heightM ?? 8;
  const t = part.thicknessM ?? 3;
  const { parapetH, bodyH, merlonD, inset } = crenelSpec(h, t);
  const out: THREE.BufferGeometry[] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue; // a duplicate click, not a wall
    // Heading of the run. A box is authored along +X, so rotating by −atan2(dz,dx)
    // about Y lays its length down the segment.
    const ry = -Math.atan2(dz, dx);
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;

    // ── the wall body, buried to BAKE_SINK so it foots on sloping ground ──
    const bodyTotal = bodyH + BAKE_SINK;
    out.push(box(len, bodyTotal, t, cx, bodyTotal / 2 - BAKE_SINK, cz, ry));

    // ── the wall-walk: a deck a whisker PROUD of the body top, inset from both
    // faces so it reads as a walkway between the teeth. Proud, not flush —
    // coplanar faces z-fight (MODELLER-CRAFT).
    const walkW = Math.max(0.3, t - 2 * merlonD);
    out.push(box(len, 0.12, walkW, cx, bodyH + 0.06, cz, ry));

    // ── the teeth, one row hard against each face ──
    const { count, width, pitch } = merlonLayout(len);
    const ux = dx / len;
    const uz = dz / len;
    // Unit vector across the run (right-hand normal in the XZ plane).
    const nx = -uz;
    const nz = ux;
    for (let m = 0; m < count; m++) {
      const s = -len / 2 + (m + 0.5) * pitch; // distance along the run from centre
      const mx = cx + ux * s;
      const mz = cz + uz * s;
      for (const side of [-1, 1] as const) {
        out.push(
          box(
            width,
            parapetH,
            merlonD,
            mx + nx * inset * side,
            bodyH + parapetH / 2,
            mz + nz * inset * side,
            ry,
          ),
        );
      }
    }
  }

  // ── corner posts: full-height square stubs closing every mitre ──
  for (const p of pts) {
    const postTotal = bodyH + BAKE_SINK;
    out.push(box(t, postTotal, t, p.x, postTotal / 2 - BAKE_SINK, p.z, 0));
    // …carried up through the parapet so a corner reads as solid, not gap-toothed.
    out.push(box(t - 2 * merlonD * 0.4, parapetH, t - 2 * merlonD * 0.4, p.x, bodyH + parapetH / 2, p.z, 0));
  }
  return out;
}

/**
 * Build the detailed masonry for a site plan.
 *
 * Returns a group in the site's local metre frame (origin = plan.origin,
 * +X east, −Z north) and the indices of the parts it took over, so the caller
 * can stand down exactly those primitives and no others. When no part is
 * bakeable the group comes back empty and `partIndices` is `[]` — the caller
 * must then keep every primitive, which is the correct no-op.
 */
export function buildSiteFromPlan(plan: SitePlan): {
  group: THREE.Group;
  partIndices: number[];
  fromYear?: number;
  toYear?: number;
} {
  const group = new THREE.Group();
  const { indices, fromYear, toYear } = bakedParts(plan);

  // Group the geometry by colour so the whole site collapses to one mesh per
  // masonry tint — ~500 m of battlement is ~600 boxes, and 600 glTF primitives
  // would dwarf the geometry they carry once Draco has done its work.
  const byColor = new Map<string, THREE.BufferGeometry[]>();
  for (const idx of indices) {
    const part = plan.parts[idx];
    const color = part.color ?? WALL_COLOR;
    const geos = dressCurtainWall(plan, part);
    if (!geos.length) continue;
    const bucket = byColor.get(color);
    if (bucket) bucket.push(...geos);
    else byColor.set(color, geos);
  }

  for (const [color, geos] of byColor) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    group.add(new THREE.Mesh(merged, stoneMat(color)));
  }
  group.userData.siteBake = true;
  return { group, partIndices: indices, fromYear, toYear };
}
