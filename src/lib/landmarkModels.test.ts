import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { monumentModelForName, eventToPanel } from './panel';
import { fitFor, curatedCovers } from './monumentFit';
import {
  landmarkMesh, landmarkBounds, landmarkNote, LANDMARK_MODELS, LANDMARK_HEIGHT_M, LANDMARK_STAGES, type LandmarkModel,
} from './landmarkMesh';
import { stageFor, buildStages, STAGE_TABLE } from './stageTable';
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
    expect(monumentModelForName('Forbidden City')).toBe('forbidden-city');
    expect(monumentModelForName('Hall of Supreme Harmony')).toBe('forbidden-city');
    expect(monumentModelForName('Great Wall of China (Badaling)')).toBe('great-wall');
    expect(monumentModelForName('Badaling')).toBe('great-wall');
    expect(monumentModelForName('Fort at Great Wall of Gorgan')).not.toBe('great-wall');
    expect(monumentModelForName("Hadrian's Wall")).not.toBe('great-wall');
    expect(monumentModelForName('Forbidden City Gate')).not.toBe('forbidden-city');
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
      'Forbidden City': 'forbidden-city',
      'Great Wall of China (Badaling)': 'great-wall',
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

describe('the Great Wall and the Forbidden City (26 Oct 2026)', () => {
  const stages = (m: LandmarkModel) => ['', ...(LANDMARK_STAGES[m] ?? [])];

  it('every stage is shipped, on the ground, in the base frame and no taller than the base', () => {
    for (const m of ['great-wall', 'forbidden-city'] as const) {
      const base = landmarkBounds(landmarkMesh(m));
      for (const s of stages(m)) {
        const b = landmarkBounds(landmarkMesh(m, s));
        expect(manifest[m + s]?.footprint, m + s).toBeGreaterThan(0);
        expect(Math.abs(b.minY), m + s).toBeLessThan(1e-6);
        expect(b.maxY, m + s).toBeLessThanOrEqual(base.maxY + 1e-6);
        expect(b.span / base.span, m + s).toBeGreaterThan(0.95); // same ground, not a shrunken copy
        let darkest = 3;
        const c = landmarkMesh(m, s).colors;
        for (let i = 0; i < c.length; i += 3) darkest = Math.min(darkest, c[i] + c[i + 1] + c[i + 2]);
        expect(darkest).toBeGreaterThan(0.15);
      }
    }
  });

  it('the Badaling wall: rammed earth (555), early Ming (1368), brick (1505), Qing decay, restored 1957', () => {
    expect(STAGE_TABLE['great-wall']).toBeTruthy();
    expect(stageFor('great-wall', 1505, 500).suffix).toBe('-b30'); // before 555 the model is not yet born
    expect(stageFor('great-wall', 1505, 500).bornYear).toBe(555);
    expect(stageFor('great-wall', 1505, 600).suffix).toBe('-b30');
    expect(stageFor('great-wall', 1505, 1400).suffix).toBe('-b60');
    expect(stageFor('great-wall', 1505, 1600).suffix).toBe('');
    expect(stageFor('great-wall', 1505, 1900).suffix).toBe('-ruin');
    expect(stageFor('great-wall', 1505, 2026).suffix).toBe('');
  });

  it('the Forbidden City rises over 1406-1420 and is complete in 1420', () => {
    const st = buildStages(1420, 14);
    expect(st[0]).toEqual({ from: 1406, suffix: '-b30' });
    expect(st[st.length - 1]).toEqual({ from: 1420, suffix: '' });
    for (const s of st) expect(manifest[`forbidden-city${s.suffix}`]?.footprint).toBeGreaterThan(0);
  });

  it('yellow glazed roofs and red walls on the finished Forbidden City; battlements on the wall', () => {
    const m = landmarkMesh('forbidden-city');
    let yellow = 0, red = 0;
    for (let i = 0; i < m.colors.length; i += 3) {
      const [r, g, b] = [m.colors[i], m.colors[i + 1], m.colors[i + 2]];
      if (r > 0.5 && g > 0.25 && b < 0.08) yellow++;
      if (r > 0.25 && g < 0.06 && b < 0.05) red++;
    }
    expect(yellow).toBeGreaterThan(200);
    expect(red).toBeGreaterThan(200);
    // The Meridian Gate is the tallest thing (37.95 m), the hall 35.05 m.
    expect(landmarkBounds(m).maxY).toBeCloseTo(37.95, 2);
    // The finished wall carries far more parts (merlons, towers) than the rammed-earth one.
    expect(landmarkMesh('great-wall').indices.length).toBeGreaterThan(2 * landmarkMesh('great-wall', '-b30').indices.length);
  });

  it('the pins are where they were asked for', () => {
    const ev = JSON.parse(readFileSync(join(process.cwd(), 'public/data/imported/events.json'), 'utf8')).events as TimelineEvent[];
    const fc = ev.find((e) => e.id === 'cur-forbidden-city')!;
    expect([fc.lat, fc.lon, fc.startYear]).toEqual([39.916, 116.397, 1420]);
    const gw = ev.find((e) => e.id === 'cur-great-wall-badaling')!;
    expect([gw.lat, gw.lon, gw.startYear]).toEqual([40.36, 116.02, 1505]);
  });
});

describe('the Great Wall on a surveyed profile (scripts/fetch-great-wall-profile.mjs)', () => {
  // A made-up two-peak ridge, only to exercise the code path — not shipped data.
  const kx = 111_320 * Math.cos((40.36 * Math.PI) / 180);
  const path: Array<[number, number, number]> = [];
  for (let i = 0; i <= 60; i++) {
    const x = -300 + i * 10;
    path.push([40.36 + (0.4 * x) / 111_320, 116.02 + x / kx, 600 + 70 * Math.exp(-(((x - 120) / 90) ** 2)) + 40 * Math.exp(-(((x + 180) / 70) ** 2))]);
  }
  const profile = { source: 'test', pin: { lat: 40.36, lon: 116.02, elevM: 615 }, path };

  it('stands on y = 0, follows the survey, and draws no ridge of its own', () => {
    for (const s of ['', '-b30', '-b60', '-ruin']) {
      const m = landmarkMesh('great-wall', s, profile);
      const { minY, maxY } = landmarkBounds(m);
      expect(Math.abs(minY), s).toBeLessThan(1e-6);
      // 70 m of rise plus the footing, the walk and a tower: well under the representative 68.8 + 55
      expect(maxY, s).toBeGreaterThan(70);
      expect(maxY, s).toBeLessThan(70 + 1.5 + 14 + 1);
      let green = 0;
      for (let i = 0; i < m.colors.length; i += 3) if (m.colors[i + 1] > m.colors[i] * 1.3 && m.colors[i + 1] > m.colors[i + 2] * 2) green++;
      if (s !== '-ruin') expect(green, s).toBe(0); // the ruin's scrub on the walk is the only green
    }
  });

  it('towers stand on the highest crests, at least 150 m apart', () => {
    const tall = landmarkMesh('great-wall', '', profile);
    // tower tops (13.8 m above the walk's ground) near each peak
    const peaks = [120, -180].map((x) => [x * 0.9284, 600 + (x === 120 ? 70 : 40)]); // plan x shrinks by the line's slope
    for (const [, elev] of peaks) {
      const top = elev - (600 - 1.5) + 13.8;
      let found = false;
      for (let i = 1; i < tall.positions.length; i += 3) if (Math.abs(tall.positions[i] - top) < 1.5) found = true;
      expect(found).toBe(true);
    }
  });
});
