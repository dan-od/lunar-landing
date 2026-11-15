// Where the "ORIGINAL TARGET" and "AIM" labels go on the Miss map so they never
// sit on top of each other, even when the aim is close to the target. Units are
// map metres with y pointing down (north up), as in the map's SVG.

export interface LabelSpot {
  /** Left edge and text baseline. */
  x: number;
  y: number;
  w: number;
}

const H_ABOVE = 22;
const H_BELOW = 8;
export const labelWidth = (text: string) => text.length * 15 + 16;

/** Keep a label inside the round picture's square. */
const clampX = (x: number, w: number, reach: number) => Math.min(reach - w - 8, Math.max(-reach + 8, x));

const box = (s: LabelSpot) => ({ l: s.x, r: s.x + s.w, t: s.y - H_ABOVE, b: s.y + H_BELOW });
export function spotsOverlap(a: LabelSpot, b: LabelSpot, gap = 4): boolean {
  const p = box(a);
  const q = box(b);
  return p.l < q.r + gap && q.l < p.r + gap && p.t < q.b + gap && q.t < p.b + gap;
}

/** The target label is fixed beside the target; the aim label takes the first spot clear of it. */
export function missLabelSpots(aim: { east: number; north: number }, reach: number): { target: LabelSpot; aim: LabelSpot } {
  const tw = labelWidth('ORIGINAL TARGET');
  const target = { x: clampX(18, tw, reach), y: 34, w: tw };
  const w = labelWidth('AIM');
  const ax = aim.east;
  const ay = -aim.north;
  const candidates = [
    { x: ax + 14, y: ay - 16 },
    { x: ax - 14 - w, y: ay - 16 },
    { x: ax + 14, y: ay + 40 },
    { x: ax - 14 - w, y: ay + 40 },
    { x: ax + 14, y: ay - 60 },
    { x: ax - 14 - w, y: ay - 60 },
  ].map((c) => ({ x: clampX(c.x, w, reach), y: c.y, w }));
  return { target, aim: candidates.find((c) => !spotsOverlap(c, target)) ?? candidates[0]! };
}
