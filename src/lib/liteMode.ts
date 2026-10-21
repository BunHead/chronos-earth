/**
 * liteMode.ts — one switch for weak PCs and phones.
 *
 * The Captain's dad's PC has no graphics card, and the globe crawled on it
 * (Oct 2026). The old light path (renderTier 'software') only caught machines
 * that announce a CPU renderer; a basic Intel chip, a 2-core box or a phone
 * slipped through and got the desktop budget. Lite mode turns on when ANY
 * weak-device sign shows:
 *
 *   • a phone/tablet user agent, or a coarse (touch) primary pointer
 *   • little memory (navigator.deviceMemory ≤ 4 GB) or few cores (≤ 2)
 *   • a software or basic Intel integrated WebGL renderer
 *   • a low frame rate in the first seconds after load (remembered, so the
 *     NEXT visit starts lite)
 *
 * Override: ⋯ → Settings → Lite Mode (Auto / On / Off), or `?perf=low` (on),
 * `?perf=high` (off), `?perf=auto`. It shares the `chronos.perf` key with the
 * older "Lighter Graphics" switch, so a saved choice carries over.
 *
 * The detectors are pure functions so they can be unit-tested without a browser.
 */
import { classifyRenderer, readRendererString } from './renderTier';

export interface DeviceSignals {
  userAgent?: string;
  /** matchMedia('(pointer: coarse)') — the PRIMARY pointer is a finger. */
  coarsePointer?: boolean;
  deviceMemoryGb?: number;
  cores?: number;
  /** WebGL UNMASKED_RENDERER string, or null when withheld. */
  renderer?: string | null;
}

export type LiteReason = 'mobile' | 'touch' | 'low-memory' | 'few-cores' | 'weak-gpu' | 'slow-fps' | 'chosen';

export function isMobileUA(ua: string | undefined): boolean {
  return !!ua && /android|iphone|ipad|ipod|mobile|silk|kindle|opera mini|iemobile/i.test(ua);
}

/**
 * A GPU too weak for the full globe: a CPU renderer (SwiftShader, llvmpipe…)
 * or a basic Intel integrated chip (HD / UHD Graphics, GMA). Iris and Arc are
 * Intel's stronger parts and are left alone.
 */
export function isWeakGpu(renderer: string | null | undefined): boolean {
  if (!renderer) return false;
  if (classifyRenderer(renderer) === 'software') return true;
  const r = renderer.toLowerCase();
  if (!r.includes('intel')) return false;
  if (/iris|\barc\b/.test(r)) return false;
  return /\b(u?hd) graphics|\bgma\b|mesa intel|intel\(r\) graphics/.test(r);
}

/** Frames per second below which the globe counts as struggling. */
const SLOW_FPS = 20;
export function fpsTooLow(fps: number): boolean {
  return Number.isFinite(fps) && fps > 0 && fps < SLOW_FPS;
}

/** Every weak-device sign present — empty means "run the full globe". */
export function liteReasons(s: DeviceSignals): LiteReason[] {
  const out: LiteReason[] = [];
  if (isMobileUA(s.userAgent)) out.push('mobile');
  if (s.coarsePointer) out.push('touch');
  if (typeof s.deviceMemoryGb === 'number' && s.deviceMemoryGb > 0 && s.deviceMemoryGb <= 4) out.push('low-memory');
  if (typeof s.cores === 'number' && s.cores > 0 && s.cores <= 2) out.push('few-cores');
  if (isWeakGpu(s.renderer)) out.push('weak-gpu');
  return out;
}

/** Is this a phone or tablet, whatever the visitor chose? Used to keep heavy
 * scans off small devices even when lite is switched off. */
export function isMobileDevice(s: DeviceSignals): boolean {
  return isMobileUA(s.userAgent) || !!s.coarsePointer;
}

/** What the globe does in each mode. Pure, so tests can check that lite
 * really switches the heavy paths off. */
export interface GlobeSettings {
  resolutionScale: number;
  /** Cesium's terrain detail knob: HIGHER = coarser = fewer tiles (default 2). */
  maximumScreenSpaceError: number;
  fog: boolean;
  groundAtmosphere: boolean;
  skyAtmosphere: boolean;
  skyBox: boolean;
  shadows: boolean;
  /** Draw only when something changes. */
  requestRenderMode: boolean;
  rivers: boolean;
  models: boolean;
  /** Share of the normal marker caps. */
  markerShare: number;
  /** Imported events below this notability (sitelinks) are not pinned in the
   * overview. Cities rank by prominence and are exempt. */
  minNotability: number;
}

export function globeSettings(lite: boolean): GlobeSettings {
  return lite
    ? {
        resolutionScale: 0.6,
        maximumScreenSpaceError: 4,
        fog: false,
        groundAtmosphere: false,
        skyAtmosphere: false,
        skyBox: false,
        shadows: false,
        requestRenderMode: true,
        rivers: false,
        // The monuments ARE the app: lite keeps them, on their small builds
        // (lightModelName) and only within reach (globeModels' LOAD_DISTANCE).
        // Leaving them out made a desktop that once started slowly show no 3D
        // at all, with no hint why (19 Oct 2026).
        models: true,
        markerShare: 0.5,
        minNotability: 25,
      }
    : {
        resolutionScale: 1,
        maximumScreenSpaceError: 2,
        fog: true,
        groundAtmosphere: true,
        skyAtmosphere: true,
        skyBox: true,
        shadows: false,
        requestRenderMode: true,
        rivers: true,
        models: true,
        markerShare: 1,
        minNotability: 0,
      };
}

/** A scan heavier than this (KB) is swapped for its small `-lite` build on
 * phones and weak machines — the Sphinx scan is 509 KB, her old model 39 KB. */
const HEAVY_MODEL_KB = 300;
export function lightModelName(
  model: string,
  manifest: Record<string, { footprint: number; kb?: number }>,
  preferSmall: boolean,
): string {
  if (!preferSmall) return model;
  const info = manifest[model];
  const lite = manifest[`${model}-lite`];
  return info && (info.kb ?? 0) > HEAVY_MODEL_KB && lite?.footprint ? `${model}-lite` : model;
}

// ── Browser side ────────────────────────────────────────────────────────────

export type LitePref = 'auto' | 'on' | 'off';
const PREF_KEY = 'chronos.perf'; // 'low' = on, 'high' = off, absent = auto
const SLOW_KEY = 'chronos.lite.slow'; // the time (ms) a slow frame rate was seen

export function readLitePref(): LitePref {
  try {
    if (typeof window === 'undefined') return 'auto';
    const q = new URLSearchParams(window.location.search).get('perf');
    if (q === 'low' || q === 'high') window.localStorage.setItem(PREF_KEY, q);
    else if (q === 'auto') {
      window.localStorage.removeItem(PREF_KEY);
      window.localStorage.removeItem(SLOW_KEY);
    }
    const v = window.localStorage.getItem(PREF_KEY);
    return v === 'low' ? 'on' : v === 'high' ? 'off' : 'auto';
  } catch {
    return 'auto';
  }
}

export function setLitePref(p: LitePref): void {
  try {
    if (p === 'on') window.localStorage.setItem(PREF_KEY, 'low');
    else if (p === 'off') window.localStorage.setItem(PREF_KEY, 'high');
    else {
      window.localStorage.removeItem(PREF_KEY);
      window.localStorage.removeItem(SLOW_KEY);
    }
  } catch { /* storage blocked — the choice just won't stick */ }
}

/** Read once — probing the renderer creates a WebGL context. */
let cachedSignals: DeviceSignals | null = null;
function readSignals(): DeviceSignals {
  if (cachedSignals) return cachedSignals;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
  let coarse = false;
  try {
    coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  } catch { /* old browser */ }
  return (cachedSignals = {
    userAgent: navigator.userAgent,
    coarsePointer: coarse,
    deviceMemoryGb: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
    cores: navigator.hardwareConcurrency,
    renderer: readRendererString(),
  });
}

/** Why lite is on (empty = it's off). Probed once per page. */
let cachedReasons: LiteReason[] | null = null;
export function activeLiteReasons(): LiteReason[] {
  if (cachedReasons) return cachedReasons;
  const pref = readLitePref();
  if (pref === 'off') return (cachedReasons = []);
  const reasons = liteReasons(readSignals());
  try {
    if (slowMarkFresh(window.localStorage.getItem(SLOW_KEY), Date.now())) reasons.push('slow-fps');
    else window.localStorage.removeItem(SLOW_KEY);
  } catch { /* no storage */ }
  if (pref === 'on') reasons.push('chosen');
  return (cachedReasons = reasons);
}

export function isLite(): boolean {
  return activeLiteReasons().length > 0;
}

/** Prefer small model builds: lite, or any phone/tablet even with lite off. */
export function preferSmallModels(): boolean {
  return isLite() || isMobileDevice(readSignals());
}

/** A slow start is remembered for a week, then the globe tries full again
 * (one busy first few seconds must not make a good PC lite for ever). The
 * old mark '1' carries no date, so it counts as expired. */
export const SLOW_MARK_DAYS = 7;
export function slowMarkFresh(mark: string | null, now: number): boolean {
  const t = Number(mark);
  return !!mark && mark !== '1' && Number.isFinite(t) && now - t < SLOW_MARK_DAYS * 86_400_000;
}

/** Remember a slow first few seconds so the next visit starts lite. */
export function markSlowDevice(): void {
  try {
    window.localStorage.setItem(SLOW_KEY, String(Date.now()));
  } catch { /* no storage */ }
  if (cachedReasons && !cachedReasons.includes('slow-fps')) cachedReasons = [...cachedReasons, 'slow-fps'];
}
