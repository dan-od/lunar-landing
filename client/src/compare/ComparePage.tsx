// Flow 3: compare two cases. Two equal panes, each with its own place, date and
// hour, and a change report built from the same calculator results shown on
// each side. Behaviour and wording follow the flow prototype.
import { useEffect, useId } from 'react';
import { Select } from '../components/Select';
import { Link } from 'react-router-dom';
import { buildReport, reportText, shownDays, type WindowResult } from '@moon/core';
import type { ApiSite } from '../api';
import { tabFor } from '../tabs';
import { usePageMeta } from '../meta';
import { useApp } from '../state';
import { AIM_SITE_ID, type CompareSide } from '../scenario';
import { WhenFields, hh } from '../components/WhenFields';
import { Term } from '../help/Term';
import { fmtDeg, resultFor, type SiteSeries } from '../siteData';
import { Track } from '../console/Timeline';
import { NO_DATA } from '../console/types';
import { QUICK_SETUPS, sideA, sideB } from './sides';
import { useCase, type CaseData, type CaseSource } from './useCase';

const TAB = tabFor('/compare')!;

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
          <Select width="place" value={side.site} onChange={(e) => onChange({ ...side, site: e.target.value })}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <WhenFields
          label={`Side ${letter}`}
          date={side.date}
          hour={side.hour}
          onChange={(next) => onChange({ ...side, ...next })}
        />
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
          <i>POWER UP <Term id="power" /></i>
          <b>{result ? `${result.power.uptimePct}%` : '—'}</b>
        </div>
        <div className="ro">
          <i>LINK UP <Term id="link" /></i>
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
  const { scenario, update, started, start, sites, terrainSite, search, say } = useApp();
  const ids = sites.map((s) => s.id);
  const a = sideA(scenario);
  const b = sideB(scenario, ids);
  const ready = started && sites.length > 0;

  usePageMeta(TAB.title, TAB.description, TAB.path);

  // Opened cold with no scenario in the address: use the default case.
  useEffect(() => {
    if (!started) start();
  }, [started, start]);

  // Where each side's positions come from. The aim point is always judged on its
  // terrain; when it is being compared with its own target, the target is judged
  // on terrain too, so both sides use one model.
  const aimMoved = scenario.aim.east !== 0 || scenario.aim.north !== 0;
  const sourceOf = (side: CompareSide, other: CompareSide): CaseSource => {
    if (terrainSite && side.site === AIM_SITE_ID) return { site: terrainSite.id, aim: scenario.aim };
    if (terrainSite && side.site === terrainSite.id && other.site === AIM_SITE_ID) {
      return { site: terrainSite.id, aim: { east: 0, north: 0 } };
    }
    return { site: side.site };
  };
  const sourceA = sourceOf(a, b);
  const sourceB = sourceOf(b, a);
  const dataA = useCase(a, sourceA, ready);
  const dataB = useCase(b, sourceB, ready);
  const modelOf = (source: CaseSource) => (source.aim ? 'terrain' : 'smooth Moon');
  const models =
    modelOf(sourceA) === modelOf(sourceB)
      ? modelOf(sourceA) === 'terrain'
        ? 'Terrain model on both sides (LOLA elevation map); the shadow allowance is not used.'
        : `Smooth-Moon model, shadow allowance ${scenario.margin.toFixed(1)}°.`
      : `A uses the ${modelOf(sourceA)} model and B uses the ${modelOf(sourceB)} model, so this compares two different models.`;
  const resultA = dataA.series ? resultFor(dataA.series, scenario.margin) : undefined;
  const resultB = dataB.series ? resultFor(dataB.series, scenario.margin) : undefined;
  const report = resultA && resultB ? buildReport(resultA, resultB) : undefined;

  const nameOf = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const context =
    `A: ${nameOf(a.site)}, ${a.date} ${hh(a.hour)} UTC. B: ${nameOf(b.site)}, ${b.date} ${hh(b.hour)} UTC. ` +
    `30 days from landing. ${models} Positions from NASA JPL Horizons.`;

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
    <main id="content" tabIndex={-1} className="cmp-page">
      <h1 className="sr">Compare two cases</h1>

      <div className="cmp-setups" role="group" aria-labelledby="setups-title">
        <h2 className="lbl" id="setups-title">
          01 / QUICK SETUPS
        </h2>
        {QUICK_SETUPS.map((q) => {
          // "Target vs my aim" needs an aim that has been moved on the Miss tab.
          const needsAim = q.key === 'aim' && !(aimMoved && terrainSite);
          return (
            <button
              key={q.key}
              type="button"
              aria-pressed={scenario.setup === q.key}
              disabled={needsAim}
              aria-describedby={needsAim ? 'aim-why' : undefined}
              onClick={() =>
                update(
                  q.key === 'aim' && terrainSite
                    ? { site: terrainSite.id, setup: 'aim', b: null, t: 0 }
                    : { setup: q.key, b: null },
                )
              }
            >
              {q.label}
            </button>
          );
        })}
        {!(aimMoved && terrainSite) && (
          <span className="hint cmp-why" id="aim-why">
            Target vs my aim needs an aim: move it on the{' '}
            <Link className="inline-link" to={{ pathname: '/miss', search }}>
              Miss tab
            </Link>{' '}
            first.
          </span>
        )}
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
