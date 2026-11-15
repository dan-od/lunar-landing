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

export function placePinLabels(pins: PinLabelInput[], selectedId: string): PinLabel[] {
  const order = [...pins].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  // Pins themselves are obstacles too (a 12 px diamond).
  const taken: Array<PinLabel['box']> = pins.map((p) => ({ left: p.x - 8, right: p.x + 8, top: p.y - 8, bottom: p.y + 8 }));
  const placed = new Map<string, PinLabel>();
  for (const p of order) {
    const w = p.text.length * CHAR + PAD;
    const own = { left: p.x - 8, right: p.x + 8, top: p.y - 8, bottom: p.y + 8 };
    const others = taken.filter((b) => !(b.left === own.left && b.top === own.top));
    const right = { left: p.x + 14, right: p.x + 14 + w, top: p.y - 8, bottom: p.y - 8 + H };
    const left = { left: p.x - 14 - w, right: p.x - 14, top: p.y - 8, bottom: p.y - 8 + H };
    const free = (b: PinLabel['box']) => !others.some((o) => overlaps(o, b));
    let label: PinLabel;
    if (p.id === selectedId || free(right)) label = { id: p.id, side: 'right', box: right };
    else if (free(left)) label = { id: p.id, side: 'left', box: left };
    else label = { id: p.id, side: 'hidden', box: { left: p.x, right: p.x, top: p.y, bottom: p.y } };
    if (label.side !== 'hidden') taken.push(label.box);
    placed.set(p.id, label);
  }
  return pins.map((p) => placed.get(p.id)!);
}
