import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { monumentModelForName, eventToPanel } from './panel';
import { fitFor } from './monumentFit';
import {
  landmarkMesh, landmarkBounds, landmarkNote, LANDMARK_MODELS, LANDMARK_HEIGHT_M, type LandmarkModel,
} from './landmarkMesh';
import type { TimelineEvent } from './types';

// 3D monuments batch 2: the Temple of Heaven, Trajan's Column, Pompey's Pillar.

/** POSITION bounds of a shipped .glb, read from its JSON chunk. */
function glbBounds(model: string): { min: number[]; max: number[] } {
  const b = readFileSync(join(process.cwd(), 'public/models', `${model}.glb`));
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
}

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/models/manifest.json'), 'utf8'));

describe('batch-2 landmark models', () => {
  for (const model of LANDMARK_MODELS) {
    const h = LANDMARK_HEIGHT_M[model];

    it(`${model}: the .glb exists and is small`, () => {
      const kb = readFileSync(join(process.cwd(), 'public/models', `${model}.glb`)).length / 1024;
      expect(kb).toBeLessThan(300);
      expect(manifest[model]?.footprint).toBeGreaterThan(0);
    });

    it(`${model}: sits on the ground, and is its documented height (±10%)`, () => {
      const { minY, maxY } = landmarkBounds(landmarkMesh(model));
      expect(Math.abs(minY)).toBeLessThan(1e-6);
      expect(Math.abs(maxY - h) / h).toBeLessThan(0.1);
      // The shipped file matches (Draco pads bounds by a quantisation step).
      const { min, max } = glbBounds(model);
      expect(Math.abs(min[1])).toBeLessThan(0.1);
      expect(Math.abs(max[1] - h) / h).toBeLessThan(0.1);
    });

    it(`${model}: true metres — fit width is the manifest footprint (scale ×1)`, () => {
      expect(fitFor('', model).widthM).toBeCloseTo(manifest[model].footprint, 2);
      expect(manifest[model].footprint).toBeCloseTo(landmarkBounds(landmarkMesh(model)).span, 2);
    });

    it(`${model}: real colours, never black`, () => {
      const c = landmarkMesh(model).colors;
      let darkest = 3;
      for (let i = 0; i < c.length; i += 3) darkest = Math.min(darkest, c[i] + c[i + 1] + c[i + 2]);
      expect(darkest).toBeGreaterThan(0.15);
    });

    it(`${model}: the info panel calls it a representation`, () => {
      expect(landmarkNote({ model })).toMatch(/a representation based on best known evidence/);
    });
  }

  it('the documented heights and footprints', () => {
    const tall = (m: LandmarkModel) => landmarkBounds(landmarkMesh(m)).maxY;
    expect(tall('temple-of-heaven')).toBeCloseTo(38, 1);
    expect(tall('trajans-column')).toBeCloseTo(35.07, 1);
    expect(tall('pompeys-pillar')).toBeCloseTo(26.85, 1);
    expect(landmarkBounds(landmarkMesh('temple-of-heaven')).span).toBeCloseTo(91, 0); // the altar's lowest tier
    expect(landmarkNote({ model: 'pyramid' })).toBeNull();
  });
});

describe('only these sites gain the 3D button', () => {
  it('maps the three names', () => {
    expect(monumentModelForName('Temple of Heaven')).toBe('temple-of-heaven');
    expect(monumentModelForName('Hall of Prayer for Good Harvests')).toBe('temple-of-heaven');
    expect(monumentModelForName("Trajan's Column")).toBe('trajans-column');
    expect(monumentModelForName("Pompey's pillar")).toBe('pompeys-pillar');
    // Neighbours and look-alikes stay as they were.
    expect(monumentModelForName('Forbidden City')).toBeNull();
    expect(monumentModelForName('Column of Marcus Aurelius')).toBeNull();
    expect(monumentModelForName('Column of Julian')).toBeNull();
    expect(monumentModelForName('Temple of Ellesyia')).toBeNull();
  });

  it('every shipped monument pin wearing one is one of the expected sites', () => {
    const dir = join(process.cwd(), 'public/data/core-index');
    const hits = new Map<string, string>();
    for (const f of readdirSync(dir).filter((x) => x.includes('__b'))) {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (!j.name) continue;
      j.name.forEach((n: string, i: number) => {
        const m = monumentModelForName(n);
        if (j.category[i] === 'monument' && m && (LANDMARK_MODELS as readonly string[]).includes(m)) hits.set(n, m);
      });
    }
    expect(Object.fromEntries(hits)).toEqual({ "Trajan's Column": 'trajans-column', "Pompey's pillar": 'pompeys-pillar' });
  });

  it('the panel offers the 3D button for them', () => {
    const e = { id: 'q192784', name: "Trajan's Column", startYear: 113, lat: 41.8958, lon: 12.4842, category: 'monument' } as TimelineEvent;
    expect(eventToPanel(e).monument3d?.model).toBe('trajans-column');
  });
});
