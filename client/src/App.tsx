import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Header, BottomTabs } from './components/Header';
import { Page } from './components/Page';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HelpPanel } from './help/HelpPanel';
import { ConsolePage } from './console/ConsolePage';
import { ComparePage } from './compare/ComparePage';
import { MissPage } from './miss/MissPage';
import { ApiPage } from './apiPage/ApiPage';
import { WatchPage } from './watch/WatchPage';
import { WatchesProvider } from './watch/WatchesProvider';
import { AppProvider, useApp } from './state';
import { TABS } from './tabs';

function Shell() {
  const { notices, dismissNotices, toast, search } = useApp();
  // The Console fits the window like an app on a desktop (each pane scrolls on its own).
  const fit = useLocation().pathname === '/';
  return (
    <div className={`app ${fit ? 'fit' : ''}`}>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <Header />
      {notices.length > 0 && (
        <div className="ban notice" role="status">
          <span>
            {notices.map((n) => (
              <span key={n} className="notice-line">
                ▲ {n}
              </span>
            ))}
          </span>
          <button type="button" className="btn2" onClick={dismissNotices}>
            DISMISS
          </button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<ConsolePage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/miss" element={<MissPage />} />
        <Route path="/watch" element={<WatchPage />} />
        <Route path="/api" element={<ApiPage />} />
        <Route
          path="*"
          element={
            <Page
              title="Moon Status: page not found"
              description="That address does not exist on Moon Status."
              path="/"
              heading="Page not found"
            >
              <p>That address does not exist. These do:</p>
              <ul className="plain-links">
                {TABS.map((t) => (
                  <li key={t.path}>
                    <Link to={{ pathname: t.path, search }}>{t.label.charAt(0) + t.label.slice(1).toLowerCase()}</Link>:{' '}
                    {t.description}
                  </li>
                ))}
              </ul>
            </Page>
          }
        />
      </Routes>
      <footer className="ft">
        <span>● SOURCE JPL HORIZONS</span>
        <span>SMOOTH-MOON MODEL · TERRAIN ON THE MISS TAB AND AIM POINTS</span>
        <span>TIMES IN UTC</span>
        <Link className="ft-link" to={{ pathname: '/api', search, hash: '#right' }}>
          HOW WE KNOW IT&apos;S RIGHT
        </Link>
      </footer>
      <BottomTabs />
      <SettingsDrawer />
      <HelpPanel />
      <div className="live" aria-live="polite">
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <WatchesProvider>
        <Shell />
      </WatchesProvider>
    </AppProvider>
  );
}
