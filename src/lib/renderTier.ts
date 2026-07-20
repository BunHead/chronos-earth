/**
 * renderTier.ts — what machine are we actually running on?
 *
 * The globe's heavy layers (border frames, palaeo epochs) were tuned on a
 * desktop with a real graphics card, and the sizing question was answered with
 * `navigator.deviceMemory`. That was WRONG, and it showed the first time the
 * app met a machine without a GPU: deviceMemory reports system RAM, so a box
 * with 8 GB of RAM and no graphics card at all scored the MOST generous
 * setting — sixteen 4096×2048 textures, plus background pre-rasterising — and
 * ground to a halt (two minutes between drift frames, 2026-07-20).
 *
 * So ask the renderer itself. WebGL's WEBGL_debug_renderer_info exposes the
 * driver string, and software rasterisers announce themselves plainly:
 * SwiftShader (Chrome's fallback), llvmpipe/softpipe (Mesa), Microsoft Basic
 * Render Driver. When we see one, we are drawing every pixel on the CPU and
 * must behave accordingly — smaller textures, a tiny resident cache, and no
 * speculative work at all.
 *
 * The classifier is a pure function so it can be unit-tested against real
 * driver strings without a browser.
 */

export type RenderTier =
  /** No GPU — every pixel is drawn on the CPU. Spend nothing speculatively. */
  | 'software'
  /** Integrated or unknown graphics. Works, but don't be greedy. */
  | 'modest'
  /** A real graphics card with room to spare. */
  | 'capable';

/** Driver-string fragments that mean "there is no graphics card here". */
const SOFTWARE_MARKERS = [
  'swiftshader',
  'llvmpipe',
  'softpipe',
  'basic render', // "Microsoft Basic Render Driver"
  'software rasterizer',
  'mesa offscreen',
  'google inc. (google)', // Chrome's masked string when it falls back to SwiftShader
];

/**
 * Classify a machine from its WebGL renderer string (and RAM as a weak
 * secondary signal). `renderer` is null when the browser withholds it.
 */
export function classifyRenderer(
  renderer: string | null,
  deviceMemoryGb?: number,
): RenderTier {
  const r = (renderer ?? '').toLowerCase();
  if (r && SOFTWARE_MARKERS.some((m) => r.includes(m))) return 'software';

  // A dedicated card names itself. These are safely 'capable' regardless of
  // how much system RAM the machine happens to have.
  if (/nvidia|geforce|quadro|radeon|rx \d|apple m\d/.test(r)) return 'capable';

  // Everything else — Intel integrated, unknown, or a withheld string. RAM is
  // a poor proxy for graphics power, so it can only ever promote to 'modest',
  // never to 'capable'.
  if (typeof deviceMemoryGb === 'number' && Number.isFinite(deviceMemoryGb) && deviceMemoryGb < 4) {
    return 'software'; // genuinely tiny machine; treat it as gently as a CPU renderer
  }
  return 'modest';
}

/** Read the driver string, or null if the browser withholds it / WebGL fails. */
export function readRendererString(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'software'; // no WebGL at all is the weakest case of all
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    const s = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof s === 'string' ? s : null;
  } catch {
    return null;
  }
}

/** Manual override, so the Captain can force the light path when showing the
 * app on someone else's machine: `?perf=low` (or `?perf=high` to force full).
 * Sticky in localStorage, like the tiling flag. */
function overrideTier(): RenderTier | null {
  try {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('perf');
    if (q === 'low' || q === 'high') {
      window.localStorage.setItem('chronos.perf', q);
    } else if (q === 'auto') {
      window.localStorage.removeItem('chronos.perf');
    }
    const saved = window.localStorage.getItem('chronos.perf');
    if (saved === 'low') return 'software';
    if (saved === 'high') return 'capable';
    return null;
  } catch {
    return null;
  }
}

let cached: RenderTier | null = null;

/** The tier for this session — probed once, then remembered. */
export function renderTier(): RenderTier {
  if (cached) return cached;
  const forced = overrideTier();
  if (forced) {
    cached = forced;
    return cached;
  }
  const mem =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
      : undefined;
  cached = classifyRenderer(readRendererString(), mem);
  return cached;
}

/** Test seam. */
export function __setRenderTier(t: RenderTier | null): void {
  cached = t;
}

/**
 * Size of a full-globe equirectangular texture for this tier.
 *
 * The cost here is not really video memory — it is the PNG ENCODE, which runs
 * on the main thread and scales with pixel count. Halving each side quarters
 * that cost, which is the difference between a pause and a freeze on a CPU
 * renderer.
 */
export function globeTextureSize(tier: RenderTier = renderTier()): { w: number; h: number } {
  if (tier === 'software') return { w: 2048, h: 1024 };
  return { w: 4096, h: 2048 };
}

/** May we do speculative work — warming frames, pre-rasterising ahead? Only
 * where there are cycles going spare. On a CPU renderer that work competes
 * directly with drawing the globe the visitor is looking at right now. */
export function mayWorkAhead(tier: RenderTier = renderTier()): boolean {
  return tier !== 'software';
}
