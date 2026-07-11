/**
 * review.ts — the Workshop's model-review store (Stage A of the maker's tools).
 *
 * Zero-cost, single-curator persistence. The review file lives in the repo and
 * is served like any other data, so ANYONE can read it (status badges show for
 * all visitors). But only someone holding a GitHub write-token — the Captain,
 * in his own browser — can SAVE: decisions commit straight to GitHub's contents
 * API. The token lives only in localStorage, never in the site, never committed.
 * That is the vandal-proofing — you cannot change a monument without write
 * access to the repo, so a stranger's "Reject" simply never persists.
 *
 * All browser APIs (localStorage/fetch/btoa) are touched INSIDE functions only,
 * so importing this module stays safe under the node/parity tests.
 */

const OWNER = 'BunHead';
const REPO = 'chronos-earth';
const FILE_PATH = 'public/data/model-review.json';
const TOKEN_KEY = 'ce_maker_token';
let validatedToken: string | null = null;

export type ReviewStatus = 'approved' | 'allowed' | 'rejected';

export interface ReviewRecord {
  status?: ReviewStatus;
  note?: string;
  rework?: boolean; // Captain flagged it for a rework / bake-off
  focus?: string; // what to focus the rework on (roof / colour / …)
  ts?: number; // last change, ms epoch
}

export type ReviewData = Record<string, ReviewRecord>;

// ── maker identity ─────────────────────────────────────────────────────────
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string): void {
  validatedToken = null;
  try {
    if (t && t.trim()) localStorage.setItem(TOKEN_KEY, t.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private-mode / disabled storage — maker mode just stays off */
  }
}
export function isMaker(): boolean {
  const token = getToken();
  return !!token && token === validatedToken;
}

/**
 * Prove the token can actually write this repository before revealing maker
 * controls. A random string in localStorage is not identity; GitHub's own
 * repository permission response is the gate.
 */
export async function validateMakerToken(candidate?: string): Promise<{ ok: boolean; msg: string }> {
  const token = (candidate ?? getToken() ?? '').trim();
  if (!token) return { ok: false, msg: 'Paste a GitHub token first.' };
  if (validatedToken === token) return { ok: true, msg: 'Maker access verified.' };
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, msg: `GitHub rejected this key (HTTP ${res.status}).` };
    const repo = (await res.json()) as { permissions?: { push?: boolean; admin?: boolean; maintain?: boolean } };
    if (!repo.permissions?.push && !repo.permissions?.admin && !repo.permissions?.maintain) {
      return { ok: false, msg: 'This key can read the repo but cannot save reviews.' };
    }
    validatedToken = token;
    return { ok: true, msg: 'Maker access verified.' };
  } catch {
    return { ok: false, msg: 'Could not verify the key with GitHub. Check your connection.' };
  }
}

// ── read (everyone) ────────────────────────────────────────────────────────
/** The served review file, cache-busted so a fresh save is visible next load. */
export async function loadReview(): Promise<ReviewData> {
  try {
    const r = await fetch(`./data/model-review.json?b=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return {};
    return (await r.json()) as ReviewData;
  } catch {
    return {};
  }
}

// ── write (maker only) ─────────────────────────────────────────────────────
/** Commit the whole review file to the repo via the GitHub contents API. */
export async function saveReview(data: ReviewData): Promise<{ ok: boolean; msg: string }> {
  const token = getToken();
  if (!token) return { ok: false, msg: 'No maker token set.' };
  const gate = await validateMakerToken(token);
  if (!gate.ok) return gate;
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };
  // The contents API needs the current file's blob SHA to replace it.
  let sha: string | undefined;
  try {
    const cur = await fetch(`${api}?ref=main&b=${Date.now()}`, { headers, cache: 'no-store' });
    if (cur.ok) sha = (await cur.json()).sha;
  } catch {
    /* first write — no existing file */
  }
  const json = JSON.stringify(data, null, 2) + '\n';
  const body = {
    message: 'Workshop: update model review',
    content: btoa(unescape(encodeURIComponent(json))), // UTF-8-safe base64
    branch: 'main',
    ...(sha ? { sha } : {}),
  };
  try {
    const res = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (res.ok) return { ok: true, msg: 'Saved ✓ — live in ~1 min after deploy.' };
    const err = await res.json().catch(() => ({}) as { message?: string });
    return { ok: false, msg: err.message || `Save failed (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, msg: `Network error: ${(e as Error).message}` };
  }
}

// ── app-side rejection (data-driven NO_3D) ─────────────────────────────────
// A model the Captain has Rejected shows the real photo instead of a wrong 3D,
// exactly like the hand-maintained NO_3D_NAMES list — but chosen from the
// Workshop, no code change. Battle reviews live in the SAME file under
// "battle:{id}" keys; a Rejected battle loses its 3D-battlefield button.
// The sets start empty (so the parity tests, which never call the loader,
// see the pure name→model logic unchanged).
const rejectedModels = new Set<string>();
const rejectedBattles = new Set<string>();

/** Fetch the review file and mark every Rejected item for suppression. */
export async function loadRejectedModels(): Promise<void> {
  const data = await loadReview();
  rejectedModels.clear();
  rejectedBattles.clear();
  for (const [key, rec] of Object.entries(data)) {
    if (rec.status !== 'rejected') continue;
    if (key.startsWith('battle:')) rejectedBattles.add(key.slice(7));
    else rejectedModels.add(key);
  }
}

export function isModelRejected(model: string | null | undefined): boolean {
  return !!model && rejectedModels.has(model);
}

export function isBattleRejected(id: string | null | undefined): boolean {
  return !!id && rejectedBattles.has(id);
}
