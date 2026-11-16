// The terrain map: one square per prepared grid point, light where a landing
// works and dark where it is in shadow, with three rings around the aim. North
// is up. Clicking moves the aim; the arrow buttons beside the map do the same
// from the keyboard.
import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { MISS_RADII, type Aim, type GridPoint } from '@moon/core';
import { missLabelSpots, type LabelSpot } from './missLabels';

interface Props {
  grid: GridPoint[];
  stepM: number;
  halfM: number;
  aim: Aim;
  accuracy: number;
  onAim: (aim: Aim) => void;
  /** The point under a mouse pointer, or null when it leaves the map. */
  onHover?: (point: Aim | null) => void;
  /** A tap on a touch screen: shown first, the aim moves only when confirmed. */
  onTap?: (point: Aim) => void;
  /** A tapped point waiting to be confirmed. */
  pending?: Aim | null;
}

export function MissMap({ grid, stepM, halfM, aim, accuracy, onAim, onHover, onTap, pending }: Props) {
  // Map units are metres; y is flipped so north is up.
  const reach = halfM + stepM / 2;
  const size = reach * 2;
  const working = grid.filter((p) => p.works).length;

  const lastPointer = useRef<string>('mouse');
  const at = (e: MouseEvent<SVGSVGElement>): Aim => {
    const box = e.currentTarget.getBoundingClientRect();
    const east = ((e.clientX - box.left) / box.width - 0.5) * size;
    const north = (0.5 - (e.clientY - box.top) / box.height) * size;
    return { east, north };
  };
  const click = (e: MouseEvent<SVGSVGElement>) => {
    const point = at(e);
    if (lastPointer.current === 'touch' && onTap) onTap(point);
    else onAim(point);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType === 'mouse' && onHover) {
      const p = at(e);
      onHover(Math.hypot(p.east, p.north) <= reach ? p : null);
    }
  };

  // The two labels are placed together so AIM never covers ORIGINAL TARGET.
  const spots = missLabelSpots(aim, reach);
  const label = (s: LabelSpot, text: string, cls: string) => (
    <g className={cls}>
      <rect x={s.x} y={s.y - 22} width={s.w} height={30} />
      <text x={s.x + 8} y={s.y}>
        {text}
      </text>
    </g>
  );

  return (
    <svg
      className="miss-map"
      viewBox={`${-reach} ${-reach} ${size} ${size}`}
      role="img"
      aria-label={
        `Terrain map around the target, ${size} metres across, north up. ` +
        `${working} of ${grid.length} prepared points are ground where a landing works; the rest are in shadow. ` +
        'Click to move the aim, or use the arrow buttons.'
      }
      onClick={click}
      onPointerDown={(e) => (lastPointer.current = e.pointerType)}
      onPointerMove={move}
      onPointerLeave={() => onHover?.(null)}
    >
      <defs>
        <clipPath id="miss-clip">
          <circle cx={0} cy={0} r={reach} />
        </clipPath>
      </defs>
      <g clipPath="url(#miss-clip)">
        <rect className="miss-shadow" x={-reach} y={-reach} width={size} height={size} />
        {grid.map((p) =>
          p.works ? (
            <rect
              key={`${p.east},${p.north}`}
              className="miss-lit"
              x={p.east - stepM / 2}
              y={-p.north - stepM / 2}
              width={stepM}
              height={stepM}
            />
          ) : null,
        )}
      </g>
      <circle className="miss-edge" cx={0} cy={0} r={reach - 2} />

      {MISS_RADII.map((r) => (
        <g key={r}>
          <circle className={`miss-ring ${r === accuracy ? 'chosen' : ''}`} cx={aim.east} cy={-aim.north} r={r} />
          <text className="miss-ring-t" x={aim.east} y={-aim.north - r - 6} textAnchor="middle">
            {r} m
          </text>
        </g>
      ))}

      {/* original target */}
      <path className="miss-target" d="M0,-12 L12,0 L0,12 L-12,0 Z" />
      {label(spots.target, 'ORIGINAL TARGET', 'miss-label target')}

      {/* aim */}
      <line className="miss-cross" x1={aim.east - 22} x2={aim.east + 22} y1={-aim.north} y2={-aim.north} />
      <line className="miss-cross" x1={aim.east} x2={aim.east} y1={-aim.north - 22} y2={-aim.north + 22} />
      {label(spots.aim, 'AIM', 'miss-label aim')}

      {/* a tapped point waiting for "Move aim here" */}
      {pending && <circle className="miss-pending" cx={pending.east} cy={-pending.north} r={14} />}
    </svg>
  );
}
