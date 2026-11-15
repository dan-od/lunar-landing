// Flow 3: compare two cases. Two equal panes, each with its own place, date and
// hour, and a change report built from the same calculator results shown on
// each side. Behaviour and wording follow the flow prototype.
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildReport, reportText, shownDays, type WindowResult } from '@moon/core';
import type { ApiSite } from '../api';
import { useApp } from '../state';
import { DATE_MAX, DATE_MIN, isAllowedDate, type CompareSide } from '../scenario';
import { fmtDeg, resultFor, type SiteSeries } from '../siteData';
import { Track } from '../console/Timeline';
import { NO_DATA } from '../console/types';
import { QUICK_SETUPS, sideA, sideB } from './sides';
import { useCase, type CaseData } from './useCase';

const TITLE = 'Moon Status: compare two landing cases';
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

interface PaneProps {
  letter: 'A' | 'B';
  side: CompareSide;
  sites: ApiSite[];
  data: CaseData;
  result?: WindowResult;
  onChange: (next: CompareSide) => void;
}

function SidePane({ letter, side, sites, data, result, onChange }: PaneProps) {
  const id = useId();
  const [dateError, setDateError] = useState('');
  const series: SiteSeries | undefined = data.series;
  const landing = result?.landing;
  const landingMs = series?.sun[0] ? Date.parse(series.sun[0].time) : 0;

  return (
    <section className="main cmp-side" aria-labelledby={`${id}-title`}>
      <h2 className="lbl cmp-head" id={`${id}-title`}>
        <span>SIDE {letter}</span>
        <span className={`tag ${landing?.word === 'READY' ? 'ok' : ''} ${landing ? '' : 'wait'}`}>
          {data.loading
            ? '… LOADING'
            : landing
              ? `${landing.symbol} ${landing.word}`
              : `${NO_DATA.symbol} ${NO_DATA.word}`}
        </span>
      </h2>

      <div className="pad line">
        <label className="fld">
          <span>PLACE</span>
          <select value={side.site} onChange={(e) => onChange({ ...side, site: e.target.value })}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {dateError && (
          <p className="err" role="alert" id={`${id}-err`}>
            {dateError}
          </p>
        )}
        <div className="grid2 gap">
          <label className="fld">
            <span>DATE (UTC)</span>
            <input
              type="date"
              min={DATE_MIN}
              max={DATE_MAX}
              value={side.date}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? `${id}-err` : undefined}
              onChange={(e) => {
                const v = e.target.value;
                if (isAllowedDate(v)) {
                  setDateError('');
                  onChange({ ...side, date: v });
                } else if (v) {
                  setDateError(`The date must be between ${DATE_MIN} and ${DATE_MAX}.`);
                }
              }}
            />
          </label>
          <label className="fld">
            <span>HOUR (UTC)</span>
            <select value={side.hour} onChange={(e) => onChange({ ...side, hour: Number(e.target.value) })}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hh(h)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {data.failure && (
        <div className="ban" role="status">
          <span>
            <b>▲ {data.failure.message}</b> Nothing is shown for this side until it loads.
          </span>
        </div>
      )}

      <div className="grid3">
        <div className="ro">
          <i>SUN ELEV</i>
          <b className="c-sun">{series ? fmtDeg(series.sun[0]!.elevationDeg) : '—'}</b>
        </div>
        <div className="ro">
          <i>EARTH ELEV</i>
          <b className="c-earth">{series ? fmtDeg(series.earth[0]!.elevationDeg) : '—'}</b>
        </div>
        <div className="ro">
          <i>POWER UP</i>
          <b>{result ? `${result.power.uptimePct}%` : '—'}</b>
        </div>
        <div className="ro">
          <i>LINK UP</i>
          <b>{result ? `${result.contact.uptimePct}%` : '—'}</b>
        </div>
        <div className="ro">
          <i>LONGEST DARK</i>
          <b>{result ? `${shownDays(result.power.longestGapDays)} d` : '—'}</b>
        </div>
        <div className="ro">
          <i>LONGEST GAP</i>
          <b>{result ? `${shownDays(result.contact.longestGapDays)} d` : '—'}</b>
        </div>
      </div>

      <div className="pad">
        {result ? (
          <>
            <div
              className="cmp-track"
              role="img"
              aria-label={`Side ${letter}: sunlight ${result.power.uptimePct} percent of the 30 days after landing`}
            >
              <Track windows={result.power.windows} landingMs={landingMs} kind="power" />
            </div>
            <div
              className="cmp-track"
              role="img"
              aria-label={`Side ${letter}: Earth in view ${result.contact.uptimePct} percent of the 30 days after landing`}
            >
              <Track windows={result.contact.windows} landingMs={landingMs} kind="contact" />
            </div>
            <div className="mono hint cmp-axis">
              <span>LANDING</span>
              <span>+30 D</span>
            </div>
          </>
        ) : (
          <p className="hint">{data.loading ? 'Asking for positions…' : 'No saved positions for this case.'}</p>
        )}
      </div>
    </section>
  );
}

export function ComparePage() {
  const { scenario, update, started, start, sites, search, say } = useApp();
  const ids = sites.map((s) => s.id);
  const a = sideA(scenario);
  const b = sideB(scenario, ids);
  const ready = started && sites.length > 0;

  useEffect(() => {
    document.title = TITLE;
  }, []);

  // Opened cold with no scenario in the address: use the default case.
  useEffect(() => {
    if (!started) start();
  }, [started, start]);

  const dataA = useCase(a, ready);
  const dataB = useCase(b, ready);
  const resultA = dataA.series ? resultFor(dataA.series, scenario.margin) : undefined;
  const resultB = dataB.series ? resultFor(dataB.series, scenario.margin) : undefined;
  const report = resultA && resultB ? buildReport(resultA, resultB) : undefined;

  const nameOf = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const context =
    `A: ${nameOf(a.site)}, ${a.date} ${hh(a.hour)} UTC. B: ${nameOf(b.site)}, ${b.date} ${hh(b.hour)} UTC. ` +
    `30 days from landing, shadow allowance ${scenario.margin.toFixed(1)}°. ` +
    'Smooth-Moon model, positions from NASA JPL Horizons.';

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(reportText(report, context));
      say('Report copied');
    } catch {
      say('Copy is not available here. Select the report text to copy it by hand.');
    }
  };

  return (
    <main id="content" className="cmp-page">
      <h1 className="sr">Compare two cases</h1>

      <div className="cmp-setups" role="group" aria-labelledby="setups-title">
        <h2 className="lbl" id="setups-title">
          01 / QUICK SETUPS
        </h2>
        {QUICK_SETUPS.map((q) => (
          <button
            key={q.key}
            type="button"
            aria-pressed={scenario.setup === q.key}
            onClick={() => update({ setup: q.key, b: null })}
          >
            {q.label}
          </button>
        ))}
        <button type="button" disabled aria-describedby="aim-why">
          TARGET VS MY AIM
        </button>
        <span className="hint cmp-why" id="aim-why">
          Target vs my aim needs an aim from the Miss tab, which is not built yet.
        </span>
      </div>

      <div className="body">
      <SidePane
        letter="A"
        side={a}
        sites={sites}
        data={dataA}
        result={resultA}
        onChange={(next) => update({ site: next.site, date: next.date, hour: next.hour, t: 0 })}
      />
      <SidePane
        letter="B"
        side={b}
        sites={sites}
        data={dataB}
        result={resultB}
        onChange={(next) => update({ setup: 'custom', b: next })}
      />

      <aside className="insp" aria-labelledby="report-title">
        <h2 className="lbl" id="report-title">
          02 / CHANGE REPORT
        </h2>
        {report ? (
          <div className="cmp-report">
            <div className="pad line">
              <div className="h2 site-name">{report.verdict}</div>
              {report.note && <p className="cmp-note">{report.note}</p>}
            </div>
            <ul className="cmp-lines">
              {report.lines.map((l) => (
                <li key={l.text} className={`cmp-line ${l.mark}`}>
                  <span className="mono cmp-mark">
                    {l.symbol} {l.label}:
                  </span>{' '}
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
            <p className="pad hint line">{context}</p>
          </div>
        ) : (
          <p className="pad hint">
            {dataA.loading || dataB.loading || !ready
              ? 'Asking for positions for both sides…'
              : 'The report needs positions for both sides.'}
          </p>
        )}
        <div className="grid2 exits cmp-actions">
          <button type="button" className="btn" disabled={!report} onClick={copy}>
            COPY REPORT
          </button>
          <Link to={{ pathname: '/watch', search }}>WATCH THIS</Link>
        </div>
      </aside>
      </div>
    </main>
  );
}
