/**
 * borderStatus.ts — pure pixel-grid helpers for the status-coloured border map.
 *
 * The globe's border layer rasterises each historical snapshot to a canvas. To
 * find WHERE the map is about to change, we compare "who owns this pixel"
 * grids between one snapshot and the next: any pixel whose owner differs is
 * land changing hands, and the border stretch beside it should glow orange.
 *
 * Canvas antialiasing blends colours along every polity edge, and those blends
 * read back as junk owner ids — so the raw comparison is speckled with false
 * 1-pixel seams wherever two countries merely touch. A morphological "open"
 * (erode away thin noise, then dilate what survives) keeps only genuine
 * regions of change.
 */

/**
 * Compare two owner grids pixel by pixel. Owners are compared by NAME (not
 * index) so the same polity keeps matching across snapshots even when the
 * feature order differs. Index -1 (or any out-of-range id from an antialiased
 * blend) means "nobody" — a change from nobody to an owner still counts, so
 * newly mapped territory glows too.
 */
export function diffOwners(
  idxA: Int32Array,
  namesA: string[],
  idxB: Int32Array,
  namesB: string[],
): Uint8Array {
  const out = new Uint8Array(idxA.length);
  for (let i = 0; i < idxA.length; i++) {
    const a = idxA[i] >= 0 ? namesA[idxA[i]] : undefined;
    const b = idxB[i] >= 0 ? namesB[idxB[i]] : undefined;
    if (a !== b) out[i] = 1;
  }
  return out;
}

/**
 * Morphological open: a set pixel survives only if at least `minNeighbours` of
 * its 8 neighbours are also set (kills the 1–2px antialiasing seams), then the
 * survivors are dilated by `dilateRadius` so the cleaned region comfortably
 * reaches the border line it sits against.
 */
export function morphOpen(
  mask: Uint8Array,
  w: number,
  h: number,
  minNeighbours = 5,
  dilateRadius = 2,
): Uint8Array {
  const eroded = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (mask[ny * w + nx]) n++;
        }
      }
      if (n >= minNeighbours) eroded[i] = 1;
    }
  }
  if (dilateRadius <= 0) return eroded;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!eroded[y * w + x]) continue;
      for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
        for (let dx = -dilateRadius; dx <= dilateRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}
