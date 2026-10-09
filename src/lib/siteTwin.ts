/**
 * siteTwin.ts — is an imported monument the SAME place as a curated site?
 *
 * The curated site wins the overview and its imported twin is hidden. The old
 * test was "within 0.3° either way" — about 33 km — and nothing else, so one
 * curated site hid every monument around it: the Byzantine Empire marker in
 * Istanbul hid the Chora Church and the Church of the Holy Apostles, the Giza
 * pyramids hid Dahshur, Stonehenge hid Woodhenge. 119 real monuments in all,
 * found 6 Oct 2026.
 *
 * Now a twin needs evidence it is one place: the names agree (one contains
 * the other, accents and brackets aside, "Pumapunku" inside "Pumapunku
 * (Tiwanaku)"), still within the old 0.3° box, or the two pins sit within
 * 1.5 km of each other whatever they are called.
 */
const NEAR_KM = 1.5;
const BOX_DEG = 0.3;

export function foldName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface Pin {
  name: string;
  lat: number;
  lon: number;
}

export function isSiteTwin(site: Pin, ev: Pin): boolean {
  if (Math.abs(site.lat - ev.lat) >= BOX_DEG || Math.abs(site.lon - ev.lon) >= BOX_DEG) return false;
  const km = Math.hypot(
    (site.lat - ev.lat) * 111.32,
    (site.lon - ev.lon) * 111.32 * Math.cos((ev.lat * Math.PI) / 180),
  );
  if (km < NEAR_KM) return true;
  const a = foldName(site.name);
  const b = foldName(ev.name);
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // A name of three letters or fewer is inside far too many others.
  return short.length >= 4 && long.includes(short);
}
