import { describe, it, expect } from 'vitest';
import { classifyRenderer, globeTextureSize, mayWorkAhead } from './renderTier';

describe('classifyRenderer — real driver strings', () => {
  it('spots a CPU rasteriser however it announces itself', () => {
    // Chrome with no usable GPU falls back to SwiftShader; Mesa uses llvmpipe;
    // Windows without a display driver reports the Basic Render Driver.
    const software = [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
      'Mesa/X.org, llvmpipe (LLVM 15.0.7, 256 bits)',
      'Gallium 0.4 on softpipe',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)',
      'Software Rasterizer',
    ];
    for (const s of software) expect(classifyRenderer(s, 16)).toBe('software');
  });

  it('recognises a real graphics card even on a RAM-poor machine', () => {
    expect(classifyRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', 4)).toBe(
      'capable',
    );
    expect(classifyRenderer('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11)', 8)).toBe('capable');
    expect(classifyRenderer('Apple M2 Pro', 8)).toBe('capable');
  });

  it('treats integrated and unknown graphics as modest, never capable', () => {
    // This is the heart of the 2026-07-20 fix: plentiful RAM must not be read
    // as plentiful graphics.
    expect(classifyRenderer('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', 32)).toBe(
      'modest',
    );
    expect(classifyRenderer(null, 32)).toBe('modest');
    expect(classifyRenderer(null, undefined)).toBe('modest');
  });

  it('treats a genuinely tiny machine as gently as a CPU renderer', () => {
    expect(classifyRenderer(null, 2)).toBe('software');
  });
});

describe('tier consequences', () => {
  it('quarters the pixel count where the encode runs on the CPU', () => {
    const light = globeTextureSize('software');
    const full = globeTextureSize('capable');
    expect(light).toEqual({ w: 2048, h: 1024 });
    expect(full.w * full.h).toBe(light.w * light.h * 4);
  });

  it('does no speculative work on a CPU renderer, but does elsewhere', () => {
    expect(mayWorkAhead('software')).toBe(false);
    expect(mayWorkAhead('modest')).toBe(true);
    expect(mayWorkAhead('capable')).toBe(true);
  });
});
