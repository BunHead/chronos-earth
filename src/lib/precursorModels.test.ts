import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AncientSite } from './types';
import { resolveMonumentModel, siteToPanel } from './panel';
import { precursorMesh, meshBounds, PRECURSOR_MODELS, type PrecursorModel } from './precursorMesh';
import { fitFor } from './monumentFit';

// The Captain's dark crater "donut": every precursor-hypothesis site used to
// fall through to the 'impact' crater model — on Yonaguni's natural rock, on a
// 1513 map in Istanbul, on a Bosnian hill. Read the real shipped data.
const sites = JSON.parse(readFileSync(join(process.cwd(), 'public/data/ancient-sites.json'), 'utf8'))
  .sites as AncientSite[];
const byId = Object.fromEntries(sites.map((s) => [s.id, s]));

describe('precursor-hypothesis sites — no wrong 3D model', () => {
  it('keeps the two honest models', () => {
    expect(resolveMonumentModel(byId['richat-structure'])).toBe('rings');
    expect(resolveMonumentModel(byId['younger-dryas-impact'])).toBe('impact');
  });

  it('the maps get no model and no 3D button', () => {
    for (const id of ['piri-reis-map', 'sumerian-map-hypothesis']) {
      expect(byId[id], `missing ${id}`).toBeTruthy();
      expect(resolveMonumentModel(byId[id]), id).toBeNull();
      expect(siteToPanel(byId[id]).monument3d, id).toBeUndefined();
    }
  });

  it('only Bosnia, Bimini and Yonaguni gain a model: the below-surface ones', () => {
    const modelled = sites
      .filter((s) => s.category === 'precursor-hypothesis' && resolveMonumentModel(s))
      .map((s) => [s.id, resolveMonumentModel(s)]);
    expect(Object.fromEntries(modelled)).toEqual({
      'richat-structure': 'rings',
      'younger-dryas-impact': 'impact',
      'bosnian-pyramid-claims': 'ravne-tunnels',
      'bimini-road': 'bimini-beachrock',
      'yonaguni-monument': 'yonaguni-rock',
    });
    for (const id of ['bosnian-pyramid-claims', 'bimini-road', 'yonaguni-monument'])
      expect(siteToPanel(byId[id]).monument3d?.model, id).toBe(resolveMonumentModel(byId[id]));
    // No site outside the precursor claims wears one of these.
    for (const s of sites.filter((x) => x.category !== 'precursor-hypothesis'))
      expect(PRECURSOR_MODELS as readonly string[], s.id).not.toContain(resolveMonumentModel(s));
  });

  it('no precursor site falls back to the impact crater by default', () => {
    for (const s of sites.filter((x) => x.category === 'precursor-hypothesis')) {
      if (s.id === 'younger-dryas-impact') continue;
      expect(resolveMonumentModel(s), s.id).not.toBe('impact');
    }
  });

  it('the map sites show the real map picture, with its licence', () => {
    for (const id of ['piri-reis-map', 'sumerian-map-hypothesis']) {
      const img = siteToPanel(byId[id]).realImage;
      expect(img, id).toBeTruthy();
      expect(img!.wikiTitle.length).toBeGreaterThan(0);
      expect(img!.licence).toMatch(/public domain|licence/i);
    }
  });

  it('the Bosnian panel says plainly it is a natural hill, and the tunnels are disputed', () => {
    const p = siteToPanel(byId['bosnian-pyramid-claims']);
    expect(p.summary).toMatch(/natural hill/i);
    expect(p.alternative?.note).toMatch(/hills are natural/i);
    const facts = p.sections.flatMap((x) => x.bullets ?? []).join(' ');
    expect(facts).toMatch(/Ravne tunnels.*disputed/i);
  });

  it('Bimini and Yonaguni still say the mainstream view: natural rock', () => {
    expect(siteToPanel(byId['bimini-road']).summary).toMatch(/beachrock, a natural rock/i);
    expect(siteToPanel(byId['yonaguni-monument']).alternative?.note).toMatch(/splits naturally/i);
  });
});

/** POSITION bounds of a shipped .glb, read from its JSON chunk. */
function glbBounds(model: string): { min: number[]; max: number[] } {
  const b = readFileSync(join(process.cwd(), 'public/models', `${model}.glb`));
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
}

// [highest point must be below, highest above, lowest above, lowest below] (m;
// y = 0 is the ground or the sea surface).
const DEPTHS: Record<PrecursorModel, { topBelow: number; topAbove: number; baseAbove: number; baseBelow: number }> = {
  // The claimed tunnels: under the ground, not poking out of the hill.
  'ravne-tunnels': { topBelow: -5, topAbove: -10, baseAbove: -25, baseBelow: -8 },
  // Beachrock slabs on the seabed, 5–6 m down.
  'bimini-beachrock': { topBelow: -4.5, topAbove: -5.5, baseAbove: -7, baseBelow: -5.5 },
  // Natural stepped rock: top ~5 m under the surface, base ~25 m.
  'yonaguni-rock': { topBelow: -4.5, topAbove: -6, baseAbove: -27, baseBelow: -24 },
};

describe('below-surface precursor models', () => {
  for (const model of PRECURSOR_MODELS) {
    const d = DEPTHS[model];
    it(`${model}: every point is below the surface, at the right depth`, () => {
      const { minY, maxY } = meshBounds(precursorMesh(model));
      expect(maxY).toBeLessThan(d.topBelow);
      expect(maxY).toBeGreaterThan(d.topAbove);
      expect(minY).toBeGreaterThan(d.baseAbove);
      expect(minY).toBeLessThan(d.baseBelow);
    });

    it(`${model}: the shipped .glb matches (below the surface, small)`, () => {
      const { min, max } = glbBounds(model);
      // (Draco pads the bounds by a quantisation step — well under 0.1 m here.)
      expect(max[1]).toBeLessThan(d.topBelow + 0.1);
      expect(min[1]).toBeLessThan(d.baseBelow);
      const kb = readFileSync(join(process.cwd(), 'public/models', `${model}.glb`)).length / 1024;
      expect(kb).toBeLessThan(300);
    });

    it(`${model}: true metres — fit width is the manifest footprint (scale ×1)`, () => {
      const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/models/manifest.json'), 'utf8'));
      expect(fitFor('', model).widthM).toBeCloseTo(manifest[model].footprint, 2);
      expect(manifest[model].footprint).toBeCloseTo(meshBounds(precursorMesh(model)).span, 2);
    });
  }

  it('Bimini is about 0.8 km of slabs; Yonaguni rises about 20 m', () => {
    const y = meshBounds(precursorMesh('yonaguni-rock'));
    expect(y.maxY - y.minY).toBeGreaterThan(18);
    // The J's straight run plus its hook, measured along the bounding box diagonal.
    expect(meshBounds(precursorMesh('bimini-beachrock')).span).toBeGreaterThan(450);
  });

  it('earthy colours, never black', () => {
    for (const model of PRECURSOR_MODELS) {
      const c = precursorMesh(model).colors;
      let darkest = 1;
      for (let i = 0; i < c.length; i += 3) darkest = Math.min(darkest, c[i] + c[i + 1] + c[i + 2]);
      expect(darkest, model).toBeGreaterThan(0.15);
    }
  });
});
