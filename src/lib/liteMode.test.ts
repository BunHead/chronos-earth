import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  fpsTooLow,
  globeSettings,
  isMobileDevice,
  isMobileUA,
  isWeakGpu,
  lightModelName,
  liteReasons,
} from './liteMode';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36';
const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';
const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)';

describe('lite mode detection', () => {
  it('spots phones by user agent, not desktops', () => {
    expect(isMobileUA(IPHONE)).toBe(true);
    expect(isMobileUA(PIXEL)).toBe(true);
    expect(isMobileUA(WIN_CHROME)).toBe(false);
    expect(isMobileUA(undefined)).toBe(false);
  });

  it('flags software and basic Intel GPUs, not Iris or real cards', () => {
    expect(isWeakGpu('Google SwiftShader')).toBe(true);
    expect(isWeakGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe(true);
    expect(isWeakGpu('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isWeakGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isWeakGpu('ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isWeakGpu('Mesa Intel(R) HD Graphics 520 (SKL GT2)')).toBe(true);
    expect(isWeakGpu('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isWeakGpu('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)')).toBe(false);
    expect(isWeakGpu(RTX)).toBe(false);
    expect(isWeakGpu(null)).toBe(false);
  });

  it('a strong desktop has no reasons; each weak sign adds one', () => {
    const strong = { userAgent: WIN_CHROME, coarsePointer: false, deviceMemoryGb: 8, cores: 12, renderer: RTX };
    expect(liteReasons(strong)).toEqual([]);
    expect(liteReasons({ ...strong, userAgent: PIXEL })).toEqual(['mobile']);
    expect(liteReasons({ ...strong, coarsePointer: true })).toEqual(['touch']);
    expect(liteReasons({ ...strong, deviceMemoryGb: 4 })).toEqual(['low-memory']);
    expect(liteReasons({ ...strong, cores: 2 })).toEqual(['few-cores']);
    expect(liteReasons({ ...strong, renderer: 'Google SwiftShader' })).toEqual(['weak-gpu']);
    // Dad's PC: integrated Intel, 4 cores, 8 GB.
    expect(liteReasons({ ...strong, cores: 4, renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11)' })).toEqual(['weak-gpu']);
  });

  it('missing signals never count as weak', () => {
    expect(liteReasons({})).toEqual([]);
    expect(liteReasons({ deviceMemoryGb: 0, cores: 0, renderer: null })).toEqual([]);
  });

  it('touch-first devices count as mobile for model choice', () => {
    expect(isMobileDevice({ userAgent: WIN_CHROME, coarsePointer: true })).toBe(true);
    expect(isMobileDevice({ userAgent: WIN_CHROME, coarsePointer: false })).toBe(false);
  });

  it('low frame rate threshold', () => {
    expect(fpsTooLow(8)).toBe(true);
    expect(fpsTooLow(19.9)).toBe(true);
    expect(fpsTooLow(30)).toBe(false);
    expect(fpsTooLow(0)).toBe(false); // no frames = hidden tab, not a slow PC
    expect(fpsTooLow(NaN)).toBe(false);
  });
});

describe('lite mode switches the heavy paths off', () => {
  const lite = globeSettings(true);
  const full = globeSettings(false);

  it('turns off rivers, 3D models, fog, atmosphere, skybox and shadows', () => {
    expect(lite.rivers).toBe(false);
    expect(lite.models).toBe(false);
    expect(lite.fog).toBe(false);
    expect(lite.groundAtmosphere).toBe(false);
    expect(lite.skyAtmosphere).toBe(false);
    expect(lite.skyBox).toBe(false);
    expect(lite.shadows).toBe(false);
    expect(lite.requestRenderMode).toBe(true);
  });

  it('draws fewer pixels, coarser terrain and fewer pins than full', () => {
    expect(lite.resolutionScale).toBeLessThan(full.resolutionScale);
    expect(lite.maximumScreenSpaceError).toBeGreaterThan(full.maximumScreenSpaceError);
    expect(lite.markerShare).toBeLessThan(full.markerShare);
    expect(lite.minNotability).toBeGreaterThan(full.minNotability);
  });

  it('full mode keeps rivers and models', () => {
    expect(full.rivers).toBe(true);
    expect(full.models).toBe(true);
  });

  it('the globe actually reads these settings', () => {
    const src = readFileSync(new URL('../components/Globe.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/if \(LITE_SETTINGS\.models\)/);
    expect(src).toMatch(/LITE_SETTINGS\.rivers/);
    expect(src).toMatch(/if \(LITE\) applyLite\(viewer\)/);
    expect(src).toMatch(/LITE_SETTINGS\.minNotability/);
  });
});

describe('heavy scans fall back to the small build', () => {
  const manifest = {
    sphinx: { footprint: 1.899, kb: 509 },
    'sphinx-lite': { footprint: 13.95, kb: 39 },
    eiffel: { footprint: 20, kb: 526 },
    giza: { footprint: 45, kb: 52 },
  };

  it('swaps the Sphinx scan on phones / lite only', () => {
    expect(lightModelName('sphinx', manifest, true)).toBe('sphinx-lite');
    expect(lightModelName('sphinx', manifest, false)).toBe('sphinx');
  });

  it('leaves heavy models without a small build, and light models, alone', () => {
    expect(lightModelName('eiffel', manifest, true)).toBe('eiffel');
    expect(lightModelName('giza', manifest, true)).toBe('giza');
  });

  it('the shipped manifest has the small Sphinx', () => {
    const real = JSON.parse(readFileSync(new URL('../../public/models/manifest.json', import.meta.url), 'utf8'));
    expect(lightModelName('sphinx', real, true)).toBe('sphinx-lite');
  });
});
