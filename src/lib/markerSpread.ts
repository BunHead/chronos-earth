/**
 * markerSpread.ts — share the marker slots out across the world.
 *
 * THE CAPTAIN'S COMPLAINT, twice over: "Europe looks crowded, while the rest of
 * the world is bare", and then a list of what he could not find — Moscow,
 * Lisbon, Madrid, practically all African capitals, Australia, New Zealand,
 * Borneo, India, Pakistan, Nepal.
 *
 * Some of that was missing DATA and is fixed elsewhere. The rest is arithmetic.
 * At the widest view there are ten city slots, filled by one worldwide sort on
 * fame, and the ten most written-about cities on Earth are Paris, London, Rome,
 * Berlin, Vienna, Monaco… A single global ranking will ALWAYS fill from Europe,
 * however good the data is, because that is what the ranking measures.
 *
 * So the slots are not handed out by rank alone. Take the best candidate, then
 * refuse anything too close to something already taken, and keep going. London
 * loses its slot to Paris — at a view where the whole planet is on screen they
 * are the same dot anyway — and the slot it frees goes to Cairo or Delhi or
 * Lima. Zoom in and the separation shrinks, so London comes straight back.
 *
 * This is the standard cartographic answer to label collision, and it is the
 * honest one: nothing is invented, nothing is re-weighted, and no region is
 * given a quota. The map simply stops spending nine of its ten slots on one
 * peninsula.
 */

export interface Placed {
  lat: number;
  lon: number;
}

/**
 * Great-circle distance in km, near enough at these scales, and correct across
 * the dateline — which matters, or Anchorage and Anadyr count as far apart.
 */
export function separationKm(a: Placed, b: Placed): number {
  const R = 111.32;
  let dLon = Math.abs(a.lon - b.lon);
  if (dLon > 180) dLon = 360 - dLon;
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  return Math.hypot((a.lat - b.lat) * R, dLon * R * Math.cos(midLat));
}

/**
 * Fill `slots` from `ranked` (best first), preferring candidates at least
 * `minKm` from everything already chosen.
 *
 * IT ALWAYS FILLS THE SLOTS. Spreading is a preference, not a quota: if the
 * separation rule cannot find enough — zoomed into one city, or scrubbed to a
 * year with few events — the remainder is topped up in plain rank order. A view
 * that draws eight markers because the ninth was too close to the eighth would
 * be a worse map, not a purer one.
 */
export function spreadPick<T extends Placed>(ranked: T[], slots: number, minKm: number): T[] {
  if (slots <= 0) return [];
  if (minKm <= 0 || ranked.length <= slots) return ranked.slice(0, slots);

  const out: T[] = [];
  const taken = new Set<T>();
  for (const c of ranked) {
    if (out.length >= slots) break;
    if (out.every((o) => separationKm(o, c) >= minKm)) {
      out.push(c);
      taken.add(c);
    }
  }
  if (out.length < slots) {
    for (const c of ranked) {
      if (out.length >= slots) break;
      if (!taken.has(c)) out.push(c);
    }
  }
  return out;
}

/** Mean Earth radius in metres — good enough for a horizon test. */
const EARTH_R = 6_371_000;

/**
 * Is this point on the half of the planet the camera can actually see?
 *
 * FROM ORBIT YOU ONLY EVER SEE ONE SIDE, and the marker budget did not know
 * that. At the widest tier the whole world competed for ten city slots and the
 * winners were scattered over the entire globe, so on any given view roughly
 * half of them were behind the Earth: drawn, counted, occluded, wasted. Turn to
 * Africa and the slots that could have shown you Cairo, Lagos and Nairobi were
 * being spent on Tokyo and Bangkok, out of sight round the back. That is the
 * other half of "Europe looks crowded, while the rest of the world is bare".
 *
 * The visible cap is not a hemisphere: from height h the horizon sits at
 * arccos(R / (R + h)) from the sub-camera point — about 72 degrees at the
 * Captain's usual 14,000 km, not 90. A small margin past it keeps a marker from
 * blinking out exactly as it reaches the limb.
 */
export function withinHorizon(
  cam: Placed & { height: number },
  p: Placed,
  marginDeg = 4,
): boolean {
  const capRad = Math.acos(Math.min(1, EARTH_R / (EARTH_R + Math.max(0, cam.height))));
  const cap = capRad * (180 / Math.PI) + marginDeg;
  const toRad = Math.PI / 180;
  const cosC =
    Math.sin(cam.lat * toRad) * Math.sin(p.lat * toRad) +
    Math.cos(cam.lat * toRad) * Math.cos(p.lat * toRad) * Math.cos((p.lon - cam.lon) * toRad);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosC))) * (180 / Math.PI);
  return angle <= cap;
}
