import { NavLink } from 'react-router-dom';
import { TABS } from '../tabs';
import { shortName, useApp } from '../state';
import { slipDate } from '../scenario';

const SLIPS: Array<{ days: number; text: string; label: string }> = [
  { days: -1, text: '−1 d', label: 'Landing one day earlier' },
  { days: 1, text: '+1 d', label: 'Landing one day later' },
  { days: 10, text: '+10 d', label: 'Landing ten days later' },
];

export function Header() {
  const { scenario, update, search, sites, started, drawerOpen, setDrawerOpen } = useApp();
  const site = sites.find((s) => s.id === scenario.site);

  return (
    <>
      <header className="hd">
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
            id="settings-open"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span aria-hidden="true">⚙ </span>SETTINGS
          </button>
        </div>
      </header>

      <div className="scn mono" role="group" aria-label="Scenario">
        <span className="lead">SCENARIO</span>
        <span>
          <span className="lead">PLACE </span>
          <b>{started && site ? shortName(site) : 'none yet'}</b>
        </span>
        <span>
          <span className="lead">LANDING </span>
          <b>
            {scenario.date} {String(scenario.hour).padStart(2, '0')}:00 UTC
          </b>
        </span>
        <span>
          MARGIN <b>{scenario.margin.toFixed(1)}°</b>
        </span>
        <span>
          ACCURACY <b>±{scenario.accuracy} m</b>
        </span>
        <span className="sp">
          {SLIPS.map((s) => (
            <button
              key={s.days}
              type="button"
              aria-label={s.label}
              disabled={!started}
              onClick={() => update({ date: slipDate(scenario.date, s.days), t: 0 })}
            >
              {s.text}
            </button>
          ))}
        </span>
      </div>
    </>
  );
}
