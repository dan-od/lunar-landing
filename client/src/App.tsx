import { Routes, Route, Link } from 'react-router-dom';
import { Header } from './components/Header';
import { Page } from './components/Page';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ConsolePage } from './console/ConsolePage';
import { AppProvider, useApp } from './state';
import { TABS } from './tabs';

const HEADINGS: Record<string, string> = {
  '/compare': 'Compare two cases',
  '/miss': 'What if we miss?',
  '/watch': 'Watch and be alerted',
  '/api': 'API',
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
        {TABS.filter((t) => t.path !== '/').map((t) => (
          <Route
            key={t.path}
            path={t.path}
            element={<Page title={t.title} heading={HEADINGS[t.path] ?? t.label} />}
          />
        ))}
        <Route
          path="*"
          element={
            <Page title="Moon Status: page not found" heading="Page not found">
              <p>
                That address does not exist. <Link to={{ pathname: '/', search }}>Back to the console.</Link>
              </p>
            </Page>
          }
        />
      </Routes>
      <footer className="ft">
        <span>● SOURCE JPL HORIZONS</span>
        <span>SMOOTH-MOON MODEL</span>
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
