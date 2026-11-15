// Inspector: the selected site at the time marker. State word and symbol, Sun and
// Earth height, the sky view, shares of the 30 days, and the next change.
import { Link } from 'react-router-dom';
import { fmtDeg, fmtDuration } from '../siteData';
import { SkyView } from './SkyView';
import { NO_DATA, type SiteRow } from './types';

interface Props {
  row: SiteRow;
  t: number;
  marginDeg: number;
  search: string;
  /** Address of the spreadsheet file for this site and scenario. */
  csvHref: string;
}

/** "LROC, https://…" to a label and a link. */
function splitSource(source: string): { label: string; url?: string } {
  const i = source.indexOf('http');
  if (i < 0) return { label: source };
  return { label: source.slice(0, i).replace(/,\s*$/, '').trim(), url: source.slice(i).trim() };
}

export function Inspector({ row, t, marginDeg, search, csvHref }: Props) {
  const { now, result, landing } = row;
  const state = now?.state;
  const src = splitSource(row.site.source);
  const next = (hours: number | null | undefined) =>
    hours === null || hours === undefined ? 'none in 30 d' : `T+${fmtDuration(hours)}`;

  return (
    <aside className="insp" aria-labelledby="insp-title">
      <h2 className="lbl" id="insp-title">
        04 / INSPECTOR · T+{t.toFixed(1)} d
      </h2>
      <div className="pad line">
        <div className="h2 site-name">{row.site.name}</div>
        <span className={`tag ${state?.word === 'READY' ? 'ok' : ''} ${state ? '' : 'wait'}`}>
          {state ? `${state.symbol} ${state.word}` : `${NO_DATA.symbol} ${NO_DATA.word}`}
        </span>
        <div className="mono coords">
          {row.site.lat.toFixed(2)}, {row.site.lon.toFixed(2)} · SOURCE{' '}
          {src.url ? (
            <a href={src.url} target="_blank" rel="noreferrer">
              {src.label}
            </a>
          ) : (
            src.label
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="ro">
          <i>SUN ELEV</i>
          <b className="c-sun">{now ? fmtDeg(now.sunElev) : '—'}</b>
        </div>
        <div className="ro">
          <i>EARTH ELEV</i>
          <b className="c-earth">{now ? fmtDeg(now.earthElev) : '—'}</b>
        </div>
        <div className="ro">
          <i>POWER UP · 30 D</i>
          <b>{result ? `${result.power.uptimePct}%` : '—'}</b>
        </div>
        <div className="ro">
          <i>LINK UP · 30 D</i>
          <b>{result ? `${result.contact.uptimePct}%` : '—'}</b>
        </div>
      </div>

      <div className="pad line">
        <div className="mono sub">SKY AT T+{t.toFixed(1)} d</div>
        {now ? (
          <SkyView readout={now} marginDeg={marginDeg} tDays={t} horizon={row.series?.horizon} />
        ) : (
          <p className="hint">No saved positions for this moment.</p>
        )}
      </div>

      <div className="pad line">
        <div className="mono sub">NEXT CHANGE FROM LANDING</div>
        {result && landing ? (
          <>
            <div>
              {landing.powerUp ? 'Sunset' : 'Sunrise'}:{' '}
              <span className="mono c-sun">{next(result.power.nextChangeHours)}</span>
            </div>
            <div>
              {landing.linkUp ? 'Earthset' : 'Earthrise'}:{' '}
              <span className="mono c-sun">{next(result.contact.nextChangeHours)}</span>
            </div>
          </>
        ) : (
          <div className="hint">No saved positions.</div>
        )}
      </div>

      <div className="grid3 line exits">
        <Link to={{ pathname: '/compare', search }}>COMPARE</Link>
        <Link to={{ pathname: '/miss', search }}>MISS</Link>
        <Link to={{ pathname: '/watch', search }}>WATCH</Link>
      </div>

      {result && (
        <div className="line exits single">
          <a href={csvHref} download>
            <span aria-hidden="true">↓ </span>DOWNLOAD SPREADSHEET ·{' '}
            {result.power.windows.length + result.contact.windows.length} WINDOWS
          </a>
        </div>
      )}

      <p className="pad hint">
        {row.series?.horizon
          ? 'Terrain model: this aim point is judged against its own horizon from the LOLA elevation map. The shadow allowance is not used here.'
          : 'Smooth-Moon model. Hills and crater rims are only counted on the Miss tab, where terrain is prepared.'}
      </p>
    </aside>
  );
}
