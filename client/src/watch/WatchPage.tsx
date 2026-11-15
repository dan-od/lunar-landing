// Flow 5, first part: watch a site without email. For the chosen place and
// landing time it lists the upcoming changes (sunrise, sunset, Earth rise,
// Earth set) over the next 30 days, read from the one calculator, each with an
// "Add to calendar" button that downloads a calendar file with a reminder.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { changesFrom, type ChangeKind } from '@moon/core';
import { windowsIcsUrl } from '../api';
import { tabFor } from '../tabs';
import { usePageMeta } from '../meta';
import { shortName, useApp } from '../state';
import { useSiteData } from '../useSiteData';
import { DISPLAY_DAYS, DISPLAY_HOURS, fmtDuration, resultFor } from '../siteData';
import { hh } from '../components/WhenFields';
import { confirmWatch, WatchFailure } from './watchApi';
import { EmailWatchForm, EmailWatchList } from './EmailWatch';
import { useWatches } from './WatchesProvider';

const TAB = tabFor('/watch')!;

/** Symbol and word for each change, so it never relies on colour. */
const MARKS: Record<ChangeKind, { symbol: string; cls: string }> = {
  sunrise: { symbol: '▲', cls: 'c-sun' },
  sunset: { symbol: '▼', cls: 'c-sun' },
  earthrise: { symbol: '▲', cls: 'c-earth' },
  earthset: { symbol: '▼', cls: 'c-earth' },
};

const REMINDERS = [
  { minutes: 15, label: '15 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;

/** The confirmation link's token, read once before the scenario is written to the address. */
const CONFIRM = new URLSearchParams(window.location.search).get('confirm');

export function WatchPage() {
  const { scenario, started, start, sites, force, search, say } = useApp();
  const { replace } = useWatches();
  const [remind, setRemind] = useState(60);
  const [confirmMsg, setConfirmMsg] = useState('');
  const confirmed = useRef(false);
  usePageMeta(TAB.title, TAB.description, TAB.path);

  // Opened from the confirmation email: confirm the watch once (5-2, 5-3).
  useEffect(() => {
    if (!CONFIRM || confirmed.current) return;
    confirmed.current = true;
    confirmWatch(CONFIRM)
      .then((w) => {
        replace(w);
        const msg =
          w.status === 'tripped'
            ? `Watch is active. Its first check found the rule already broken, so one alert was emailed.`
            : 'Watch is active. You will get one email if its rule breaks.';
        setConfirmMsg(msg);
        say(msg);
      })
      .catch((err) => setConfirmMsg(err instanceof WatchFailure ? err.message : 'The watch could not be confirmed.'));
  }, [replace, say]);

  // Opened cold with no scenario in the address: use the default case.
  useEffect(() => {
    if (!started) start();
  }, [started, start]);

  const site = sites.find((s) => s.id === scenario.site);
  const one = useMemo(() => (site ? [site] : []), [site]);
  const { data, loading, failure } = useSiteData(started ? one : [], scenario.date, scenario.hour, force);
  const series = site ? data[site.id] : undefined;
  const result = series ? resultFor(series, scenario.margin) : undefined;
  const landingIso = `${scenario.date}T${hh(scenario.hour)}:00Z`;
  const changes = result ? changesFrom(result, landingIso, DISPLAY_HOURS) : [];

  const fileSite = site?.aim?.base ?? site?.id ?? '';
  const aim = site?.aim ? { east: site.aim.east, north: site.aim.north } : undefined;
  const icsUrl = (only?: { at: string; kind: string }) =>
    windowsIcsUrl(fileSite, scenario.date, scenario.hour, DISPLAY_DAYS, scenario.margin, remind, aim, only);
  const model = result?.model === 'terrain'
    ? 'Terrain model: judged against the horizon at this aim point, from the LOLA elevation map.'
    : `Smooth-Moon model with a ${scenario.margin.toFixed(1)}° shadow allowance; hills are not counted.`;

  return (
    <main id="content" tabIndex={-1} className="body">
      <h1 className="sr">Watch a landing site</h1>
      <div className="main">
        {confirmMsg && (
          <div className="ban" role="status">
            <span>{confirmMsg}</span>
          </div>
        )}
        <h2 className="lbl" id="changes-title">
          01 / UPCOMING CHANGES · {site ? shortName(site).toUpperCase() : '…'} · 30 DAYS FROM {scenario.date}{' '}
          {hh(scenario.hour)} UTC
        </h2>
        {failure && !series && (
          <div className="ban" role="status">
            <span>
              <b>▲ {failure.message}</b> The changes cannot be listed until positions load.
            </span>
          </div>
        )}
        {loading || (!series && !failure) ? (
          <div aria-busy="true">
            <div className="lbl" role="status">
              ASKING NASA HORIZONS FOR SUN AND EARTH POSITIONS
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sk" />
            ))}
          </div>
        ) : result && changes.length === 0 ? (
          <p className="pad">
            Nothing changes in the 30 days after landing: the Sun stays {result.landing.powerUp ? 'up' : 'down'} and Earth
            stays {result.landing.linkUp ? 'in view' : 'out of view'} the whole time.
          </p>
        ) : result ? (
          <div className="tl-table watch-table">
            <table className="t">
              <caption className="sr">
                Sunrises, sunsets, Earth rises and Earth sets at {site?.name} in the 30 days after landing
              </caption>
              <thead>
                <tr>
                  <th scope="col">WHEN (UTC)</th>
                  <th scope="col">CHANGE</th>
                  <th scope="col">AFTER LANDING</th>
                  <th scope="col">
                    <span className="sr">Calendar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={`${c.kind}-${c.time}`}>
                    <td className="mono">{when(c.time)}</td>
                    <td>
                      <span aria-hidden="true" className={MARKS[c.kind].cls}>
                        {MARKS[c.kind].symbol}{' '}
                      </span>
                      {c.label}
                    </td>
                    <td className="mono">T+{fmtDuration(c.hoursAfterLanding)}</td>
                    <td className="watch-add">
                      <a className="btn2 as-button" href={icsUrl({ at: c.time, kind: c.kind })} download>
                        ADD TO CALENDAR
                        <span className="sr">
                          : {c.label}, {when(c.time)} UTC
                        </span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="pad hint">
          {model} Positions from NASA JPL Horizons, hourly, so each time is to the hour. Change the place
          or landing time in the bar at the top, or on the <Link to={{ pathname: '/', search }}>Console</Link>.
        </p>
        <EmailWatchList />
      </div>

      <aside className="insp" aria-labelledby="keep-title">
        <h2 className="lbl" id="keep-title">
          02 / ADD TO YOUR CALENDAR
        </h2>
        <div className="pad line">
          <label className="fld">
            <span>REMIND ME</span>
            <select value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
              {REMINDERS.map((r) => (
                <option key={r.minutes} value={r.minutes}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {changes.length > 0 ? (
            <a className="btn as-button watch-all" href={icsUrl()} download>
              ADD ALL {changes.length} TO CALENDAR
            </a>
          ) : (
            <button type="button" className="btn watch-all" disabled>
              ADD ALL TO CALENDAR
            </button>
          )}
          <p className="hint">
            Each one downloads a calendar file that your calendar app opens, with a reminder. Nothing is
            stored here.
          </p>
        </div>
        <EmailWatchForm />
      </aside>
    </main>
  );
}
