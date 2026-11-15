// Email watches in this browser. The private link of each watch (its manage
// token) is kept only here, in local storage; it is what lets this browser see,
// re-check and delete the watch. When the shared scenario's date, hour, margin,
// accuracy or aim changes on any tab, confirmed watches on that place are
// re-checked once (the contract "any change → Watch").
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state';
import {
  getWatchConfig,
  lookupWatches,
  recheckWatches,
  type WatchConfig,
  type WatchScenario,
  type WatchSummary,
} from './watchApi';

const KEY = 'moon:watch-links';

interface Link {
  id: string;
  token: string;
}

function loadLinks(): Link[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw)
      ? raw.filter((x): x is Link => typeof x?.id === 'string' && typeof x?.token === 'string').slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function saveLinks(links: Link[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(links));
  } catch {
    // Storage blocked: the watch still works by email, but this browser forgets it.
  }
}

interface WatchesState {
  config: WatchConfig | null;
  watches: WatchSummary[];
  tokenFor: (id: string) => string | undefined;
  remember: (id: string, token: string) => void;
  forget: (id: string) => void;
  refresh: () => Promise<void>;
  replace: (w: WatchSummary) => void;
}

const Ctx = createContext<WatchesState | null>(null);

export function useWatches(): WatchesState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWatches must be used inside WatchesProvider');
  return v;
}

/** The watched place and scenario for the current shared scenario. */
export function watchTarget(
  site: { id: string; aim?: { base: string; east: number; north: number }; custom?: boolean } | undefined,
  s: { date: string; hour: number; margin: number; accuracy: number },
): { site: string; scenario: WatchScenario } | null {
  if (!site || site.custom) return null;
  const scenario: WatchScenario = { date: s.date, hour: s.hour, margin: s.margin, accuracy: s.accuracy };
  if (site.aim) return { site: site.aim.base, scenario: { ...scenario, aim_east: site.aim.east, aim_north: site.aim.north } };
  return { site: site.id, scenario };
}

export function WatchesProvider({ children }: { children: ReactNode }) {
  const { scenario, sites, started, say } = useApp();
  const [config, setConfig] = useState<WatchConfig | null>(null);
  const [links, setLinks] = useState<Link[]>(() => loadLinks());
  const [watches, setWatches] = useState<WatchSummary[]>([]);
  const linksRef = useRef(links);
  linksRef.current = links;

  useEffect(() => {
    getWatchConfig()
      .then(setConfig)
      .catch(() => setConfig({ email_enabled: false, rules: [], privacy: '' }));
  }, []);

  const refresh = useCallback(async () => {
    const tokens = linksRef.current.map((l) => l.token);
    if (tokens.length === 0) {
      setWatches([]);
      return;
    }
    try {
      const { watches: found } = await lookupWatches(tokens);
      setWatches(found);
      // Watches deleted elsewhere (for example by unsubscribing) are forgotten here too.
      const ids = new Set(found.map((w) => w.id));
      const kept = linksRef.current.filter((l) => ids.has(l.id));
      if (kept.length !== linksRef.current.length) {
        setLinks(kept);
        saveLinks(kept);
      }
    } catch {
      // Leave the list as it was; the page says nothing is shown until it loads.
    }
  }, []);

  useEffect(() => {
    if (config?.email_enabled) void refresh();
  }, [config, refresh]);

  // The ref is updated at once, so a refresh right after sees the new link.
  const remember = useCallback((id: string, token: string) => {
    const next = [...linksRef.current.filter((l) => l.id !== id), { id, token }].slice(-20);
    linksRef.current = next;
    saveLinks(next);
    setLinks(next);
  }, []);
  const forget = useCallback((id: string) => {
    const next = linksRef.current.filter((l) => l.id !== id);
    linksRef.current = next;
    saveLinks(next);
    setLinks(next);
    setWatches((prev) => prev.filter((w) => w.id !== id));
  }, []);
  const replace = useCallback((w: WatchSummary) => {
    setWatches((prev) => (prev.some((x) => x.id === w.id) ? prev.map((x) => (x.id === w.id ? w : x)) : [...prev, w]));
  }, []);
  const tokenFor = useCallback((id: string) => links.find((l) => l.id === id)?.token, [links]);

  // Re-check once after a change to the scenario, never on first load.
  const site = sites.find((s) => s.id === scenario.site);
  const target = started ? watchTarget(site, scenario) : null;
  const targetKey = target ? JSON.stringify(target) : '';
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!config?.email_enabled || !targetKey) return;
    if (lastKey.current === null) {
      lastKey.current = targetKey;
      return;
    }
    if (lastKey.current === targetKey) return;
    const t = JSON.parse(targetKey) as { site: string; scenario: WatchScenario };
    const mine = watches.filter((w) => w.site === t.site && (w.status === 'active' || w.status === 'tripped'));
    if (mine.length === 0) {
      lastKey.current = targetKey;
      return;
    }
    // Marked as done only when sent, so a refresh during the wait does not lose it.
    const id = window.setTimeout(() => {
      lastKey.current = targetKey;
      const before = new Map(mine.map((w) => [w.id, w.status]));
      recheckWatches(linksRef.current.map((l) => l.token), t.site, t.scenario)
        .then(({ watches: after }) => {
          setWatches(after);
          const tripped = after.filter((w) => before.get(w.id) === 'active' && w.status === 'tripped');
          const cleared = after.filter((w) => before.get(w.id) === 'tripped' && w.status === 'active');
          if (tripped.length) say(`Watch tripped: ${tripped.map((w) => w.rule_label.toLowerCase()).join(', ')}. One alert was emailed.`);
          else if (cleared.length) say('A tripped watch holds again.');
        })
        .catch(() => say('The watches could not be re-checked just now.'));
    }, 800);
    return () => window.clearTimeout(id);
  }, [targetKey, config, watches, say]);

  return (
    <Ctx.Provider value={{ config, watches, tokenFor, remember, forget, refresh, replace }}>{children}</Ctx.Provider>
  );
}
