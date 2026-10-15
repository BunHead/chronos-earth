/**
 * pinCluster.ts — fold nearby pins into one numbered bubble.
 *
 * Not wired into the globe yet. Greedy and order-preserving: walk the pins in
 * the order given (put the most important first), and each pin either joins
 * the first bubble whose centre is within `radiusKm`, or starts a new one.
 * A bubble's centre is the mean of its pins, so it sits among them.
 */

export interface Pin {
  id: string;
  lat: number;
  lon: number;
}

export interface Cluster<T extends Pin = Pin> {
  lat: number;
  lon: number;
  /** How many pins the bubble holds — the number shown on it. */
  count: number;
  pins: T[];
}

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function clusterPins<T extends Pin>(pins: readonly T[], radiusKm: number): Cluster<T>[] {
  const out: Cluster<T>[] = [];
  for (const p of pins) {
    const c = out.find((k) => distanceKm(k.lat, k.lon, p.lat, p.lon) <= radiusKm);
    if (!c) {
      out.push({ lat: p.lat, lon: p.lon, count: 1, pins: [p] });
      continue;
    }
    c.pins.push(p);
    c.count = c.pins.length;
    // Mean centre; longitude averaged as a unit vector so ±180° doesn't break it.
    c.lat = c.pins.reduce((s, q) => s + q.lat, 0) / c.count;
    const x = c.pins.reduce((s, q) => s + Math.cos((q.lon * Math.PI) / 180), 0);
    const y = c.pins.reduce((s, q) => s + Math.sin((q.lon * Math.PI) / 180), 0);
    c.lon = (Math.atan2(y, x) * 180) / Math.PI;
  }
  return out;
}
