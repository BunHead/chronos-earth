import { describe, expect, it } from 'vitest';
import * as Cesium from 'cesium';
import { horizonCheck } from './horizon';

const viewerAt = (lon: number, lat: number, h: number) =>
  ({ camera: { positionWC: Cesium.Cartesian3.fromDegrees(lon, lat, h) } }) as unknown as Cesium.Viewer;

describe('horizon — pins on the far side of the Earth hide', () => {
  it('standing at Stonehenge, Siberia is below the horizon', () => {
    const visible = horizonCheck(viewerAt(-1.83, 51.18, 330));
    expect(visible(Cesium.Cartesian3.fromDegrees(140, 68))).toBe(false);
    expect(visible(Cesium.Cartesian3.fromDegrees(-1.8, 51.2))).toBe(true);
  });

  it('from space above Asia, Siberia shows and Chile does not', () => {
    const visible = horizonCheck(viewerAt(100, 40, 20_000_000));
    expect(visible(Cesium.Cartesian3.fromDegrees(140, 68))).toBe(true);
    expect(visible(Cesium.Cartesian3.fromDegrees(-73.2, -41.5))).toBe(false);
  });
});
