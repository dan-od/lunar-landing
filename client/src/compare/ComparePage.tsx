// Flow 3: compare two cases. Two equal panes, each with its own place, date and
// hour, and a change report built from the same calculator results shown on
// each side. Behaviour and wording follow the flow prototype.
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { usePhone } from '../usePhone';
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
import { groupSites } from '../console/siteGroups';
import { fmtDeg, resultFor, type SiteSeries } from '../siteData';
import { Track } from '../console/Timeline';
import { NO_DATA } from '../console/types';
import { QUICK_SETUPS, sideA, sideB } from './sides';
import { useCase, type CaseData, type CaseSource } from './useCase';

const TAB = tabFor('/compare')!;

/** Short chip words on a phone; the full setup name is still spoken. */
const SHORT: Record<string, string> = { date: '+10 DAYS', time: '+12 HOURS', site: 'TWO SITES', aim: 'MY AIM' };
/** Report lines shown under the pinned verdict before "more". */
const PINNED_LINES = 2;

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
            {groupSites(sites.map((s) => ({ site: s, short: s.name })), '')
              .filter((g) => g.rows.length > 0)
              .map((g) => (
                <optgroup key={g.title} label={g.title}>
                  {g.rows.map(({ site: s }) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
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
  const phone = usePhone();
  const [tab, setTab] = useState<'A' | 'B'>('A');
  const [allLines, setAllLines] = useState(false);

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

  const setups = (
      <div className="cmp-setups" role="group" aria-labelledby="setups-title">
        <h2 className="lbl" id="setups-title">
          {phone ? 'TRY:' : '01 / QUICK SETUPS'}
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
              {phone ? (
                <>
                  {SHORT[q.key]}
                  <span className="sr">: {q.label.toLowerCase()}</span>
                </>
              ) : (
                q.label
              )}
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
  );

  const actions = (
    <div className="grid2 exits cmp-actions">
      <button type="button" className="btn" disabled={!report} onClick={copy}>
        COPY REPORT
      </button>
      <Link to={{ pathname: '/watch', search }}>WATCH THIS</Link>
    </div>
  );

  // Phone (A, screen 4): setup chips, the verdict pinned at the top, and A and B as two tabs.
  if (phone) {
    const sides = { A: { side: a, data: dataA, result: resultA }, B: { side: b, data: dataB, result: resultB } };
    const tabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 'A' : e.key === 'End' ? 'B' : tab === 'A' ? 'B' : 'A';
      setTab(next);
      document.getElementById(`side-tab-${next}`)?.focus();
    };
    const lines = report ? (allLines ? report.lines : report.lines.slice(0, PINNED_LINES)) : [];
    const cur = sides[tab];
    return (
      <main id="content" tabIndex={-1} className="cmp-page pcmp">
        <h1 className="sr">Compare two cases</h1>
        {setups}
        <section className="pverdict" aria-labelledby="report-title">
          <h2 className="mono pverdict-k" id="report-title">
            VERDICT
          </h2>
          {report ? (
            <>
              <div className="pverdict-v">{report.verdict}</div>
              {report.note && <p className="cmp-note">{report.note}</p>}
              <ul className="pverdict-lines">
                {lines.map((l) => (
                  <li key={l.text}>
                    <span aria-hidden="true">{l.symbol} </span>
                    <span className="sr">{l.label}: </span>
                    {l.text}
                  </li>
                ))}
              </ul>
              {report.lines.length > PINNED_LINES && (
                <button type="button" className="inline-btn pverdict-more" aria-expanded={allLines} onClick={() => setAllLines((v) => !v)}>
                  {allLines ? 'FEWER LINES' : `+ ${report.lines.length - PINNED_LINES} MORE LINES`}
                </button>
              )}
            </>
          ) : (
            <p className="hint">
              {dataA.loading || dataB.loading || !ready ? 'Asking for positions for both sides…' : 'The report needs positions for both sides.'}
            </p>
          )}
        </section>
        <div className="pside-tabs" role="tablist" aria-label="Side">
          {(['A', 'B'] as const).map((k) => {
            const l = sides[k].result?.landing;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                id={`side-tab-${k}`}
                aria-selected={tab === k}
                aria-controls="side-panel"
                tabIndex={tab === k ? 0 : -1}
                onClick={() => setTab(k)}
                onKeyDown={tabKey}
              >
                <span className="mono">SIDE {k}</span>
                <b>{sides[k].side.date}</b>
                <span className="mono pside-st">
                  {sides[k].data.loading ? '… LOADING' : l ? `${l.symbol} ${l.word}` : `${NO_DATA.symbol} ${NO_DATA.word}`}
                </span>
              </button>
            );
          })}
        </div>
        <div role="tabpanel" id="side-panel" aria-labelledby={`side-tab-${tab}`}>
          <SidePane
            key={tab}
            letter={tab}
            side={cur.side}
            sites={sites}
            data={cur.data}
            result={cur.result}
            onChange={(next) =>
              tab === 'A'
                ? update({ site: next.site, date: next.date, hour: next.hour, t: 0 })
                : update({ setup: 'custom', b: next })
            }
          />
        </div>
        {actions}
        <p className="pad hint">{context}</p>
      </main>
    );
  }

  return (
    <main id="content" tabIndex={-1} className="cmp-page">
      <h1 className="sr">Compare two cases</h1>

      {setups}

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
        {actions}
      </aside>
      </div>
    </main>
  );
}
