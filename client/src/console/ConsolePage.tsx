// Flow 1: check a site. One page, three panes: site list, map + timeline,
// inspector. Behaviour follows the flow prototype.
import { useEffect, useMemo, useRef, useState } from 'react';
import { TABS } from '../tabs';
import { usePageMeta } from '../meta';
import { shortName, useApp } from '../state';
import { MAX_RETRIES, useSiteData } from '../useSiteData';
import { windowsCsvUrl } from '../api';
import { DISPLAY_DAYS, overheadLongitudes, readoutAt, resultFor } from '../siteData';
import { PoleMap } from './PoleMap';
import { Timeline } from './Timeline';
import { Inspector } from './Inspector';
import { AddCoordinates } from './AddCoordinates';
import { Tour } from '../help/Tour';
import { Incidents } from './IncidentList';
import { groupSites, SEARCH_FROM } from './siteGroups';
import { NO_DATA, type SiteRow } from './types';

const TAB = TABS[0]!;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** "LROC, https://…" to "LROC". */
function sourceLabel(source: string): string {
  const i = source.indexOf('http');
  return (i < 0 ? source : source.slice(0, i)).replace(/,\s*$/, '').trim();
}

export function ConsolePage() {
  const app = useApp();
  const { scenario, update, started, start, sites, sitesStatus, sitesFailure, reloadSites, force, search, say, addCustomSite } = app;
  const { data, loading, fetching, failures, failure, partial, retries, retry } = useSiteData(
    started ? sites : [],
    scenario.date,
    scenario.hour,
    force,
  );
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLElement>(null);
  const focusList = useRef(false);

  usePageMeta(TAB.title, TAB.description, TAB.path);

  // Play: step the marker; with reduced motion, jump in 5-day steps instead.
  useEffect(() => {
    if (!playing) return;
    const reduced = prefersReducedMotion();
    const id = window.setInterval(
      () => {
        const step = reduced ? 5 : 0.5;
        update({ t: scenario.t >= DISPLAY_DAYS ? 0 : Math.min(DISPLAY_DAYS, scenario.t + step) });
      },
      reduced ? 700 : 120,
    );
    return () => window.clearInterval(id);
  }, [playing, scenario.t, update]);

  const rows: SiteRow[] = useMemo(
    () =>
      sites.map((site) => {
        const series = data[site.id];
        if (!series) return { site, short: shortName(site) };
        const result = resultFor(series, scenario.margin);
        return {
          site,
          short: shortName(site),
          series,
          result,
          landing: result.landing,
          now: readoutAt(series, scenario.margin, scenario.t),
        };
      }),
    [sites, data, scenario.margin, scenario.t],
  );

  // After "choose my own site", put focus in the list.
  useEffect(() => {
    if (focusList.current && rows.length > 0) {
      focusList.current = false;
      listRef.current?.querySelector<HTMLButtonElement>('button.row')?.focus();
    }
  }, [rows.length, started]);

  // First open: two choices on the page itself (1-1). A shared link skips this.
  if (!started) {
    return (
      <main id="content" tabIndex={-1} className="body">
        <div className="main">
          <div className="empty">
            <h1 className="h2">Will a Moon lander have power and a line home?</h1>
            <p>
              Pick a landing site and a date. Moon Status shows when the Sun is up for power and when
              Earth is in view for contact.
            </p>
            <p className="choices">
              <button type="button" className="btn" onClick={() => start('Loaded the 2025 landing case')}>
                START WITH THE 2025 LANDING
              </button>{' '}
              <button
                type="button"
                className="btn2"
                onClick={() => {
                  focusList.current = true;
                  start();
                }}
              >
                CHOOSE MY OWN SITE
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }

  const sitesLoading = sitesStatus === 'loading';
  const down = failure ?? sitesFailure;
  const addBlocked = 'New coordinates cannot be added while NASA’s position service is not answering.';
  const add = (name: string, lat: number, lon: number) => {
    const id = addCustomSite(name, lat, lon);
    update({ site: id, t: 0 });
    say('Site added. Asking NASA for its positions.');
  };

  // Empty list (1-7).
  if (!sitesLoading && sites.length === 0) {
    return (
      <main id="content" tabIndex={-1} className="body">
        <div className="main">
          {down && <DownBanner message={down.message} retries={retries} onRetry={() => { retry(); reloadSites(); }} />}
          <div className="empty">
            <h1 className="h2">No sites yet</h1>
            <p>Add coordinates of your own, or load the starter list of past and planned landing sites.</p>
            <p className="choices">
              <button type="button" className="btn" onClick={reloadSites}>
                LOAD STARTER LIST
              </button>
            </p>
            <div className="side add-empty">
              <AddCoordinates disabledReason={down ? addBlocked : null} onAdd={add} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const selected = rows.find((r) => r.site.id === scenario.site) ?? rows[0];
  const groups = groupSites(rows, query);
  const ready = rows.filter((r) => r.landing?.word === 'READY').length;
  const busy = sitesLoading || loading;
  const overhead = selected?.now ? overheadLongitudes(selected.site.lat, selected.site.lon, selected.now) : undefined;

  const side = (
    <aside className="side" ref={listRef} aria-labelledby="sites-title">
      <h2 className="lbl" id="sites-title">
        01 / SITES · {busy ? '…' : `${ready} OF ${rows.length} READY`}
      </h2>
      {rows.length > SEARCH_FROM && (
        <div className="pad line site-search">
          <label className="fld">
            <span>FIND A SITE</span>
            <input
              type="search"
              value={query}
              autoComplete="off"
              aria-describedby="site-count"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="hint" id="site-count" aria-live="polite">
            {query.trim() ? `${groups.reduce((n, g) => n + g.rows.length, 0)} of ${rows.length} sites match` : `${rows.length} sites`}
          </span>
        </div>
      )}
      {groups.length === 0 && <p className="pad hint">No site matches “{query}”.</p>}
      {groups.map((g) => (
        <section key={g.title} className="site-group" aria-label={g.title}>
          <h3 className="lbl site-group-title">{g.title.toUpperCase()}</h3>
          {g.note && g.rows.length === 0 && <p className="pad hint line">{g.note}</p>}
          {g.rows.map((r) => {
            const isFetching = !busy && fetching.has(r.site.id);
            const refused = failures[r.site.id];
            const word = busy ? 'LOADING' : isFetching ? 'FETCHING' : (r.landing?.word ?? NO_DATA.word);
            const symbol = busy || isFetching ? '…' : (r.landing?.symbol ?? NO_DATA.symbol);
            return (
              <button
                key={r.site.id}
                type="button"
                className="row"
                aria-pressed={r.site.id === scenario.site}
                onClick={() => update({ site: r.site.id, t: 0 })}
              >
                <span aria-hidden="true" className={`sym ${r.landing?.word === 'READY' && !busy ? 'ok' : ''}`}>
                  {symbol}
                </span>
                <span className="grow">
                  <b>{r.site.name}</b>
                  <small>
                    {r.site.lat.toFixed(2)}, {r.site.lon.toFixed(2)} · {sourceLabel(r.site.source)}
                    {r.site.custom ? ' · yours' : ''}
                  </small>
                  {refused && !r.series && (refused.kind === 'rate' || refused.kind === 'bad') && (
                    <small className="row-err">▲ {refused.message}</small>
                  )}
                </span>
                <span className="mono word">{word}</span>
              </button>
            );
          })}
        </section>
      ))}
      {!busy && <AddCoordinates disabledReason={down ? addBlocked : null} onAdd={add} />}
    </aside>
  );

  // Loading (1-7): placeholder bars while positions are fetched.
  if (busy) {
    return (
      <main id="content" tabIndex={-1} className="body">
        <h1 className="sr">Console</h1>
        {side}
        <div className="main" aria-busy="true">
          <div className="lbl" role="status">
            ASKING NASA HORIZONS FOR SUN AND EARTH POSITIONS
          </div>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="sk" />
          ))}
        </div>
        <aside className="insp" aria-busy="true">
          <div className="lbl">04 / INSPECTOR</div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="sk" />
          ))}
        </aside>
      </main>
    );
  }

  return (
    <main id="content" tabIndex={-1} className="body">
      <h1 className="sr">Console</h1>
      {side}
      <div className="main">
        {down && <DownBanner message={down.message} retries={retries} onRetry={retry} />}
        {partial && !down && (
          <div className="ban" role="status">
            <span>Only part of these 30 days is saved, so some bars stop early.</span>
          </div>
        )}
        <PoleMap
          rows={rows}
          selectedId={selected?.site.id ?? ''}
          onSelect={(id) => update({ site: id, t: 0 })}
          overhead={overhead}
        />
        <Timeline
          rows={rows}
          selectedId={selected?.site.id ?? ''}
          t={scenario.t}
          playing={playing}
          onScrub={(t) => update({ t })}
          onPlay={() => {
            setPlaying((p) => !p);
            if (!playing && prefersReducedMotion()) say('Reduced motion is on: the marker jumps in 5-day steps.');
          }}
        />
        <Incidents
          rows={rows}
          landingIso={`${scenario.date}T${String(scenario.hour).padStart(2, '0')}:00:00Z`}
          onPick={(id, t) => update({ site: id, t: Math.min(DISPLAY_DAYS, Math.round(t * 2) / 2) })}
        />
      </div>
      <Tour ready={rows.length > 0} />
      {selected && (
        <Inspector
          row={selected}
          fetching={fetching.has(selected.site.id)}
          t={scenario.t}
          marginDeg={scenario.margin}
          search={search}
          csvHref={windowsCsvUrl(
            selected.site.aim?.base ?? selected.site.id,
            scenario.date,
            scenario.hour,
            DISPLAY_DAYS,
            scenario.margin,
            selected.site.aim,
          )}
        />
      )}
    </main>
  );
}

/** Service unavailable (1-7): a banner, saved results, and a Retry that stops after three tries. */
function DownBanner({ message, retries, onRetry }: { message: string; retries: number; onRetry: () => void }) {
  const spent = retries >= MAX_RETRIES;
  return (
    <div className="ban" role="status">
      <span>
        <b>▲ {message}</b> Showing results saved earlier, where there are any.
        {spent ? ' Retry limit reached. Reload the page to try again.' : ''}
      </span>
      <button type="button" className="btn2" disabled={spent} onClick={onRetry}>
        RETRY{retries > 0 ? ` (${Math.min(retries, MAX_RETRIES)} OF ${MAX_RETRIES})` : ''}
      </button>
    </div>
  );
}
