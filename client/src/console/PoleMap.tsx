// South pole map: looking down on the pole, 0° longitude at the top, east to the
// right. Pins show each site's state at the time marker. The Sun and Earth sit
// at the longitude where each is overhead, derived from NASA positions.
import type { SiteRow } from './types';
import { NO_DATA } from './types';

const SIZE = 360;
const C = SIZE / 2;
const RIM = 150; // radius of the 65° S circle
const RAD = Math.PI / 180;
/** Sites further from the pole than this are off the map. */
const EDGE_LAT = -65;

function polar(lonDeg: number, r: number): { x: number; y: number } {
  return { x: C + r * Math.sin(lonDeg * RAD), y: C - r * Math.cos(lonDeg * RAD) };
}

interface Props {
  rows: SiteRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Longitudes (east) where the Sun and Earth are overhead; absent without data. */
  overhead?: { sun: number; earth: number };
}

export function PoleMap({ rows, selectedId, onSelect, overhead }: Props) {
  // The aim point sits within a few hundred metres of its target, so it shares
  // that pin; it is listed and charted as its own row.
  const onMap = rows.filter((r) => r.site.lat <= EDGE_LAT && !r.site.aim);
  const offMap = rows.filter((r) => r.site.lat > EDGE_LAT && !r.site.aim);
  const sun = overhead ? polar(overhead.sun, RIM + 14) : null;
  const earth = overhead ? polar(overhead.earth, RIM + 14) : null;

  return (
    <section className="mapwrap" aria-labelledby="map-title">
      <h2 className="cap" id="map-title">
        02 / SOUTH POLE · POLAR VIEW
      </h2>
      <div
        className="disc"
        role="group"
        aria-label="South pole map, from 65 degrees south to the pole. Zero longitude is at the top."
      >
        <div className="rim" />
        <div className="ring" style={{ inset: 80 }} />
        <div className="ring" style={{ inset: 120 }} />
        <div className="ring" style={{ inset: 150 }} />
        {earth && (
          <>
            <div className="body-dot earth" style={{ left: earth.x - 7, top: earth.y - 7 }} aria-hidden="true" />
            <div className="pl" style={{ left: earth.x - 18, top: earth.y + 9, color: 'var(--edge)' }}>
              EARTH
            </div>
          </>
        )}
        {sun && (
          <>
            <div className="body-dot sun" style={{ left: sun.x - 7, top: sun.y - 7 }} aria-hidden="true" />
            <div className="pl" style={{ left: sun.x - 12, top: sun.y + 9, color: 'var(--yel)' }}>
              SUN
            </div>
          </>
        )}
        {onMap.map((r) => {
          const rr = ((90 + r.site.lat) / (90 + EDGE_LAT)) * RIM;
          const { x, y } = polar(r.site.lon, rr);
          const state = r.now?.state;
          const word = state?.word ?? NO_DATA.word;
          const ready = state?.word === 'READY';
          const selected = r.site.id === selectedId;
          return (
            <span key={r.site.id}>
              <button
                type="button"
                className={`pin ${ready ? 'ok' : ''} ${state ? '' : 'nodata'}`}
                style={{ left: x - 22, top: y - 22 }}
                aria-pressed={selected}
                aria-label={`${r.site.name}, ${word.toLowerCase()}`}
                onClick={() => onSelect(r.site.id)}
              >
                <span />
              </button>
              <div className={`pl ${selected ? 'sel' : ''}`} style={{ left: x + 14, top: y - 8 }}>
                {r.short}
              </div>
            </span>
          );
        })}
      </div>
      {offMap.length > 0 && (
        <p className="mapnote mono">
          NOT ON THIS MAP (NORTH OF 65° S): {offMap.map((r) => r.short).join(', ')}. USE THE SITE LIST.
        </p>
      )}
    </section>
  );
}
