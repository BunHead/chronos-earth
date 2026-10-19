/**
 * labelStyle.ts — one look for every map label (the Captain, 19 Oct 2026:
 * "Diplodocus, Brachiosaurus, Allosaurus at 151 Mya are dark text on a pale
 * map and hard to read").
 *
 * A thin outline round 12 px text eats most of the light fill, so on a pale
 * desert or ice map the words read dark. Every label now gets a light, bold
 * fill, a firm dark outline AND a dark translucent pill behind it, which
 * reads on pale ground and on ocean alike.
 */
import * as Cesium from 'cesium';

/** The pill: a dark translucent backing card behind the text. */
export const LABEL_BG = { r: 12, g: 10, b: 8, a: 0.62 } as const;

/** Spread into any Cesium label (entity `label: {…}` or LabelCollection.add). */
export function readableLabel(): {
  outlineColor: Cesium.Color;
  outlineWidth: number;
  style: Cesium.LabelStyle;
  showBackground: boolean;
  backgroundColor: Cesium.Color;
  backgroundPadding: Cesium.Cartesian2;
} {
  return {
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    showBackground: true,
    backgroundColor: Cesium.Color.fromBytes(LABEL_BG.r, LABEL_BG.g, LABEL_BG.b, Math.round(LABEL_BG.a * 255)),
    backgroundPadding: new Cesium.Cartesian2(5, 3),
  };
}

