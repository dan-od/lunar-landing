// South pole map: looking down on the pole, 0° longitude at the top, east to the
// right. Pins show each site's state at the time marker. The Sun and Earth sit
// at the longitude where each is overhead, derived from NASA positions.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { SiteRow } from './types';
import { placePinLabels } from './pinLabels';
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
  /** Only these rows are drawn (the phone filter chips). */
  visible?: (row: SiteRow) => boolean;
  /** Draw each marker with its state symbol (phone). */
  statusMarkers?: boolean;
  /** Zoom in with this site at the centre (the phone site card). */
  focusId?: string;
  /** Replaces the note about sites north of the map. */
  offMapNote?: (count: number) => ReactNode;
  caption?: string;
}

/** How far the map zooms in around one site. */
const ZOOM = 3;

export function PoleMap({ rows, selectedId, onSelect, overhead, visible, statusMarkers, focusId, offMapNote, caption }: Props) {
  const titleId = useId();
  // The aim point sits within a few hundred metres of its target, so it shares
  // that pin; it is listed and charted as its own row.
  const shown = visible ? rows.filter(visible) : rows;
  const onMap = shown.filter((r) => r.site.lat <= EDGE_LAT && !r.site.aim);
  const offMap = shown.filter((r) => r.site.lat > EDGE_LAT && !r.site.aim);
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

  const px = size ?? 520;
  const place = (lat: number, lon: number) => polar(lon, ((90 + lat) / (90 + EDGE_LAT)) * RIM);
  // Zoomed on one site: that site sits at the centre and everything scales up.
  const focusSite = focusId ? onMap.find((r) => r.site.id === focusId)?.site : undefined;
  const f = focusSite ? place(focusSite.lat, focusSite.lon) : null;
  const zoom = f ? ZOOM : 1;
  const project = (p: { x: number; y: number }) => (f ? { x: C + (p.x - f.x) * zoom, y: C + (p.y - f.y) * zoom } : p);
  const inView = (p: { x: number; y: number }) => Math.hypot(p.x - C, p.y - C) <= 47;
  const pinPos = onMap
    .map((r) => ({ r, ...project(place(r.site.lat, r.site.lon)) }))
    .filter((p) => !f || inView(p));
  const centre = project({ x: C, y: C });
  const RINGS = [RIM, 27.8, 16.7, 8.3];
  // The rim and the three rings, so names are kept off their lines.
  const circles = RINGS.map((r) => ({ cx: (centre.x / 100) * px, cy: (centre.y / 100) * px, r: ((r * zoom) / 100) * px }));
  const circleStyle = (r: number) => ({
    left: pct(centre.x - r * zoom),
    top: pct(centre.y - r * zoom),
    width: pct(2 * r * zoom),
    height: pct(2 * r * zoom),
  });
  const labels = placePinLabels(
    pinPos.map((p) => ({ id: p.r.site.id, x: (p.x / 100) * px, y: (p.y / 100) * px, text: p.r.short })),
    selectedId,
    circles,
  );

  // Zoomed in, the Sun and Earth sit on the edge of the view, in their direction from the site.
  const body = (lon: number) => {
    const full = polar(lon, BODY);
    if (!f) return full;
    const a = Math.atan2(full.y - f.y, full.x - f.x);
    return { x: C + 44 * Math.cos(a), y: C + 44 * Math.sin(a) };
  };
  const sun = overhead ? body(overhead.sun) : null;
  const earth = overhead ? body(overhead.earth) : null;

  return (
    <section ref={wrap} className="mapwrap fill" aria-labelledby={titleId}>
      <h2 className="cap" id={titleId}>
        {caption ?? '02 / SOUTH POLE · POLAR VIEW'}
      </h2>
      <div
        className={`disc ${f ? 'zoom' : ''}`}
        style={size ? { width: size } : undefined}
        role="group"
        aria-label={
          f && focusSite
            ? `South pole map, zoomed in with ${focusSite.name} at the centre. Zero longitude is toward the top.`
            : 'South pole map, from 65 degrees south to the pole. Zero longitude is at the top.'
        }
      >
        <div className="rim" style={circleStyle(RIM)} />
        {RINGS.slice(1).map((r) => (
          <div key={r} className="ring" style={circleStyle(r)} />
        ))}
        {earth && (
          <>
            <div
              className="body-dot earth"
              style={{ left: `calc(${pct(earth.x)} - 7px)`, top: `calc(${pct(earth.y)} - 7px)` }}
              aria-hidden="true"
            />
            <div className="pl" style={{ left: `calc(${pct(earth.x)} - 18px)`, top: earth.y < C ? `calc(${pct(earth.y)} - 24px)` : `calc(${pct(earth.y)} + 9px)` }}>
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
            <div className="pl" style={{ left: `calc(${pct(sun.x)} - 12px)`, top: sun.y < C ? `calc(${pct(sun.y)} - 24px)` : `calc(${pct(sun.y)} + 9px)` }}>
              SUN
            </div>
          </>
        )}
        {pinPos.map(({ r, x, y }, i) => {
          const label = labels[i]!;
          const state = r.now?.state;
          const word = state?.word ?? NO_DATA.word;
          const ready = state?.word === 'READY';
          const selected = r.site.id === selectedId;
          return (
            <span key={r.site.id}>
              <button
                type="button"
                className={`pin ${ready ? 'ok' : ''} ${state ? '' : 'nodata'} ${statusMarkers ? 'status' : ''}`}
                style={{ left: `calc(${pct(x)} - 22px)`, top: `calc(${pct(y)} - 22px)` }}
                aria-pressed={statusMarkers ? undefined : selected}
                data-site={r.site.id}
                aria-label={`${r.site.name}, ${word.toLowerCase()}`}
                onClick={() => onSelect(r.site.id)}
              >
                {statusMarkers ? <span aria-hidden="true">{state?.symbol ?? NO_DATA.symbol}</span> : <span />}
              </button>
              {label.side !== 'hidden' && (
                <div
                  className={`pl ${selected ? 'sel' : ''}`}
                  aria-hidden="true"
                  style={{ left: `${label.box.left}px`, top: `${label.box.top}px` }}
                >
                  {r.short}
                </div>
              )}
            </span>
          );
        })}
      </div>
      {offMap.length > 0 && offMapNote && !f && offMapNote(offMap.length)}
      {offMap.length > 0 && !offMapNote && !f && (
        <p className="mapnote mono">
          {offMap.length <= 3
            ? `NOT ON THIS MAP (NORTH OF 65° S): ${offMap.map((r) => r.short).join(', ')}. USE THE SITE LIST.`
            : `${offMap.length} SITES ARE NORTH OF 65° S AND NOT ON THIS MAP. USE THE SITE LIST.`}
        </p>
      )}
    </section>
  );
}
