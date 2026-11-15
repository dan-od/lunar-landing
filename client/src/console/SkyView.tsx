// Sky view (1-11): the Sun and Earth drawn against the horizon line, with the
// shadow allowance marked, at the time shown by the marker. Left to right is
// direction (north, east, south, west, north); up is height above the horizon.
import { fmtDeg, skyFraction, skyScale, type Readout } from '../siteData';
import { placeSkyLabels } from './skyLabels';

const W = 300;
const H = 170;
const LEFT = 34;
const RIGHT = 8;
const TOP = 12;
const PLOT_H = 122;
const PLOT_W = W - LEFT - RIGHT;

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Compass word for a direction in degrees clockwise from north. */
export function compass(az: number): string {
  return POINTS[Math.round((((az % 360) + 360) % 360) / 45) % 8]!;
}

interface Props {
  readout: Readout;
  marginDeg: number;
  tDays: number;
  /** Terrain horizon (360 heights). When given it is drawn in place of the allowance line. */
  horizon?: number[];
}

export function SkyView({ readout, marginDeg, tDays, horizon }: Props) {
  const scale = skyScale(readout.sunElev, readout.earthElev);
  const x = (az: number) => LEFT + (az / 360) * PLOT_W;
  const y = (elev: number) => TOP + skyFraction(elev, scale) * PLOT_H;
  const horizonY = y(0);
  const marginY = y(marginDeg);
  const bottom = TOP + PLOT_H;

  const bodies = [
    { key: 'sun', name: 'SUN', elev: readout.sunElev, az: readout.sunAz, cls: 'sky-sun' },
    { key: 'earth', name: 'EARTH', elev: readout.earthElev, az: readout.earthAz, cls: 'sky-earth' },
  ].map((b) => ({ ...b, text: `${b.name} ${fmtDeg(b.elev)}${b.elev < scale.lo ? ' ▼' : ''}` }));
  // Labels are placed together so they never overlap when the two are close.
  const labels = placeSkyLabels(
    bodies.map((b) => ({ cx: x(b.az), cy: b.elev < scale.lo ? bottom - 7 : y(b.elev), text: b.text })),
    // Keep labels off the frame edges, the horizon, and the allowance line.
    { left: LEFT, right: LEFT + PLOT_W, top: TOP, bottom, lines: horizon ? [TOP, bottom, horizonY] : [TOP, bottom, horizonY, marginY] },
  );

  const describe = (name: string, elev: number, az: number) =>
    `${name} ${Math.abs(elev).toFixed(1)} degrees ${elev >= 0 ? 'above' : 'below'} the horizon, toward the ${compass(az)}`;
  const label =
    `Sky view at ${tDays.toFixed(1)} days after landing. ` +
    `${describe('Sun', readout.sunElev, readout.sunAz)}. ${describe('Earth', readout.earthElev, readout.earthAz)}. ` +
    (horizon
      ? `The terrain stands ${readout.sunThreshold.toFixed(1)} degrees high toward the Sun and ${readout.earthThreshold.toFixed(1)} degrees toward Earth.`
      : `Shadow allowance ${marginDeg.toFixed(1)} degrees.`);
  const terrainPath = horizon
    ? horizon
        .concat(horizon[0] ?? 0)
        .map((h, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(h).toFixed(1)}`)
        .join(' ')
    : '';

  return (
    <svg className="sky" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {/* ground below the horizon */}
      <rect className="sky-ground" x={LEFT} y={horizonY} width={PLOT_W} height={bottom - horizonY} />
      <rect className="sky-frame" x={LEFT} y={TOP} width={PLOT_W} height={PLOT_H} />

      {horizon ? (
        <>
          {/* terrain horizon in every direction */}
          <path className="sky-terrain" d={terrainPath} />
          <text className="sky-t sky-margin-t" x={LEFT + PLOT_W - 3} y={TOP + 9} textAnchor="end">
            TERRAIN HORIZON
          </text>
        </>
      ) : (
        <>
          {/* shadow allowance */}
          <line className="sky-margin" x1={LEFT} x2={LEFT + PLOT_W} y1={marginY} y2={marginY} />
          <text className="sky-t sky-margin-t" x={LEFT + PLOT_W - 3} y={marginY - 3} textAnchor="end">
            ALLOWANCE {marginDeg.toFixed(1)}°
          </text>
        </>
      )}

      {/* horizon */}
      <line className="sky-horizon" x1={LEFT} x2={LEFT + PLOT_W} y1={horizonY} y2={horizonY} />
      <text className="sky-t" x={LEFT + 3} y={horizonY + 11}>
        HORIZON
      </text>

      {/* height scale */}
      <text className="sky-t" x={LEFT - 4} y={TOP + 4} textAnchor="end">
        {scale.hi}°
      </text>
      <text className="sky-t" x={LEFT - 4} y={horizonY + 3} textAnchor="end">
        0°
      </text>
      <text className="sky-t" x={LEFT - 4} y={bottom} textAnchor="end">
        {scale.lo}°
      </text>

      {/* direction scale */}
      {['N', 'E', 'S', 'W', 'N'].map((d, i) => (
        <text key={i} className="sky-t" x={x(i * 90)} y={H - 22} textAnchor="middle">
          {d}
        </text>
      ))}

      {bodies.map((b, i) => {
        const off = b.elev < scale.lo;
        const cy = off ? bottom - 7 : y(b.elev);
        const cx = x(b.az);
        const l = labels[i]!;
        return (
          <g key={b.key} data-body={b.key} data-elev={b.elev} data-az={b.az}>
            <circle className={b.cls} cx={cx} cy={cy} r={7} />
            <text className="sky-t sky-name" x={l.x} y={l.y} textAnchor={l.anchor}>
              {b.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
