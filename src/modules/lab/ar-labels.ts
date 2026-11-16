/**
 * Name tags over the telescope's parts in AR: which part sits under the
 * crosshair, and which tags fit on screen without overlapping. Pure functions
 * on screen coordinates (pixels, y down).
 */

export interface LabelPoint<Id extends string = string> {
  id: Id;
  /** Screen position of the part's centre. */
  x: number;
  y: number;
}

export interface LabelBox<Id extends string = string> extends LabelPoint<Id> {
  /** Tag size; the tag sits centred above the point. */
  w: number;
  h: number;
}

/** The part nearest the screen centre, if one is within `radius` pixels. */
export function partAtCentre<Id extends string>(points: LabelPoint<Id>[], cx: number, cy: number, radius: number): Id | undefined {
  let best: Id | undefined;
  let bestD = radius * radius;
  for (const p of points) {
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return best;
}

/**
 * Which tags to show: the most important first (`first`, e.g. the part being
 * looked at or selected), then nearest the centre; a tag that would overlap
 * one already placed is hidden.
 */
export function visibleLabels<Id extends string>(boxes: LabelBox<Id>[], cx: number, cy: number, first: Id[] = [], gap = 4): Set<Id> {
  const rank = (b: LabelBox<Id>) => {
    const i = first.indexOf(b.id);
    return i >= 0 ? -1e12 + i : (b.x - cx) ** 2 + (b.y - cy) ** 2;
  };
  const placed: { l: number; t: number; r: number; b: number }[] = [];
  const shown = new Set<Id>();
  for (const b of [...boxes].sort((a, z) => rank(a) - rank(z))) {
    const rect = { l: b.x - b.w / 2 - gap, r: b.x + b.w / 2 + gap, t: b.y - b.h - gap, b: b.y + gap };
    if (placed.some((p) => rect.l < p.r && rect.r > p.l && rect.t < p.b && rect.b > p.t)) continue;
    placed.push(rect);
    shown.add(b.id);
  }
  return shown;
}
