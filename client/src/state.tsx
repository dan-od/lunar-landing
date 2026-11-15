// App-wide state: the shared scenario (kept in the page address), the site list,
// first-open, notices and the short status message.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCuratedSite } from '@moon/core';
import { ApiFailure, getSites, type ApiSite } from './api';
import { DEFAULT_SCENARIO, parseScenario, scenarioToQuery, type Scenario } from './scenario';

/** States that can be forced in a development or test build (1-7). */
export type ForceState = 'loading' | 'down' | 'empty' | null;

const FORCE_ALLOWED = import.meta.env.DEV || import.meta.env.VITE_TEST_BUILD === '1';
const SITES_KEY = 'moon:sites';

function readForce(search: string): ForceState {
  if (!FORCE_ALLOWED) return null;
  const f = new URLSearchParams(search).get('force');
  return f === 'loading' || f === 'down' || f === 'empty' ? f : null;
}

export type SitesStatus = 'loading' | 'ready';

interface AppState {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
  /** Query string (with leading "?") carrying the scenario to another tab. */
  search: string;
  started: boolean;
  start: (message?: string) => void;
  notices: string[];
  dismissNotices: () => void;
  sites: ApiSite[];
  sitesStatus: SitesStatus;
  /** Set when the site list could not be fetched; saved sites are shown if any. */
  sitesFailure: ApiFailure | null;
  reloadSites: () => void;
  force: ForceState;
  toast: string;
  say: (message: string) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

/** Short name for the scenario bar and timeline. */
export function shortName(site: ApiSite): string {
  return getCuratedSite(site.id)?.short ?? site.name.slice(0, 12);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const initial = useMemo(() => parseScenario(new URLSearchParams(window.location.search)), []);
  const [scenario, setScenario] = useState<Scenario>(initial.scenario);
  const [started, setStarted] = useState(initial.present);
  const [notices, setNotices] = useState<string[]>(initial.notices);
  const [force, setForce] = useState<ForceState>(() => readForce(window.location.search));
  const [toast, setToast] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [sites, setSites] = useState<ApiSite[]>([]);
  const [sitesStatus, setSitesStatus] = useState<SitesStatus>('loading');
  const [sitesFailure, setSitesFailure] = useState<ApiFailure | null>(null);
  const [sitesAttempt, setSitesAttempt] = useState(0);

  const query = scenarioToQuery(scenario) + (force ? `&force=${force}` : '');
  const search = started ? `?${query}` : force ? `?force=${force}` : '';

  // Write the scenario to the address (debounced so sliders do not flood history).
  const lastWritten = useRef<string | null>(null);
  useEffect(() => {
    if (!started) return;
    const id = window.setTimeout(() => {
      if (window.location.search !== search) {
        lastWritten.current = search;
        navigate({ pathname: window.location.pathname, search }, { replace: true });
      }
    }, 150);
    return () => window.clearTimeout(id);
  }, [search, started, navigate]);

  // Follow address changes made elsewhere (back button, a pasted link).
  useEffect(() => {
    if (location.search === lastWritten.current || location.search === search) return;
    const params = new URLSearchParams(location.search);
    if (!params.has('site')) return;
    const parsed = parseScenario(params);
    setScenario(parsed.scenario);
    setStarted(true);
    if (parsed.notices.length) setNotices(parsed.notices);
  }, [location.search]);

  const update = useCallback((patch: Partial<Scenario>) => {
    setScenario((s) => ({ ...s, ...patch }));
  }, []);

  const say = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const start = useCallback(
    (message?: string) => {
      setScenario({ ...DEFAULT_SCENARIO });
      setStarted(true);
      if (message) say(message);
    },
    [say],
  );

  // Load the site list; fall back to the list saved earlier if the server is down.
  useEffect(() => {
    if (force === 'loading') return;
    if (force === 'empty') {
      setSites([]);
      setSitesStatus('ready');
      return;
    }
    const controller = new AbortController();
    setSitesStatus('loading');
    const fallBackToSaved = (failure: ApiFailure) => {
      let saved: ApiSite[] = [];
      try {
        saved = JSON.parse(window.localStorage.getItem(SITES_KEY) ?? '[]') as ApiSite[];
      } catch {
        saved = [];
      }
      setSites(saved);
      setSitesFailure(failure);
      setSitesStatus('ready');
    };
    if (force === 'down') {
      fallBackToSaved(new ApiFailure('unavailable', 'NASA’s position service is not answering.'));
      return;
    }
    getSites(controller.signal)
      .then((list) => {
        setSites(list);
        setSitesFailure(null);
        setSitesStatus('ready');
        try {
          window.localStorage.setItem(SITES_KEY, JSON.stringify(list));
        } catch {
          // Storage full or blocked: the list simply is not saved.
        }
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        fallBackToSaved(err instanceof ApiFailure ? err : new ApiFailure('network', 'The site list could not be loaded.'));
      });
    return () => controller.abort();
  }, [force, sitesAttempt]);

  // A link naming a site that no longer exists opens the first site and says so.
  useEffect(() => {
    if (!started || sitesStatus !== 'ready' || sites.length === 0) return;
    if (sites.some((s) => s.id === scenario.site)) return;
    const first = sites[0]!;
    setNotices((n) => [
      ...n,
      `The link named a site that is not in the list (“${scenario.site}”). Showing ${first.name} instead.`,
    ]);
    setScenario((s) => ({ ...s, site: first.id, t: 0 }));
  }, [started, sitesStatus, sites, scenario.site]);

  const reloadSites = useCallback(() => {
    setForce((f) => (f === 'empty' ? null : f));
    setSitesAttempt((a) => a + 1);
  }, []);

  const value: AppState = {
    scenario,
    update,
    search,
    started,
    start,
    notices,
    dismissNotices: () => setNotices([]),
    sites,
    sitesStatus,
    sitesFailure,
    reloadSites,
    force,
    toast,
    say,
    drawerOpen,
    setDrawerOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
