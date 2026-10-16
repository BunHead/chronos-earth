import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs helper shared with the node fetch scripts
import { backoffMs, createPoliteFetch, HttpError, limitFromArgs, retryAfterMs, USER_AGENT } from '../../scripts/lib/polite-fetch.mjs';

/** A fake Response: just what politeFetch reads. */
const reply = (status: number, retryAfter?: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (h: string) => (h.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) },
});

/** A mock fetch that answers from a script, and records every call. */
function scripted(statuses: Array<number | [number, string] | Error>) {
  const calls: Array<{ url: string; init: { headers: Record<string, string> } }> = [];
  const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, init });
    const next = statuses.shift() ?? 200;
    if (next instanceof Error) throw next;
    return Array.isArray(next) ? reply(next[0], next[1]) : reply(next);
  };
  return { calls, fetchImpl };
}

/** No real waiting in tests: record the waits instead. */
function fakeSleep() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => { waits.push(ms); } };
}

describe('polite fetch — backs off instead of hammering Wikipedia', () => {
  it('retries a 429 with doubling waits, then succeeds', async () => {
    const { calls, fetchImpl } = scripted([429, 429, 200]);
    const { waits, sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 0, baseDelayMs: 1000, log: () => {} });
    const res = await get('https://example.org/a');
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(waits.filter((w) => w > 0)).toEqual([1000, 2000]);
  });

  it('waits as long as Retry-After says when that is longer', async () => {
    const { fetchImpl } = scripted([[503, '7'], 200]);
    const { waits, sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 0, baseDelayMs: 1000, log: () => {} });
    await get('https://example.org/a');
    expect(waits.filter((w) => w > 0)).toEqual([7000]);
  });

  it('caps any one wait, even if Retry-After asks for an hour', async () => {
    const { fetchImpl } = scripted([[429, '3600'], 200]);
    const { waits, sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 0, maxDelayMs: 30_000, log: () => {} });
    await get('https://example.org/a');
    expect(waits.filter((w) => w > 0)).toEqual([30_000]);
  });

  it('gives up after maxRetries and says why', async () => {
    const { calls, fetchImpl } = scripted([429, 429, 429, 429, 429]);
    const { sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 0, maxRetries: 2, log: () => {} });
    await expect(get('https://example.org/a')).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(3); // first try + 2 retries
  });

  it('does not retry a plain 404', async () => {
    const { calls, fetchImpl } = scripted([404]);
    const { sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 0, log: () => {} });
    await expect(get('https://example.org/a')).rejects.toThrow('HTTP 404');
    expect(calls).toHaveLength(1);
  });

  it('retries a dropped connection', async () => {
    const { calls, fetchImpl } = scripted([new Error('socket hang up'), 200]);
    const { sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 0, log: () => {} });
    expect((await get('https://example.org/a')).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('sends a proper User-Agent', async () => {
    const { calls, fetchImpl } = scripted([200]);
    const get = createPoliteFetch({ fetchImpl, sleep: fakeSleep().sleep, log: () => {} });
    await get('https://example.org/a', { headers: { Accept: 'application/json' } });
    expect(calls[0].init.headers['User-Agent']).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/github\.com\/BunHead\/chronos-earth/);
    expect(calls[0].init.headers.Accept).toBe('application/json');
  });

  it('runs one request at a time, with a gap between them', async () => {
    let inFlight = 0;
    let most = 0;
    const fetchImpl = async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return reply(200);
    };
    const { waits, sleep } = fakeSleep();
    const get = createPoliteFetch({ fetchImpl, sleep, gapMs: 400, log: () => {} });
    await Promise.all([get('a'), get('b'), get('c')]);
    expect(most).toBe(1);
    expect(waits).toEqual([400, 400]); // no gap before the very first request
  });
});

describe('polite fetch — small helpers', () => {
  it('reads Retry-After as seconds or as a date', () => {
    expect(retryAfterMs('5')).toBe(5000);
    expect(retryAfterMs('Thu, 15 Oct 2026 12:00:10 GMT', Date.parse('Thu, 15 Oct 2026 12:00:00 GMT'))).toBe(10_000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs('soon')).toBeNull();
  });

  it('doubles the backoff and caps it', () => {
    expect([0, 1, 2, 3].map((a) => backoffMs(a, { baseDelayMs: 500, maxDelayMs: 3000 }))).toEqual([500, 1000, 2000, 3000]);
  });

  it('reads --limit for a small test run', () => {
    expect(limitFromArgs(['node', 'x.mjs', '--limit', '5'])).toBe(5);
    expect(limitFromArgs(['node', 'x.mjs'])).toBe(Infinity);
  });
});
