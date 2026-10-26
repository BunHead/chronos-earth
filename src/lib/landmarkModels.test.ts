import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { monumentModelForName, eventToPanel } from './panel';
import { fitFor, curatedCovers } from './monumentFit';
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
    expect(Object.fromEntries(hits)).toEqual({
      "Trajan's Column": 'trajans-column',
      "Pompey's Pillar": 'pompeys-pillar',
      'Temple of Heaven': 'temple-of-heaven',
    });
  });

  it('the panel offers the 3D button for them', () => {
    const e = { id: 'q192784', name: "Trajan's Column", startYear: 113, lat: 41.8958, lon: 12.4842, category: 'monument' } as TimelineEvent;
    expect(eventToPanel(e).monument3d?.model).toBe('trajans-column');
  });
});

describe('small landmarks beside curated models (19 Oct 2026)', () => {
  const colosseum = { model: 'colosseum', title: 'Colosseum', lat: 41.8902, lon: 12.4922 };
  it("Trajan's Column ~0.9 km from the Colosseum stands as its own monument", () => {
    expect(curatedCovers(colosseum, { model: 'trajans-column', title: "Trajan's Column", lat: 41.8958, lon: 12.4843 })).toBe(false);
  });
  it('a small landmark on the curated model\'s own ground is still covered', () => {
    expect(curatedCovers(colosseum, { model: 'trajans-column', title: "Trajan's Column", lat: 41.8903, lon: 12.4923 })).toBe(true);
  });
  it('a big generic archetype near a curated site is still covered, and far away is not', () => {
    expect(curatedCovers(colosseum, { model: 'colosseum', title: 'Roman amphitheatre', lat: 41.8930, lon: 12.4960 })).toBe(true);
    expect(curatedCovers(colosseum, { model: 'colosseum', title: 'Roman amphitheatre', lat: 41.95, lon: 12.4922 })).toBe(false);
  });
  it("a real scan clears its own site's archetype on the gazetteer pin ~130 m away (Karahan Tepe)", () => {
    const scan = { model: 'karahan-scan', title: 'Karahan Tepe', lat: 37.0925, lon: 39.30361 };
    expect(curatedCovers(scan, { model: 'tpillars', title: 'Karahan Tepe', lat: 37.0916, lon: 39.3027 })).toBe(true);
  });
});

describe('Temple of Heaven colours', () => {
  it('has deep blue glazed roofs (not bright flat blue) and a gilt finial at the top', () => {
    const m = landmarkMesh('temple-of-heaven');
    let topY = -1, topCol: number[] = [];
    const blues: number[][] = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      const y = m.positions[i * 3 + 1];
      const c = [m.colors[i * 3], m.colors[i * 3 + 1], m.colors[i * 3 + 2]];
      if (y > topY) { topY = y; topCol = c; }
      if (c[2] > c[0] * 2 && c[2] > c[1] * 1.5) blues.push(c);
    }
    expect(blues.length).toBeGreaterThan(100);
    for (const c of blues) expect(c[2]).toBeLessThan(0.25); // linear; #2d5aa0 is 0.35
    expect(topCol[0]).toBeGreaterThan(topCol[2] * 2); // gold
  });
});
