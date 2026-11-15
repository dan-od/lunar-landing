// Where each pin's name goes on the pole map, in pixels from the disc's corner.
// The selected site is placed first, then the rest in list order. A label goes
// to the right of its pin, or to the left if that is crowded, or is left off
// (the pin keeps its spoken name, and the site list is the full equivalent).

/** Width of one 11 px Fira Code character, plus padding, in pixels. */
const CHAR = 6.7;
const PAD = 6;
const H = 16;

export interface PinLabelInput {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface PinLabel {
  id: string;
  side: 'right' | 'left' | 'hidden';
  box: { left: number; right: number; top: number; bottom: number };
}

const overlaps = (a: PinLabel['box'], b: PinLabel['box']) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

/** True when the circle's line passes through the box. */
function crossesCircle(b: PinLabel['box'], c: Circle): boolean {
  const nx = Math.max(b.left, Math.min(c.cx, b.right));
  const ny = Math.max(b.top, Math.min(c.cy, b.bottom));
  const near = Math.hypot(nx - c.cx, ny - c.cy);
  const far = Math.max(
    Math.hypot(b.left - c.cx, b.top - c.cy),
    Math.hypot(b.right - c.cx, b.top - c.cy),
    Math.hypot(b.left - c.cx, b.bottom - c.cy),
    Math.hypot(b.right - c.cx, b.bottom - c.cy),
  );
  return near < c.r && c.r < far;
}

export function placePinLabels(pins: PinLabelInput[], selectedId: string, circles: Circle[] = []): PinLabel[] {
  const order = [...pins].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  // Pins themselves are obstacles too (a 12 px diamond).
  const pinBox = (p: PinLabelInput) => ({ left: p.x - 8, right: p.x + 8, top: p.y - 8, bottom: p.y + 8 });
  const placedBoxes: Array<PinLabel['box']> = [];
  const placed = new Map<string, PinLabel>();
  for (const p of order) {
    const w = p.text.length * CHAR + PAD;
    const others = [...pins.filter((o) => o.id !== p.id).map(pinBox), ...placedBoxes];
    const at = (side: 'right' | 'left', dy: number) => {
      const top = p.y - 8 + dy;
      return side === 'right'
        ? { side, box: { left: p.x + 14, right: p.x + 14 + w, top, bottom: top + H } }
        : { side, box: { left: p.x - 14 - w, right: p.x - 14, top, bottom: top + H } };
    };
    // Beside the pin first, then nudged up or down a little, on either side.
    const candidates = [0, -12, 12, -20, 20].flatMap((dy) => [at('right', dy), at('left', dy)]);
    const clearOfLabels = (b: PinLabel['box']) => !others.some((o) => overlaps(o, b));
    const clearOfRings = (b: PinLabel['box']) => !circles.some((c) => crossesCircle(b, c));
    let pick = candidates.find((c) => clearOfLabels(c.box) && clearOfRings(c.box));
    // Crowded rings: accept a ring crossing (the label has a dark backing) before hiding it.
    if (!pick) pick = candidates.find((c) => clearOfLabels(c.box));
    if (!pick && p.id === selectedId) pick = candidates[0];
    const label: PinLabel = pick
      ? { id: p.id, side: pick.side as 'right' | 'left', box: pick.box }
      : { id: p.id, side: 'hidden', box: { left: p.x, right: p.x, top: p.y, bottom: p.y } };
    if (label.side !== 'hidden') placedBoxes.push(label.box);
    placed.set(p.id, label);
  }
  return pins.map((p) => placed.get(p.id)!);
}
