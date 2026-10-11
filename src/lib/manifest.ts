/**
 * manifest.ts — the ship's manifest: patrons who keep Chronos Earth free.
 *
 * The names live in public/data/supporters.json and the Captain adds them by
 * hand (no Patreon API — it stays zero-cost). Either form is accepted, in the
 * order people came aboard:
 *
 *   "patrons": [ "Ada", { "name": "Brunel", "founding": true } ]
 *
 * The first 20 aboard are FOUNDING patrons and wear a star, as the launch kit
 * promises. An explicit "founding" on an entry overrides its place in line.
 */
export const PATREON_URL = 'https://www.patreon.com/ChronosEarth';
export const FOUNDING_BERTHS = 20;

export interface CrewMember {
  name: string;
  founding: boolean;
}

/** Tidy whatever the JSON holds into a crew list; never throws. */
export function readManifest(data: unknown): CrewMember[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { patrons?: unknown }).patrons)
      ? (data as { patrons: unknown[] }).patrons
      : [];
  const crew: CrewMember[] = [];
  for (const entry of raw) {
    const name = typeof entry === 'string'
      ? entry
      : entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string'
        ? (entry as { name: string }).name
        : '';
    const clean = name.trim().slice(0, 60);
    if (!clean) continue;
    const flag = entry && typeof entry === 'object' ? (entry as { founding?: unknown }).founding : undefined;
    crew.push({ name: clean, founding: typeof flag === 'boolean' ? flag : crew.length < FOUNDING_BERTHS });
  }
  return crew;
}

/** Fetch the manifest fresh (it changes by hand, so skip any cached copy). */
export async function loadManifest(): Promise<CrewMember[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/supporters.json?b=${Date.now()}`);
    return res.ok ? readManifest(await res.json()) : [];
  } catch {
    return [];
  }
}
