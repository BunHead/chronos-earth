/**
 * sitePlan.ts — the in-app site builder's georeferenced site spec.
 *
 * A "site plan" is how a non-coder composes an accurate place directly on the
 * satellite globe (the Tower of London: keep + inner ward + moat + curtain
 * walls) without touching code: a list of parametric parts, each anchored in
 * geo-space (lat/lon) with real-metre dimensions. The spec is pure data —
 * rendering lives in sitePlanRender.ts (Cesium), editing in SiteBuilder.tsx.
 *
 * Persistence rides the existing review plumbing under "siteplan:<placeKey>"
 * keys: always saved on this device (localStorage, key-free), published for
 * every visitor through the maker's GitHub key exactly like placement trims.
 *
 * Everything here is framework-free and unit-tested (sitePlan.test.ts).
 */

/** What a part IS — the palette a non-coder picks from. */
export type SitePartType =
  | 'box' //       square building: centre + width/length/height + rotation
  | 'cylinder' //  round tower / drum: centre + radius + height
  | 'wall' //      traced path extruded to a thick wall (corridor)
  | 'platform' //  traced outline filled and raised (a ward, a motte)
  | 'water'; //    traced outline filled flat as water (the moat)

/**
 * What a part IS ARCHITECTURALLY — the brief the mason works to when a plan is
 * baked into detailed masonry (docs/plan-site-detail-bake.md). The Captain
 * surveys shapes; the role says what kind of building that shape is, so the
 * mason can dress it without ever moving or resizing what he traced.
 *
 * `plain` means "leave it as the primitive" — the honest default for anything
 * the mason has no recipe for yet.
 */
export type SitePartRole = 'tower' | 'gatehouse' | 'curtain-wall' | 'building' | 'moat' | 'plain';

/** Friendly names for the builder's role dropdown. */
export const ROLE_NAMES: Record<SitePartRole, string> = {
  tower: 'Tower',
  gatehouse: 'Gatehouse',
  'curtain-wall': 'Curtain wall',
  building: 'Building',
  moat: 'Moat / water',
  plain: 'Plain (no detail)',
};

/**
 * Name→role guesses, FIRST HIT WINS — and the order is load-bearing.
 *
 * "tower" must be tested before "wall", because the Captain's real labels
 * include "Southwest Innerwall Tower" and "North West Inner Tower": the
 * substring "wall" lives inside "Innerwall", so a wall-first scan would dress
 * four of his round towers as curtain walls. Every entry below was checked
 * against the Tower of London survey in model-review.json.
 */
const ROLE_KEYWORDS: Array<[RegExp, SitePartRole]> = [
  [/tower|drum|turret|bastion/i, 'tower'],
  [/gate|barbican|portcullis/i, 'gatehouse'],
  [/keep|hall|chapel|donjon|lodging/i, 'building'],
  [/wall|curtain|rampart|enceinte/i, 'curtain-wall'],
  [/moat|ditch|river|water/i, 'moat'],
];

/** The role a part falls back to when its name says nothing. */
const ROLE_BY_TYPE: Record<SitePartType, SitePartRole> = {
  box: 'building',
  cylinder: 'tower',
  wall: 'curtain-wall',
  platform: 'plain',
  water: 'moat',
};

/**
 * The role the mason should build this part as: an explicit override first
 * (the builder's dropdown), then the Captain's own name, then the part type.
 * Pure — the whole inference is unit-tested against his real labels.
 */
export function roleFor(part: SitePart): SitePartRole {
  if (part.role) return part.role;
  const name = part.label ?? '';
  if (name) {
    for (const [re, role] of ROLE_KEYWORDS) if (re.test(name)) return role;
  }
  return ROLE_BY_TYPE[part.type] ?? 'plain';
}

/** Roles the mason can currently dress. The vertical slice ships ONE. */
export const BAKED_ROLES: readonly SitePartRole[] = ['curtain-wall'];

/**
 * Is this part one the baked glb takes over? A part qualifies only when the
 * mason has a recipe for its role AND the geometry is a traced run he can walk
 * (a wall needs at least one segment). Date-range agreement is checked
 * separately by `bakedParts` — a single static glb can only carry one range.
 */
export function isBakeableRole(part: SitePart): boolean {
  if (!BAKED_ROLES.includes(roleFor(part))) return false;
  return part.type === 'wall' && (part.verts?.length ?? 0) >= 2;
}

/** Two parts stand and fall together (same timeline gate)? */
function sameSpan(a: SitePart, b: SitePart): boolean {
  return (a.fromYear ?? null) === (b.fromYear ?? null) && (a.toYear ?? null) === (b.toYear ?? null);
}

/**
 * The parts a site's baked glb actually contains, with the one date span it
 * carries. ONE glb can only obey ONE timeline gate, so we bake the parts that
 * share the FIRST bakeable part's span and leave any others as live primitives
 * — a deliberate honesty limit, not an oversight: a wall added in a different
 * century keeps its own dates rather than being silently back-dated.
 */
export function bakedParts(plan: SitePlan): {
  indices: number[];
  fromYear?: number;
  toYear?: number;
} {
  const first = plan.parts.findIndex(isBakeableRole);
  if (first < 0) return { indices: [] };
  const lead = plan.parts[first];
  const indices: number[] = [];
  plan.parts.forEach((p, i) => {
    if (isBakeableRole(p) && sameSpan(p, lead)) indices.push(i);
  });
  return { indices, fromYear: lead.fromYear, toYear: lead.toYear };
}

/**
 * The glb filename a site bakes to. Review keys carry ':', '@', ',' and '.'
 * — all awkward in a URL path — so they flatten to a safe slug. Deterministic
 * so the exporter and the globe agree without a lookup table.
 */
export function siteGlbName(siteKey: string): string {
  const body = siteKey.replace(/^siteplan:/, '');
  return 'site-' + body.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export interface SitePart {
  type: SitePartType;
  /** What the mason builds this as when baked. Absent = inferred (roleFor). */
  role?: SitePartRole;
  /** Centre, for box/cylinder. */
  lat?: number;
  lon?: number;
  /** Box footprint in metres (width = east-west at rotation 0). */
  widthM?: number;
  lengthM?: number;
  /** Height above ground, metres (box/cylinder/wall/platform). */
  heightM?: number;
  /** Box heading, degrees clockwise from north. */
  rotationDeg?: number;
  /** Cylinder radius, metres. */
  radiusM?: number;
  /** Traced vertices for wall/platform/water, as [lat, lon] pairs. */
  verts?: Array<[number, number]>;
  /** Wall thickness, metres. */
  thicknessM?: number;
  /** CSS colour, e.g. "#d8d2c4". Water defaults translucent blue. */
  color?: string;
  /** Timeline gate: the part stands only in [fromYear, toYear] (signed years).
   * The Tower's wet moat: fromYear 1285, toYear 1843. */
  fromYear?: number;
  toYear?: number;
  /** A short name shown in the builder's parts list ("White Tower"). */
  label?: string;
}

export interface SitePlan {
  /** The site anchor (usually the monument's own placement coords). */
  origin: { lat: number; lon: number };
  parts: SitePart[];
}

/** Sensible starting dimensions when a part is first dropped on the ground. */
export const PART_DEFAULTS: Record<SitePartType, Partial<SitePart>> = {
  box: { widthM: 20, lengthM: 20, heightM: 12, rotationDeg: 0, color: '#d8d2c4' },
  cylinder: { radiusM: 6, heightM: 14, color: '#cfc9bb' },
  wall: { thicknessM: 3, heightM: 8, color: '#b8b2a4' },
  platform: { heightM: 2, color: '#a89f8d' },
  water: { color: '#3f6f9e' },
};

/** Friendly names for the palette + parts list. */
export const PART_NAMES: Record<SitePartType, string> = {
  box: 'Square building',
  cylinder: 'Round tower',
  wall: 'Wall',
  platform: 'Platform',
  water: 'Water',
};

/** How many traced vertices each traced type needs before it can be finished. */
export const MIN_VERTS: Record<'wall' | 'platform' | 'water', number> = {
  wall: 2, // a wall can be a single straight run
  platform: 3,
  water: 3,
};

const EARTH_M_PER_DEG_LAT = 111_320; // good enough at building scale

/** Convert a metre offset (east, north) at a latitude into (dLat, dLon). */
export function metresToDegrees(lat: number, eastM: number, northM: number): { dLat: number; dLon: number } {
  const mPerDegLon = EARTH_M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  return { dLat: northM / EARTH_M_PER_DEG_LAT, dLon: mPerDegLon > 1e-6 ? eastM / mPerDegLon : 0 };
}

/** Ground distance in metres between two lat/lon points (small-scale planar). */
export function distanceM(a: [number, number], b: [number, number]): number {
  const { eastM, northM } = offsetM(a, b);
  return Math.hypot(northM, eastM);
}

/** The metre offset (east, north) that carries `a` onto `b` — the inverse of
 * metresToDegrees, used to reposition a part onto a clicked ground point. */
export function offsetM(a: [number, number], b: [number, number]): { eastM: number; northM: number } {
  const northM = (b[0] - a[0]) * EARTH_M_PER_DEG_LAT;
  const eastM = (b[1] - a[1]) * EARTH_M_PER_DEG_LAT * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return { eastM, northM };
}

/**
 * Snap a just-clicked vertex onto an existing one when it lands close enough —
 * so traced walls MEET the keep's corner instead of hovering 40 cm off. Returns
 * the snapped vertex, or the original when nothing is within `tolM` metres.
 */
export function snapVert(
  vert: [number, number],
  targets: Array<[number, number]>,
  tolM = 3,
): [number, number] {
  let best: [number, number] | null = null;
  let bestD = tolM;
  for (const t of targets) {
    const d = distanceM(vert, t);
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ? [best[0], best[1]] : vert;
}

/** Every vertex of every part — the snap targets for the next trace click. */
export function allVerts(plan: SitePlan): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of plan.parts) {
    if (p.verts) out.push(...p.verts);
    else if (p.lat != null && p.lon != null) out.push([p.lat, p.lon]);
  }
  return out;
}

/** Move a whole part by a metre offset (centre AND traced vertices). */
export function movePart(part: SitePart, eastM: number, northM: number): SitePart {
  const next: SitePart = { ...part };
  if (next.lat != null && next.lon != null) {
    const { dLat, dLon } = metresToDegrees(next.lat, eastM, northM);
    next.lat = +(next.lat + dLat).toFixed(7);
    next.lon = +(next.lon + dLon).toFixed(7);
  }
  if (next.verts?.length) {
    next.verts = next.verts.map(([la, lo]) => {
      const { dLat, dLon } = metresToDegrees(la, eastM, northM);
      return [+(la + dLat).toFixed(7), +(lo + dLon).toFixed(7)] as [number, number];
    });
  }
  return next;
}

/** A part's ground anchor: its centre, or a trace's centroid. */
export function partAnchor(p: SitePart): [number, number] | null {
  if (p.lat != null && p.lon != null) return [p.lat, p.lon];
  if (p.verts?.length) {
    let la = 0, lo = 0;
    for (const [a, o] of p.verts) { la += a; lo += o; }
    return [la / p.verts.length, lo / p.verts.length];
  }
  return null;
}

/**
 * Move a part so its anchor lands EXACTLY on `target`. Works in degree deltas,
 * not metre deltas — a metre delta re-applied at a different latitude drifts
 * east/west (cos(lat) changes), which put a cross-continental "move here" 217 km
 * off in testing. Degree deltas land the anchor exactly at any distance; shape
 * distortion on traced verts is negligible at building scale.
 */
export function movePartTo(part: SitePart, target: [number, number]): SitePart {
  const anchor = partAnchor(part);
  if (!anchor) return part;
  const dLat = target[0] - anchor[0];
  const dLon = target[1] - anchor[1];
  const next: SitePart = { ...part };
  if (next.lat != null && next.lon != null) {
    next.lat = +(next.lat + dLat).toFixed(7);
    next.lon = +(next.lon + dLon).toFixed(7);
  }
  if (next.verts?.length) {
    next.verts = next.verts.map(([la, lo]) => [+(la + dLat).toFixed(7), +(lo + dLon).toFixed(7)] as [number, number]);
  }
  return next;
}

/** Clamp a part's dimensions to sane building-scale bounds. */
export function clampPart(part: SitePart): SitePart {
  const clamp = (v: number | undefined, lo: number, hi: number, dflt: number) =>
    Math.min(hi, Math.max(lo, v ?? dflt));
  const next: SitePart = { ...part };
  if (next.type === 'box') {
    next.widthM = clamp(next.widthM, 1, 500, 20);
    next.lengthM = clamp(next.lengthM, 1, 500, 20);
    next.heightM = clamp(next.heightM, 0.5, 200, 12);
    next.rotationDeg = ((next.rotationDeg ?? 0) % 360 + 360) % 360;
  } else if (next.type === 'cylinder') {
    next.radiusM = clamp(next.radiusM, 0.5, 250, 6);
    next.heightM = clamp(next.heightM, 0.5, 200, 14);
  } else if (next.type === 'wall') {
    next.thicknessM = clamp(next.thicknessM, 0.5, 30, 3);
    next.heightM = clamp(next.heightM, 0.5, 60, 8);
  } else if (next.type === 'platform') {
    next.heightM = clamp(next.heightM, 0.2, 60, 2);
  }
  return next;
}

/** Is a part standing at this (signed) year? Un-dated parts always stand. */
export function partStandsAt(part: SitePart, year: number): boolean {
  if (part.fromYear != null && year < part.fromYear) return false;
  if (part.toYear != null && year >= part.toYear) return false;
  return true;
}

/** The review/local key a site plan is stored under, from the monument's
 * placement key ("place:model@lat,lon" → "siteplan:model@lat,lon"). */
export function sitePlanKeyFor(placementKey: string): string {
  return placementKey.replace(/^place:/, 'siteplan:');
}

/** Parse anything that claims to be a SitePlan; null when it isn't usable. */
export function parseSitePlan(raw: unknown): SitePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SitePlan;
  if (!o.origin || typeof o.origin.lat !== 'number' || typeof o.origin.lon !== 'number') return null;
  if (!Array.isArray(o.parts)) return null;
  return { origin: { lat: o.origin.lat, lon: o.origin.lon }, parts: o.parts.map(clampPart) };
}
