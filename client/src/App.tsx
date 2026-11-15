import { Routes, Route, Link } from 'react-router-dom';
import { Header } from './components/Header';
import { Page } from './components/Page';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ConsolePage } from './console/ConsolePage';
import { ComparePage } from './compare/ComparePage';
import { MissPage } from './miss/MissPage';
import { ApiPage } from './apiPage/ApiPage';
import { AppProvider, useApp } from './state';
import { TABS } from './tabs';

const HEADINGS: Record<string, string> = {
  '/watch': 'Watch and be alerted',
};

function Shell() {
  const { notices, dismissNotices, toast, search } = useApp();
  return (
    <div className="app">
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
        <Route path="/api" element={<ApiPage />} />
        {TABS.filter((t) => !['/', '/compare', '/miss', '/api'].includes(t.path)).map((t) => (
          <Route
            key={t.path}
            path={t.path}
            element={
              <Page title={t.title} description={t.description} path={t.path} heading={HEADINGS[t.path] ?? t.label} />
            }
          />
        ))}
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
      </footer>
      <SettingsDrawer />
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
      <Shell />
    </AppProvider>
  );
}
