import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readableLabel, LABEL_BG } from './labelStyle';

// The Captain, 19 Oct 2026: dark-looking text on a pale map.
describe('map labels read on pale and dark ground', () => {
  it('a light fill, a dark outline and a dark pill', () => {
    const s = readableLabel();
    expect(s.showBackground).toBe(true);
    expect(s.backgroundColor.alpha).toBeGreaterThan(0.5);
    expect(s.backgroundColor.red + s.backgroundColor.green + s.backgroundColor.blue).toBeLessThan(0.3);
    expect(s.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(LABEL_BG.a).toBeLessThan(0.8); // translucent, the map shows through
  });
  it('every label on the globe uses it', () => {
    for (const f of ['src/components/Globe.tsx', 'src/components/fauna.ts', 'src/components/migration.ts', 'src/components/borders.ts', 'src/lib/globeBattles.ts']) {
      const src = readFileSync(f, 'utf8');
      const labels = (src.match(/label: \{|labels\.add\(\{/g) ?? []).length;
      expect((src.match(/\.\.\.readableLabel\(\)/g) ?? []).length, f).toBe(labels);
      // and no label is drawn with a dark fill
      expect(src).not.toMatch(/fillColor: Cesium\.Color\.BLACK/);
    }
  });
});
