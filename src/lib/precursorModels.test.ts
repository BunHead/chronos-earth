import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AncientSite } from './types';
import { resolveMonumentModel, siteToPanel } from './panel';

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

  it('gives the others no model and no 3D button', () => {
    for (const id of ['yonaguni-monument', 'bimini-road', 'piri-reis-map', 'sumerian-map-hypothesis', 'bosnian-pyramid-claims']) {
      expect(byId[id], `missing ${id}`).toBeTruthy();
      expect(resolveMonumentModel(byId[id]), id).toBeNull();
      expect(siteToPanel(byId[id]).monument3d, id).toBeUndefined();
    }
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

  it('the Bosnian panel says plainly it is a natural hill', () => {
    expect(siteToPanel(byId['bosnian-pyramid-claims']).summary).toMatch(/natural hill/i);
  });
});
