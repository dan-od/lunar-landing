// Where to put the "SUN +4.4°" and "EARTH +11.0°" labels in the sky view so
// they never sit on top of each other, even when the Sun and Earth are close
// together in the sky. Coordinates are SVG user units.

/** Width of one character of the 9 px monospace label, in SVG units. */
const CHAR_W = 5.6;
/** Height of a label line, in SVG units. */
const LINE_H = 11;
/** Gap between the dot and its label. */
const GAP = 11;

export interface SkyLabelInput {
  cx: number;
  cy: number;
  text: string;
}

export interface SkyLabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SkyLabel {
  /** Text baseline position. */
  x: number;
  y: number;
  anchor: 'start' | 'end';
  box: SkyLabelBox;
}

function boxFor(x: number, y: number, anchor: 'start' | 'end', text: string): SkyLabelBox {
  const w = text.length * CHAR_W;
  const left = anchor === 'start' ? x : x - w;
  return { left, right: left + w, top: y - LINE_H + 2, bottom: y + 2 };
}

const overlaps = (a: SkyLabelBox, b: SkyLabelBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function placeSkyLabels(
  items: SkyLabelInput[],
  bounds: { left: number; right: number; top: number; bottom: number },
): SkyLabel[] {
  const first = items.map((it) => {
    const w = it.text.length * CHAR_W;
    const anchor: 'start' | 'end' = it.cx + GAP + w > bounds.right ? 'end' : 'start';
    const x = anchor === 'end' ? it.cx - GAP : it.cx + GAP;
    return { x, y: it.cy + 4, anchor, text: it.text };
  });

  // Two labels that collide: put the higher body's label above and the lower
  // one's below, a full line apart, centred on where they were.
  if (first.length === 2) {
    const [a, b] = first as [(typeof first)[0], (typeof first)[0]];
    if (overlaps(boxFor(a.x, a.y, a.anchor, a.text), boxFor(b.x, b.y, b.anchor, b.text))) {
      // Share one side so the two lines stack neatly.
      const anchor = a.anchor === 'end' || b.anchor === 'end' ? 'end' : 'start';
      const ia = items[0]!;
      const ib = items[1]!;
      const edge = anchor === 'start' ? Math.max(ia.cx, ib.cx) + GAP : Math.min(ia.cx, ib.cx) - GAP;
      const upper = ia.cy <= ib.cy ? a : b;
      const lower = upper === a ? b : a;
      const mid = (a.y + b.y) / 2;
      let top = mid - LINE_H / 2;
      // Keep both lines inside the picture.
      top = Math.max(top, bounds.top + LINE_H - 2);
      top = Math.min(top, bounds.bottom + 10 - LINE_H - 1);
      upper.y = top;
      lower.y = top + LINE_H + 1;
      a.anchor = b.anchor = anchor;
      a.x = b.x = edge;
    }
  }

  return first.map((l) => {
    let y = Math.max(l.y, bounds.top + LINE_H - 2);
    y = Math.min(y, bounds.bottom + 10);
    return { x: l.x, y, anchor: l.anchor, box: boxFor(l.x, y, l.anchor, l.text) };
  });
}
