// South pole map: looking down on the pole, 0° longitude at the top, east to the
// right. Pins show each site's state at the time marker. The Sun and Earth sit
// at the longitude where each is overhead, derived from NASA positions.
import { useEffect, useRef, useState } from 'react';
import type { SiteRow } from './types';
import { NO_DATA } from './types';

// Positions are percentages of the disc, so the disc can be drawn at any size.
// On a wide screen it is large enough that the pins near the pole do not overlap.
const C = 50;
const RIM = 41.7; // radius of the 65° S circle, percent of the disc
const BODY = 45.6; // where the Sun and Earth sit, just outside the rim
const RAD = Math.PI / 180;
const pct = (v: number) => `${v.toFixed(3)}%`;
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
  // The disc is the largest square that fits the pane, centred and padded. It is
  // measured rather than left to container-query units, which older Chrome
  // resolves to zero when the pane's height comes from its minimum height.
  const wrap = useRef<HTMLElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const narrow = window.matchMedia('(max-width: 899px)').matches;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const next = narrow ? Math.min(w - 24, 560) : Math.min(w - 40, h - 84);
      setSize(next > 120 ? Math.floor(next) : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sun = overhead ? polar(overhead.sun, BODY) : null;
  const earth = overhead ? polar(overhead.earth, BODY) : null;

  return (
    <section ref={wrap} className="mapwrap fill" aria-labelledby="map-title">
      <h2 className="cap" id="map-title">
        02 / SOUTH POLE · POLAR VIEW
      </h2>
      <div
        className="disc"
        style={size ? { width: size } : undefined}
        role="group"
        aria-label="South pole map, from 65 degrees south to the pole. Zero longitude is at the top."
      >
        <div className="rim" />
        <div className="ring" style={{ inset: '22.2%' }} />
        <div className="ring" style={{ inset: '33.3%' }} />
        <div className="ring" style={{ inset: '41.7%' }} />
        {earth && (
          <>
            <div
              className="body-dot earth"
              style={{ left: `calc(${pct(earth.x)} - 7px)`, top: `calc(${pct(earth.y)} - 7px)` }}
              aria-hidden="true"
            />
            <div className="pl" style={{ left: `calc(${pct(earth.x)} - 18px)`, top: `calc(${pct(earth.y)} + 9px)` }}>
              EARTH
            </div>
          </>
        )}
        {sun && (
          <>
            <div
              className="body-dot sun"
              style={{ left: `calc(${pct(sun.x)} - 7px)`, top: `calc(${pct(sun.y)} - 7px)` }}
              aria-hidden="true"
            />
            <div className="pl" style={{ left: `calc(${pct(sun.x)} - 12px)`, top: `calc(${pct(sun.y)} + 9px)` }}>
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
                style={{ left: `calc(${pct(x)} - 22px)`, top: `calc(${pct(y)} - 22px)` }}
                aria-pressed={selected}
                aria-label={`${r.site.name}, ${word.toLowerCase()}`}
                onClick={() => onSelect(r.site.id)}
              >
                <span />
              </button>
              <div
                className={`pl ${selected ? 'sel' : ''}`}
                style={{ left: `calc(${pct(x)} + 14px)`, top: `calc(${pct(y)} - 8px)` }}
              >
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
