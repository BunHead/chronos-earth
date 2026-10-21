/**
 * eraLabels.ts — where the era names sit on the log overview rail.
 *
 * EACH LABEL GETS A BOX centred on its own era and half as wide as the
 * distance to the nearer neighbouring label's midpoint, so no two boxes can
 * intersect while each still claims the rail going spare (the old rule, kept).
 *
 * THE CAMBRIAN BROKE IT (found 11 Oct 2026). Extending the timeline to
 * 538.8 Mya squeezed every deep-time period into the left edge of the log
 * scale; the Cretaceous fell under the "too thin to label" cut, and the
 * Paleogene's box — free to reach toward its nearest LABELLED neighbour —
 * spread left across the empty Cretaceous, so 100 Mya sat under "PALEOGENE"
 * (the Captain's screenshot). Now periods too thin to name on their own are
 * named by their ERA instead — Palaeozoic, Mesozoic — so the label over any
 * moment is always one that moment actually belongs to.
 */
import { ERAS, yearsBPToPos } from './timeScale';

/** Narrower than this (fraction of the rail) and a period is not named alone. */
const MIN_LABEL_SPAN = 0.04;
/** An era grouping several periods may be a little tighter (it ellipsises). */
const MIN_GROUP_SPAN = 0.025;

/** Geological eras that gather their periods when the periods are too thin. */
const GROUPS: Array<{ name: string; members: string[] }> = [
  { name: 'Palaeozoic', members: ['Cambrian', 'Ordovician', 'Silurian', 'Devonian', 'Carboniferous', 'Permian'] },
  { name: 'Mesozoic', members: ['Triassic', 'Jurassic', 'Cretaceous'] },
];

interface Unit {
  name: string;
  /** Older edge and younger edge, as rail positions (0 = oldest, 1 = now). */
  left: number;
  right: number;
  min: number;
}

export function eraLabelUnits(): Unit[] {
  const spans = ERAS.map((e) => ({ name: e.name, left: yearsBPToPos(e.startBP), right: yearsBPToPos(e.endBP) }));
  const units: Unit[] = [];
  for (let i = 0; i < spans.length; i++) {
    const g = GROUPS.find((gr) => gr.members[0] === spans[i].name);
    if (g) {
      const members = spans.slice(i, i + g.members.length);
      if (members.some((m) => m.right - m.left < MIN_LABEL_SPAN)) {
        units.push({ name: g.name, left: members[0].left, right: members[members.length - 1].right, min: MIN_GROUP_SPAN });
        i += g.members.length - 1;
        continue;
      }
    }
    units.push({ ...spans[i], min: MIN_LABEL_SPAN });
  }
  return units;
}

export function eraLabelBoxes(): Array<{ name: string; left: number; width: number }> {
  const shown = eraLabelUnits()
    .map((u) => ({ name: u.name, centre: (u.left + u.right) / 2, span: u.right - u.left, min: u.min }))
    .filter((d) => d.span >= d.min); // too thin to label at all

  return shown.map((d, i) => {
    const prevBound = i === 0 ? 0 : (shown[i - 1].centre + d.centre) / 2;
    const nextBound = i === shown.length - 1 ? 1 : (d.centre + shown[i + 1].centre) / 2;
    const halfWidth = Math.min(d.centre - prevBound, nextBound - d.centre);
    return { name: d.name, left: d.centre - halfWidth, width: halfWidth * 2 };
  });
}
