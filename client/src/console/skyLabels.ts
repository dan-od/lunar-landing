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
  bounds: { left: number; right: number; top: number; bottom: number; lines?: number[]; avoid?: SkyLabelBox[] },
): SkyLabel[] {
  const lines = bounds.lines ?? [];
  const avoid = bounds.avoid ?? [];
  const crossesLine = (b: SkyLabelBox) => lines.some((y) => b.top < y && y < b.bottom);
  const inside = (b: SkyLabelBox) =>
    b.top >= bounds.top && b.bottom <= bounds.bottom + 12 && b.left >= bounds.left - 30 && b.right <= bounds.right;
  // Nearest spots first: beside the dot, then a line above or below, and so on.
  const OFFSETS = [0, -12, 12, -24, 24, -36, 36, -48, 48, -60, 60];
  const placed: SkyLabel[] = [];

  for (const it of items) {
    const w = it.text.length * CHAR_W;
    const preferred: 'start' | 'end' = it.cx + GAP + w > bounds.right ? 'end' : 'start';
    const sides: Array<'start' | 'end'> = preferred === 'start' ? ['start', 'end'] : ['end', 'start'];
    let chosen: SkyLabel | undefined;
    let fallback: SkyLabel | undefined;
    for (const side of sides) {
      const x = side === 'end' ? it.cx - GAP : it.cx + GAP;
      for (const off of OFFSETS) {
        const y = it.cy + 4 + off;
        const box = boxFor(x, y, side, it.text);
        if (!inside(box)) continue;
        const clearOfLabels = !placed.some((p) => overlaps(p.box, box)) && !avoid.some((a) => overlaps(a, box));
        if (clearOfLabels && !fallback) fallback = { x, y, anchor: side, box };
        if (clearOfLabels && !crossesLine(box)) {
          chosen = { x, y, anchor: side, box };
          break;
        }
      }
      if (chosen) break;
    }
    // No spot clear of every line: at least keep it clear of the other label and inside.
    const last = chosen ?? fallback ?? (() => {
      const x = preferred === 'end' ? it.cx - GAP : it.cx + GAP;
      const y = Math.min(Math.max(it.cy + 4, bounds.top + LINE_H - 2), bounds.bottom + 10);
      return { x, y, anchor: preferred, box: boxFor(x, y, preferred, it.text) };
    })();
    placed.push(last);
  }
  return placed;
}

/** The box of a fixed label (such as "ALLOWANCE 2.0°"), so body labels can keep clear of it. */
export function textBox(x: number, y: number, anchor: 'start' | 'end', text: string): SkyLabelBox {
  return boxFor(x, y, anchor, text);
}

export { overlaps as boxesOverlap };
