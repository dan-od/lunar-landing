import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Page } from './components/Page';
import { TABS } from './tabs';

const HEADINGS: Record<string, string> = {
  '/': 'Console',
  '/compare': 'Compare two cases',
  '/miss': 'What if we miss?',
  '/watch': 'Watch and be alerted',
  '/api': 'API',
};

export function App() {
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <Header />
      <Routes>
        {TABS.map((t) => (
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
                That address does not exist. <a href="/">Back to the console.</a>
              </p>
            </Page>
          }
        />
      </Routes>
    </>
  );
}
