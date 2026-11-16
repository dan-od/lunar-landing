// Phone site card (direction A, screen 1): the answer first. Big status with a
// one-sentence reason, Sun and Earth, the next change, the 30-day strip, then
// sections that open in place: Map (zoomed on the site), Timeline, Sky, All
// sites and Download. ‹ › step through the sites the board is showing.
import { latLonText } from '@moon/core';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DISPLAY_DAYS, DISPLAY_HOURS, fmtDeg, fmtDuration, overheadLongitudes, readoutAt } from '../siteData';
import { Term } from '../help/Term';
import { PoleMap } from './PoleMap';
import { SkyView, compass } from './SkyView';
import { Track, TrackLegend } from './Timeline';
import { cardTime, nextAcross, nextChange, reasonFor } from './phoneBoard';
import { NO_DATA, type SiteRow } from './types';

interface Props {
  row: SiteRow;
  rows: SiteRow[];
  /** Where this site sits among the sites the board shows: "SOUTH POLE · 2 OF 8 READY". */
  position: string;
  prevId?: string;
  nextId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
  fetching: boolean;
  t: number;
  marginDeg: number;
  playing: boolean;
  onPlay: () => void;
  onScrub: (t: number) => void;
  csvHref: string;
}

function splitSource(source: string): { label: string; url?: string } {
  const i = source.indexOf('http');
  if (i < 0) return { label: source };
  return { label: source.slice(0, i).replace(/,\s*$/, '').trim(), url: source.slice(i).trim() };
}

/** A section of the card that opens in place. */
function Fold({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className={`fold ${open ? 'open' : ''}`}>
      <h3>
        <button type="button" className="fold-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span className="fold-title">{title}</span>
          <span className="fold-sum">{summary}</span>
          <span aria-hidden="true" className="fold-caret">
            {open ? '▾' : '▸'}
          </span>
        </button>
      </h3>
      <div id={id} className="fold-body" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}

export function SiteCard(props: Props) {
  const { row, rows, position, prevId, nextId, onOpen, onBack, fetching, t, marginDeg, playing, onPlay, onScrub, csvHref } = props;
  const { now, result, series, site } = row;
  const state = now?.state;
  const terrain = Boolean(series?.horizon);
  const src = splitSource(site.source);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const landingMs = series?.sun[0] ? Date.parse(series.sun[0].time) : 0;
  const hoursLeft = DISPLAY_HOURS - Math.round(t * 24);

  // Focus moves to the site name when the card opens.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const change = result && now ? nextChange(result, now.time, hoursLeft) : undefined;
  const after = change && series ? readoutAt(series, marginDeg, t + change.hoursAfterLanding / 24)?.state : undefined;
  const across = now ? nextAcross(rows, now.time, hoursLeft) : undefined;
  const onMap = site.lat <= -65 && !site.aim;
  const overhead = now ? overheadLongitudes(site.lat, site.lon, now) : undefined;
  const at = t === 0 ? 'AT LANDING' : `AT T+${t.toFixed(1)} D`;

  return (
    <div className="pcard">
      <div className="pcard-top">
        <button type="button" className="pcard-back" id="card-back" onClick={onBack}>
          <span aria-hidden="true">‹ </span>BOARD
          <span className="sr">: back to all sites</span>
        </button>
        <span className="mono pcard-pos">{position}</span>
      </div>
      <div className="pcard-head">
        <button type="button" className="pcard-step" disabled={!prevId} onClick={() => prevId && onOpen(prevId)} aria-label="Previous site">
          <span aria-hidden="true">‹</span>
        </button>
        <h2 className="pcard-name" ref={nameRef} tabIndex={-1}>
          {site.name}
        </h2>
        <button type="button" className="pcard-step" disabled={!nextId} onClick={() => nextId && onOpen(nextId)} aria-label="Next site">
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="sr" aria-live="polite">
        {site.name}, {state ? state.word.toLowerCase() : 'no data'}. {position.toLowerCase()}.
      </div>

      <div className="pad pcard-status">
        <div className="mono pcard-at">{at}</div>
        <div className={`pstate ${state?.word === 'READY' ? 'ok' : ''} ${state ? '' : 'wait'}`}>
          {state ? `${state.symbol} ${state.word}` : fetching ? '… FETCHING' : `${NO_DATA.symbol} ${NO_DATA.word}`}
        </div>
        <p className="pcard-reason">
          {now
            ? reasonFor(now, terrain)
            : fetching
              ? 'Asking NASA for this site’s positions…'
              : 'No saved positions for this moment, so nothing is shown. Nothing is estimated.'}
        </p>
      </div>

      <div className="grid2">
        <div className="ro">
          <i>SUN</i>
          <b className="c-sun">{now ? fmtDeg(now.sunElev) : '—'}</b>
        </div>
        <div className="ro">
          <i>EARTH</i>
          <b className="c-earth">{now ? fmtDeg(now.earthElev) : '—'}</b>
        </div>
      </div>

      {result && now && (
        <div className="pnext">
          <div className="mono pnext-k">NEXT CHANGE</div>
          {change ? (
            <>
              <div className="pnext-v">
                <span aria-hidden="true">{change.kind.endsWith('rise') ? '▲ ' : '▼ '}</span>
                {change.label} in {fmtDuration(change.hoursAfterLanding)}
              </div>
              <div className="mono pnext-t">
                {cardTime(change.time)}
                {after ? ` · THEN ${after.word}` : ''}
              </div>
            </>
          ) : (
            <div className="pnext-v">Nothing changes before day 30.</div>
          )}
        </div>
      )}

      {result && (
        <div className="pad line pstrip">
          <div className="mono pstrip-k">
            <span>NEXT 30 DAYS</span>
            <span>
              {result.power.uptimePct}% POWER <Term id="power" /> · {result.contact.uptimePct}% LINK <Term id="link" />
            </span>
          </div>
          <TrackLegend className="pstrip-legend" />
          <div
            className="pstrip-bars"
            role="img"
            aria-label={`Sunlight ${result.power.uptimePct} percent and Earth in view ${result.contact.uptimePct} percent of the 30 days after landing`}
          >
            <Track windows={result.power.windows} landingMs={landingMs} kind="power" />
            <Track windows={result.contact.windows} landingMs={landingMs} kind="contact" />
          </div>
        </div>
      )}

      <Fold
        title="MAP"
        summary={onMap ? `Zoomed on this site${overhead && now ? ` · Sun ${compass(now.sunAz)}` : ''}` : 'North of the polar map'}
      >
        {onMap ? (
          <PoleMap
            rows={rows}
            selectedId={site.id}
            onSelect={onOpen}
            overhead={overhead}
            statusMarkers
            focusId={site.id}
            caption="SOUTH POLE · ZOOMED ON THIS SITE"
          />
        ) : (
          <p className="pad hint">
            {site.name} is at {latLonText(site.lat, site.lon)}, north of 65° S, so it is not on the south
            pole map.
          </p>
        )}
      </Fold>

      <Fold title="TIMELINE" summary="Play the 30 days">
        <div className="pad ptl">
          {result && (
            <div className="pstrip-bars ptl-bars" aria-hidden="true">
              <Track windows={result.power.windows} landingMs={landingMs} kind="power" />
              <Track windows={result.contact.windows} landingMs={landingMs} kind="contact" />
              <span className="ph" style={{ left: `${(t / DISPLAY_DAYS) * 100}%` }} />
            </div>
          )}
          {result && <TrackLegend className="pstrip-legend" />}
          <div className="mono hint cmp-axis">
            <span>LANDING</span>
            <span>+30 D</span>
          </div>
          <div className="scrub">
            <button type="button" className="btn2" aria-pressed={playing} onClick={onPlay}>
              {playing ? '❚❚ PAUSE' : '▶ PLAY'}
            </button>
            <label className="sr" htmlFor="card-scrub">
              Days after landing
            </label>
            <input
              id="card-scrub"
              type="range"
              min={0}
              max={DISPLAY_DAYS}
              step={0.5}
              value={t}
              aria-valuetext={`${t.toFixed(1)} days after landing`}
              onChange={(e) => onScrub(Number(e.target.value))}
            />
            <span className="mono tplus">T+{t.toFixed(1)} d</span>
          </div>
          {now && (
            <p className="ptl-at">
              <span className="mono hint">AT T+{t.toFixed(1)} D · {cardTime(now.time)}</span>
              <br />
              <b>
                {now.state.symbol} {now.state.word}
              </b>{' '}
              · Sun {fmtDeg(now.sunElev)} · Earth {fmtDeg(now.earthElev)}
            </p>
          )}
        </div>
      </Fold>

      <Fold title="SKY" summary={now ? `Sun ${compass(now.sunAz)}, Earth ${compass(now.earthAz)}` : 'No positions'}>
        <div className="pad">
          {now ? (
            <SkyView readout={now} marginDeg={marginDeg} tDays={t} horizon={series?.horizon} />
          ) : (
            <p className="hint">No saved positions for this moment.</p>
          )}
        </div>
      </Fold>

      <button type="button" className="fold-head fold-link" onClick={onBack}>
        <span className="fold-title">ALL SITES</span>
        <span className="fold-sum">
          {across ? `Next: ${across.change.label.toLowerCase()} at ${across.row.short}, ${fmtDuration(across.change.hoursAfterLanding)}` : 'Back to the board'}
        </span>
        <span aria-hidden="true" className="fold-caret">
          ▸
        </span>
      </button>

      {result && (
        <a className="fold-head fold-link" href={csvHref} download>
          <span className="fold-title">DOWNLOAD</span>
          <span className="fold-sum">
            Spreadsheet · {result.power.windows.length + result.contact.windows.length} windows
          </span>
          <span aria-hidden="true" className="fold-caret">
            ↓
          </span>
        </a>
      )}

      <div className="pad pcard-src">
        <div className="mono hint">
          {latLonText(site.lat, site.lon)}
          {src.url ? '' : ` · SOURCE ${src.label}`}
        </div>
        {src.url && (
          <a className="source-link mono" href={src.url} target="_blank" rel="noreferrer">
            COORDINATES FROM {src.label.toUpperCase()}
            <span aria-hidden="true"> ↗</span>
            <span className="sr"> (opens in a new tab)</span>
          </a>
        )}
        {site.note && <p className="hint">{site.note}</p>}
        <p className="hint">
          {terrain
            ? 'Terrain model: judged against this point’s own horizon from the LOLA elevation map.'
            : `Smooth-Moon model with a ${marginDeg.toFixed(1)}° shadow allowance. Hills are only counted on the Miss tab.`}
        </p>
      </div>
    </div>
  );
}
