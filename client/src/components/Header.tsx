import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TABS } from '../tabs';
import { shortName, useApp } from '../state';
import { shiftDate } from '../scenario';
import { WhenFields, hh } from './WhenFields';
import { Term } from '../help/Term';

// The spoken name starts with the visible text, then says what it does.
const SLIPS: Array<{ key: string; by: { days?: number; months?: number; years?: number }; text: string; more: string }> = [
  { key: 'd-1', by: { days: -1 }, text: '−1 d', more: 'landing one day earlier' },
  { key: 'd1', by: { days: 1 }, text: '+1 d', more: 'landing one day later' },
  { key: 'd10', by: { days: 10 }, text: '+10 d', more: 'landing ten days later' },
  { key: 'm-1', by: { months: -1 }, text: '−1 mo', more: 'landing one month earlier' },
  { key: 'm1', by: { months: 1 }, text: '+1 mo', more: 'landing one month later' },
  { key: 'y-1', by: { years: -1 }, text: '−1 y', more: 'landing one year earlier' },
  { key: 'y1', by: { years: 1 }, text: '+1 y', more: 'landing one year later' },
];

export function Header() {
  const { scenario, update, search, sites, started, drawerOpen, setDrawerOpen, helpOpen, setHelpOpen, say } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const site = sites.find((s) => s.id === scenario.site);

  return (
    <header>
      <div className="hd">
        <div className="brand">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="13" fill="none" stroke="#fff" strokeWidth="2" />
            <path d="M16 3A13 13 0 0 1 16 29A7 13 0 0 0 16 3Z" fill="#EAFE07" />
          </svg>
          MOON STATUS
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <NavLink key={t.path} to={{ pathname: t.path, search }} end={t.path === '/'}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="right">
          <button
            type="button"
            id="help-open"
            aria-label="Help"
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen(true)}
          >
            <span aria-hidden="true">? </span>
            <span className="hd-word">HELP</span>
          </button>
          <button
            type="button"
            id="settings-open"
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span aria-hidden="true">⚙ </span>
            <span className="hd-word">SETTINGS</span>
          </button>
        </div>
      </div>

      <div className="scn mono" role="group" aria-label="Scenario">
        <span className="lead">SCENARIO</span>
        <span>
          <span className="lead">PLACE </span>
          <b>{started && site ? shortName(site) : 'none yet'}</b>
        </span>
        <span className="scn-when">
          <span className="lead">LANDING </span>
          <WhenFields
            label="Landing"
            date={scenario.date}
            hour={scenario.hour}
            disabled={!started}
            onChange={(next) => update({ ...next, t: 0 })}
            onNow={(next) => say(`Landing set to now: ${next.date} ${hh(next.hour)} UTC`)}
          />
        </span>
        <span className="xtra">
          MARGIN <b>{scenario.margin.toFixed(1)}°</b> <Term id="margin" />
        </span>
        <span className="xtra">
          ACCURACY <b>±{scenario.accuracy} m</b> <Term id="accuracy" />
        </span>
        {/* On a phone only the date, hour and Now show; the step buttons sit behind More. */}
        <span className="sp-more">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="slip-buttons"
            disabled={!started}
            onClick={() => setMoreOpen((o) => !o)}
          >
            {moreOpen ? 'FEWER' : 'MORE'}
            <span className="sr"> date steps (days, months, years)</span>
            <span aria-hidden="true"> {moreOpen ? '▲' : '▼'}</span>
          </button>
          <span className="sp-more-term">
            SLIP <Term id="slip" />
          </span>
        </span>
        <span className={`sp ${moreOpen ? 'open' : ''}`} id="slip-buttons">
          <span className="sp-term">
            <span className="lead">SLIP </span>
            <Term id="slip" />
          </span>
          {SLIPS.map((s) => (
            <button
              key={s.key}
              type="button"
              data-slip={s.key}
              disabled={!started}
              onClick={() => update({ date: shiftDate(scenario.date, s.by), t: 0 })}
            >
              {s.text}
              <span className="sr">, {s.more}</span>
            </button>
          ))}
        </span>
      </div>
    </header>
  );
}

/** On a phone the tabs move to a bar pinned to the bottom of the screen (1-9). */
export function BottomTabs() {
  const { search } = useApp();
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <NavLink key={t.path} to={{ pathname: t.path, search }} end={t.path === '/'}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
