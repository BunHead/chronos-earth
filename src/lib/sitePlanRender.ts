/**
 * sitePlanRender.ts — site plans standing on the living Earth.
 *
 * Renders a SitePlan (sitePlan.ts) straight as native Cesium entities — no glb
 * pipeline: boxes and cylinders sit on the terrain, traced walls extrude as
 * ground-hugging corridors, platforms as extruded polygons, water as a flat
 * translucent fill. Saved plans load for EVERY visitor at startup (published
 * ones from the review file; this device's own drafts win on top) and obey the
 * timeline: parts dated fromYear/toYear stand only in their years.
 *
 * The builder-active flag lives here too: while the Captain is tracing, the
 * globe's own click behaviour (the place dossier) stands down.
 */
import * as Cesium from 'cesium';
import { loadReview } from './review';
import { partStandsAt, type SitePart, type SitePlan, parseSitePlan } from './sitePlan';

/** Site parts appear when the camera is nearer than this (metres) — the same
 * reveal distance as the glb fleet, so a site fades in with its monument. */
const REVEAL_DISTANCE = 80_000;

const LOCAL_SITEPLANS_KEY = 'ce_local_siteplans';

// ── device-local drafts (no key needed — mirrors placement trims) ───────────
export function loadLocalSitePlans(): Record<string, SitePlan> {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_SITEPLANS_KEY) ?? '{}') as Record<string, unknown>;
    const out: Record<string, SitePlan> = {};
    for (const [k, v] of Object.entries(raw)) {
      const plan = parseSitePlan(v);
      if (plan) out[k] = plan;
    }
    return out;
  } catch {
    return {};
  }
}
export function saveLocalSitePlan(key: string, plan: SitePlan | undefined): void {
  try {
    const all = loadLocalSitePlans() as Record<string, SitePlan | undefined>;
    if (plan && plan.parts.length) all[key] = plan;
    else delete all[key];
    localStorage.setItem(LOCAL_SITEPLANS_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked — drafts just can't stick */
  }
}

// ── builder mode flag (Globe's click handler stands down while tracing) ─────
let builderActive = false;
export function setBuilderActive(on: boolean): void {
  builderActive = on;
  // The glb fleet ghosts translucent while building — repaint straight away.
  theViewer?.scene.requestRender();
}
export function isBuilderActive(): boolean {
  return builderActive;
}

/** The timeline year the globe last reported — new parts record it as their
 * fromYear, so a site composed at 1097 CE belongs to 1097 CE. */
export function currentTimelineYear(): number {
  return lastYear;
}

// ── rendering ────────────────────────────────────────────────────────────────
interface RenderedSite {
  plan: SitePlan;
  entities: Cesium.Entity[];
}

let theViewer: Cesium.Viewer | null = null;
const sites = new Map<string, RenderedSite>();
let lastYear = 3000; // whatever year the timeline last reported
let lastShow = true;

const color = (css: string | undefined, dflt: string, alpha = 1): Cesium.Color =>
  Cesium.Color.fromCssColorString(css ?? dflt).withAlpha(alpha);

const DDC = () => new Cesium.DistanceDisplayCondition(0, REVEAL_DISTANCE);

/** Build the Cesium entity for one part. Selection picks it back up via the
 * id convention `siteplan|<siteKey>|<partIndex>`. */
function partEntity(siteKey: string, idx: number, part: SitePart): Cesium.Entity | null {
  const id = `siteplan|${siteKey}|${idx}`;
  if (part.type === 'box' && part.lat != null && part.lon != null) {
    const h = part.heightM ?? 12;
    return new Cesium.Entity({
      id,
      position: Cesium.Cartesian3.fromDegrees(part.lon, part.lat, h / 2),
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(part.lon, part.lat),
        new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(part.rotationDeg ?? 0), 0, 0),
      ) as unknown as Cesium.Property,
      box: {
        dimensions: new Cesium.Cartesian3(part.widthM ?? 20, part.lengthM ?? 20, h),
        material: color(part.color, '#d8d2c4'),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        distanceDisplayCondition: DDC(),
      },
    });
  }
  if (part.type === 'cylinder' && part.lat != null && part.lon != null) {
    const h = part.heightM ?? 14;
    return new Cesium.Entity({
      id,
      position: Cesium.Cartesian3.fromDegrees(part.lon, part.lat, h / 2),
      cylinder: {
        length: h,
        topRadius: part.radiusM ?? 6,
        bottomRadius: part.radiusM ?? 6,
        material: color(part.color, '#cfc9bb'),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        distanceDisplayCondition: DDC(),
      },
    });
  }
  if (part.type === 'wall' && part.verts && part.verts.length >= 2) {
    return new Cesium.Entity({
      id,
      corridor: {
        positions: part.verts.map(([la, lo]) => Cesium.Cartesian3.fromDegrees(lo, la)),
        width: part.thicknessM ?? 3,
        height: 0,
        extrudedHeight: part.heightM ?? 8,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        cornerType: Cesium.CornerType.MITERED,
        material: color(part.color, '#b8b2a4'),
        distanceDisplayCondition: DDC(),
      },
    });
  }
  if ((part.type === 'platform' || part.type === 'water') && part.verts && part.verts.length >= 3) {
    const isWater = part.type === 'water';
    const positions = part.verts.map(([la, lo]) => Cesium.Cartesian3.fromDegrees(lo, la));
    return new Cesium.Entity({
      id,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: isWater ? color(part.color, '#3f6f9e', 0.75) : color(part.color, '#a89f8d'),
        ...(isWater
          ? { classificationType: Cesium.ClassificationType.BOTH } // drape on terrain
          : {
              height: 0,
              extrudedHeight: part.heightM ?? 2,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            }),
        distanceDisplayCondition: DDC(),
      },
    });
  }
  return null;
}

/** Push an edited part's values into its EXISTING entity — no remove/re-add.
 * Recreating an entity makes Cesium re-measure the ground beneath it against
 * whatever terrain detail happens to be loaded, which sent the Captain's west
 * towers floating when he drew the east wall. A persistent entity keeps its
 * settled ground height and tracks terrain refinement properly. */
function updateEntity(e: Cesium.Entity, part: SitePart): void {
  if (part.type === 'box' && part.lat != null && part.lon != null && e.box) {
    const h = part.heightM ?? 12;
    const pos = Cesium.Cartesian3.fromDegrees(part.lon, part.lat, h / 2);
    e.position = new Cesium.ConstantPositionProperty(pos);
    e.orientation = new Cesium.ConstantProperty(
      Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(part.lon, part.lat),
        new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(part.rotationDeg ?? 0), 0, 0),
      ),
    );
    e.box.dimensions = new Cesium.ConstantProperty(
      new Cesium.Cartesian3(part.widthM ?? 20, part.lengthM ?? 20, h),
    );
    e.box.material = new Cesium.ColorMaterialProperty(color(part.color, '#d8d2c4'));
  } else if (part.type === 'cylinder' && part.lat != null && part.lon != null && e.cylinder) {
    const h = part.heightM ?? 14;
    e.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(part.lon, part.lat, h / 2));
    e.cylinder.length = new Cesium.ConstantProperty(h);
    e.cylinder.topRadius = new Cesium.ConstantProperty(part.radiusM ?? 6);
    e.cylinder.bottomRadius = new Cesium.ConstantProperty(part.radiusM ?? 6);
    e.cylinder.material = new Cesium.ColorMaterialProperty(color(part.color, '#cfc9bb'));
  } else if (part.type === 'wall' && part.verts && e.corridor) {
    e.corridor.positions = new Cesium.ConstantProperty(
      part.verts.map(([la, lo]) => Cesium.Cartesian3.fromDegrees(lo, la)),
    );
    e.corridor.width = new Cesium.ConstantProperty(part.thicknessM ?? 3);
    e.corridor.extrudedHeight = new Cesium.ConstantProperty(part.heightM ?? 8);
    e.corridor.material = new Cesium.ColorMaterialProperty(color(part.color, '#b8b2a4'));
  } else if ((part.type === 'platform' || part.type === 'water') && part.verts && e.polygon) {
    const isWater = part.type === 'water';
    e.polygon.hierarchy = new Cesium.ConstantProperty(
      new Cesium.PolygonHierarchy(part.verts.map(([la, lo]) => Cesium.Cartesian3.fromDegrees(lo, la))),
    );
    e.polygon.material = new Cesium.ColorMaterialProperty(
      isWater ? color(part.color, '#3f6f9e', 0.75) : color(part.color, '#a89f8d'),
    );
    if (!isWater) e.polygon.extrudedHeight = new Cesium.ConstantProperty(part.heightM ?? 2);
  }
}

/** (Re)render one site's plan by DIFFING against what stands: untouched parts
 * keep their entities (and their settled ground heights — see updateEntity's
 * note), edited parts update in place, new parts are created, deleted parts
 * removed. An empty/undefined plan clears the site. Returns entity count. */
export function renderSitePlan(key: string, plan: SitePlan | undefined): number {
  const viewer = theViewer;
  if (!viewer || viewer.isDestroyed()) return 0;
  const prev = sites.get(key);
  const prevEntities = prev?.entities ?? [];
  const prevParts = prev?.plan.parts ?? [];
  if (!plan || !plan.parts.length) {
    for (const e of prevEntities) viewer.entities.remove(e);
    sites.delete(key);
    viewer.scene.requestRender();
    return 0;
  }
  const entities: Cesium.Entity[] = [];
  plan.parts.forEach((part, idx) => {
    const old = prevEntities[idx] as Cesium.Entity | undefined;
    const oldPart = prevParts[idx];
    const wantId = `siteplan|${key}|${idx}`;
    if (old && oldPart && String(old.id) === wantId && oldPart.type === part.type) {
      // Same slot, same kind. Untouched parts (same object) need nothing at
      // all; edited ones update their existing entity in place.
      if (oldPart !== part) updateEntity(old, part);
      old.show = lastShow && partStandsAt(part, lastYear);
      entities.push(old);
      return;
    }
    if (old) viewer.entities.remove(old); // slot changed kind (or ids shifted after a delete)
    const e = partEntity(key, idx, part);
    if (!e) return;
    e.show = lastShow && partStandsAt(part, lastYear);
    viewer.entities.add(e);
    entities.push(e);
  });
  // Parts deleted from the end: their entities go too.
  for (let i = plan.parts.length; i < prevEntities.length; i++) viewer.entities.remove(prevEntities[i]);
  sites.set(key, { plan, entities });
  viewer.scene.requestRender();
  return entities.length;
}

/** Timeline/layer gate — call alongside updateGlobeModelVisibility. */
export function updateSitePlanVisibility(year: number, showSites: boolean): void {
  lastYear = year;
  lastShow = showSites;
  for (const { plan, entities } of sites.values()) {
    entities.forEach((e, i) => {
      // Entity order mirrors part order (nulls never pushed), so map back via id.
      const idx = Number(String(e.id).split('|')[2]);
      const part = plan.parts[Number.isFinite(idx) ? idx : i];
      if (part) e.show = showSites && partStandsAt(part, year);
    });
  }
  theViewer?.scene.requestRender();
}

/** The plan currently standing for a site (for the builder to edit). */
export function currentSitePlan(key: string): SitePlan | undefined {
  return sites.get(key)?.plan;
}

/** Parse a picked entity id back to its site + part ("siteplan|key|3"). */
export function pickedSitePart(id: unknown): { key: string; index: number } | null {
  if (typeof id !== 'string' || !id.startsWith('siteplan|')) return null;
  const cut = id.lastIndexOf('|');
  const index = Number(id.slice(cut + 1));
  const key = id.slice('siteplan|'.length, cut);
  return Number.isFinite(index) && key ? { key, index } : null;
}

/** Load every saved site plan (published + this device's drafts) and stand
 * them on the globe. Call once after the viewer exists. */
export async function loadSitePlans(viewer: Cesium.Viewer): Promise<void> {
  theViewer = viewer;
  const plans: Record<string, SitePlan> = {};
  try {
    const review = await loadReview();
    for (const [key, rec] of Object.entries(review)) {
      if (!key.startsWith('siteplan:')) continue;
      const plan = parseSitePlan((rec as { siteplan?: unknown }).siteplan);
      if (plan) plans[key] = plan;
    }
  } catch {
    /* published plans are optional */
  }
  Object.assign(plans, loadLocalSitePlans()); // device drafts win
  for (const [key, plan] of Object.entries(plans)) renderSitePlan(key, plan);
}
