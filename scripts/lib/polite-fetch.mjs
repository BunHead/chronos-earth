/**
 * polite-fetch.mjs — fetch from Wikipedia / Wikimedia Commons without being
 * rate-limited.
 *
 * WHY. fetch-portraits and fetch-battle-maps kept dying with HTTP 429 ("too
 * many requests"). They ran two requests at once, waited only a moment
 * between them, and ignored the server's Retry-After header. Wikimedia asks
 * bots to go one request at a time, identify themselves with a real
 * User-Agent, and back off when told to (https://meta.wikimedia.org/wiki/User-Agent_policy).
 *
 * This helper does exactly that:
 *   - one request at a time (calls queue up behind each other);
 *   - a small gap between requests;
 *   - on 429 / 503 (and 502 / 504 / network errors) wait and retry, doubling
 *     the wait each time, or waiting as long as Retry-After says if longer;
 *   - give up after a fixed number of retries, so a run never hangs forever.
 */

export const USER_AGENT =
  'ChronosEarth/1.0 (https://github.com/BunHead/chronos-earth; educational history globe) node-fetch';

const RETRY_STATUS = new Set([429, 502, 503, 504]);

/**
 * How long Retry-After asks us to wait, in ms, or null if absent/unreadable.
 * It is either a number of seconds ("120") or an HTTP date.
 */
export function retryAfterMs(header, now = Date.now()) {
  if (header == null || header === '') return null;
  const s = String(header).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  const at = Date.parse(s);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - now);
}

/** The wait before retry number `attempt` (0-based): base · 2^attempt, capped. */
export function backoffMs(attempt, { baseDelayMs = 1000, maxDelayMs = 60_000 } = {}) {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
}

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status}`);
    this.status = status;
    this.url = url;
  }
}

/**
 * Make a polite fetch function. Options (all optional):
 *   fetchImpl   the fetch to use (tests pass a mock)          default: fetch
 *   sleep       (ms) => Promise (tests pass a fake clock)      default: setTimeout
 *   gapMs       pause between any two requests                default: 500
 *   maxRetries  retries after the first try, then give up      default: 5
 *   baseDelayMs first backoff wait                             default: 1000
 *   maxDelayMs  cap on any single wait (incl. Retry-After)     default: 60000
 *   userAgent                                                  default: USER_AGENT
 *   log         (message) => void, told about each retry       default: console.warn
 *
 * The returned function takes (url, init) like fetch, resolves to an OK
 * Response, and throws HttpError for a final non-OK status.
 */
export function createPoliteFetch(opts = {}) {
  const {
    fetchImpl = globalThis.fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    gapMs = 500,
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 60_000,
    userAgent = USER_AGENT,
    log = (m) => console.warn(m),
  } = opts;

  let queue = Promise.resolve();
  let first = true;

  async function once(url, init) {
    for (let attempt = 0; ; attempt++) {
      if (!first) await sleep(gapMs);
      first = false;
      let res;
      let netErr = null;
      try {
        res = await fetchImpl(url, {
          ...init,
          headers: { 'User-Agent': userAgent, 'Api-User-Agent': userAgent, ...(init?.headers ?? {}) },
        });
      } catch (err) {
        netErr = err;
      }
      if (res?.ok) return res;
      const retryable = netErr || RETRY_STATUS.has(res.status);
      if (!retryable || attempt >= maxRetries) {
        if (netErr) throw netErr;
        throw new HttpError(res.status, url);
      }
      let wait = backoffMs(attempt, { baseDelayMs, maxDelayMs });
      const asked = res ? retryAfterMs(res.headers?.get?.('retry-after')) : null;
      if (asked !== null) wait = Math.min(maxDelayMs, Math.max(wait, asked));
      log(`  ${netErr ? netErr.message : `HTTP ${res.status}`} — waiting ${(wait / 1000).toFixed(1)} s, retry ${attempt + 1}/${maxRetries}`);
      await sleep(wait);
    }
  }

  return function politeFetch(url, init) {
    // Chain onto the queue so only one request is ever in flight.
    const run = queue.then(() => once(url, init));
    queue = run.catch(() => {});
    return run;
  };
}

/** Read `--limit N` from argv (for a small test run); Infinity if absent. */
export function limitFromArgs(argv = process.argv) {
  const i = argv.indexOf('--limit');
  const n = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}
