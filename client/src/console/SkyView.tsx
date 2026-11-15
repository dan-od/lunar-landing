// Sky view (1-11): the Sun and Earth drawn against the horizon line, with the
// shadow allowance marked, at the time shown by the marker. Left to right is
// direction (north, east, south, west, north); up is height above the horizon.
import { fmtDeg, skyFraction, skyScale, type Readout } from '../siteData';

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
}

export function SkyView({ readout, marginDeg, tDays }: Props) {
  const scale = skyScale(readout.sunElev, readout.earthElev);
  const x = (az: number) => LEFT + (az / 360) * PLOT_W;
  const y = (elev: number) => TOP + skyFraction(elev, scale) * PLOT_H;
  const horizonY = y(0);
  const marginY = y(marginDeg);
  const bottom = TOP + PLOT_H;

  const bodies = [
    { key: 'sun', name: 'SUN', elev: readout.sunElev, az: readout.sunAz, cls: 'sky-sun' },
    { key: 'earth', name: 'EARTH', elev: readout.earthElev, az: readout.earthAz, cls: 'sky-earth' },
  ];

  const describe = (name: string, elev: number, az: number) =>
    `${name} ${Math.abs(elev).toFixed(1)} degrees ${elev >= 0 ? 'above' : 'below'} the horizon, toward the ${compass(az)}`;
  const label =
    `Sky view at ${tDays.toFixed(1)} days after landing. ` +
    `${describe('Sun', readout.sunElev, readout.sunAz)}. ${describe('Earth', readout.earthElev, readout.earthAz)}. ` +
    `Shadow allowance ${marginDeg.toFixed(1)} degrees.`;

  return (
    <svg className="sky" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {/* ground below the horizon */}
      <rect className="sky-ground" x={LEFT} y={horizonY} width={PLOT_W} height={bottom - horizonY} />
      <rect className="sky-frame" x={LEFT} y={TOP} width={PLOT_W} height={PLOT_H} />

      {/* shadow allowance */}
      <line className="sky-margin" x1={LEFT} x2={LEFT + PLOT_W} y1={marginY} y2={marginY} />
      <text className="sky-t sky-margin-t" x={LEFT + PLOT_W - 3} y={marginY - 3} textAnchor="end">
        ALLOWANCE {marginDeg.toFixed(1)}°
      </text>

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

      {bodies.map((b) => {
        const off = b.elev < scale.lo;
        const cy = y(b.elev);
        const cx = x(b.az);
        const anchor = cx > LEFT + PLOT_W - 60 ? 'end' : 'start';
        const tx = anchor === 'end' ? cx - 11 : cx + 11;
        return (
          <g key={b.key} data-body={b.key} data-elev={b.elev} data-az={b.az}>
            <circle className={b.cls} cx={cx} cy={off ? bottom - 7 : cy} r={7} />
            <text className="sky-t sky-name" x={tx} y={(off ? bottom - 7 : cy) + 4} textAnchor={anchor}>
              {b.name} {fmtDeg(b.elev)}
              {off ? ' ▼' : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
