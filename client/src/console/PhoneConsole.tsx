// Phone Console (under 600 px), direction B: a status board. Filter chips with
// counts, a Board | Map switch, two-column tiles grouped by region, each with
// its status symbol and word and a 30-day strip. Tapping a tile or a map marker
// opens the site card (direction A); Back returns to the board where it was.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DISPLAY_HOURS } from '../siteData';
import { Track } from './Timeline';
import { PoleMap } from './PoleMap';
import { SiteCard } from './SiteCard';
import { AddCoordinates } from './AddCoordinates';
import { Incidents } from './IncidentList';
import { groupSites } from './siteGroups';
import { FILTERS, filterCounts, matchesFilter, readyPct, readyWindows, stepSite, type FilterKey } from './phoneBoard';
import { NO_DATA, type SiteRow } from './types';

interface Props {
  rows: SiteRow[];
  busy: boolean;
  fetching: Set<string>;
  selectedId: string;
  banner: React.ReactNode;
  onSelect: (id: string) => void;
  t: number;
  marginDeg: number;
  playing: boolean;
  onPlay: () => void;
  onScrub: (t: number) => void;
  csvHref: string;
  landingIso: string;
  onPickChange: (id: string, t: number) => void;
  addBlocked: string | null;
  onAdd: (name: string, lat: number, lon: number) => void;
}

type View = 'board' | 'map';

export function PhoneConsole(props: Props) {
  const { rows, busy, fetching, selectedId, banner, onSelect } = props;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [view, setView] = useState<View>('board');
  const [card, setCard] = useState(false);
  const scrollY = useRef(0);
  const restore = useRef<string | null>(null);

  const counts = filterCounts(rows);
  const shown = rows.filter((r) => matchesFilter(r, filter));
  const groups = groupSites(shown, '');
  const order = groups.flatMap((g) => g.rows.map((r) => r.site.id));
  const filterInfo = FILTERS.find((f) => f.key === filter)!;

  const open = (id: string) => {
    if (!card) scrollY.current = window.scrollY;
    onSelect(id);
    setCard(true);
    if (!card) window.scrollTo(0, 0);
  };
  const back = () => {
    restore.current = selectedId;
    setCard(false);
  };

  // Back: the board comes back where it was, and focus goes to the site's tile or marker.
  useLayoutEffect(() => {
    if (card || restore.current === null) return;
    const id = restore.current;
    restore.current = null;
    window.scrollTo(0, scrollY.current);
    const el = document.querySelector<HTMLElement>(`[data-site="${CSS.escape(id)}"]`) ?? document.getElementById('board-title');
    el?.focus({ preventScroll: true });
    if (el && typeof el.scrollIntoView === 'function') {
      const box = el.getBoundingClientRect();
      if (box.top < 0 || box.bottom > window.innerHeight - 60) el.scrollIntoView({ block: 'center' });
    }
  }, [card]);

  const row = rows.find((r) => r.site.id === selectedId);
  if (card && row) {
    const i = order.indexOf(row.site.id);
    const group = groups.find((g) => g.rows.some((r) => r.site.id === row.site.id))?.title ?? '';
    const position =
      i < 0
        ? group.toUpperCase()
        : `${group.toUpperCase()} · ${i + 1} OF ${order.length}${filter === 'all' ? '' : ` ${filterInfo.label.toUpperCase()}`}`;
    return (
      <main id="content" tabIndex={-1} className="pbody">
        <h1 className="sr">Console: {row.site.name}</h1>
        {banner}
        <SiteCard
          row={row}
          rows={rows}
          position={position}
          prevId={i < 0 ? undefined : stepSite(order, row.site.id, -1)}
          nextId={i < 0 ? undefined : stepSite(order, row.site.id, 1)}
          onOpen={open}
          onBack={back}
          fetching={fetching.has(row.site.id)}
          t={props.t}
          marginDeg={props.marginDeg}
          playing={props.playing}
          onPlay={props.onPlay}
          onScrub={props.onScrub}
          csvHref={props.csvHref}
        />
      </main>
    );
  }

  const tabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next: View = e.key === 'Home' ? 'board' : e.key === 'End' ? 'map' : view === 'board' ? 'map' : 'board';
    setView(next);
    document.getElementById(`view-${next}`)?.focus();
  };

  return (
    <main id="content" tabIndex={-1} className="pbody">
      <h1 className="sr">Console</h1>
      {banner}
      <div className="pboard-head">
        <h2 className="mono" id="board-title" tabIndex={-1}>
          01 / STATUS BOARD
        </h2>
        <span className="mono">{busy ? '…' : `${counts.ready} OF ${counts.all} READY`}</span>
      </div>

      <div className="chips" role="group" aria-label="Show sites by state at landing">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="chip"
            aria-pressed={filter === f.key}
            disabled={busy}
            onClick={() => setFilter(f.key)}
          >
            {f.symbol && <span aria-hidden="true">{f.symbol} </span>}
            {f.label.toUpperCase()} <span className="chip-n">{busy ? '…' : counts[f.key]}</span>
            <span className="sr"> sites</span>
          </button>
        ))}
      </div>

      <div className="pswitch" role="tablist" aria-label="View">
        {(['board', 'map'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            id={`view-${v}`}
            aria-selected={view === v}
            aria-controls={`panel-${v}`}
            tabIndex={view === v ? 0 : -1}
            onClick={() => setView(v)}
            onKeyDown={tabKey}
          >
            {v === 'board' ? 'BOARD' : 'MAP'}
          </button>
        ))}
      </div>

      {filter !== 'all' && (
        <p className="pfilter-note" role="status">
          Showing {shown.length} {filterInfo.label.toLowerCase()} {shown.length === 1 ? 'site' : 'sites'} · tap one to open it{' '}
          <button type="button" className="inline-btn" onClick={() => setFilter('all')}>
            SHOW ALL
          </button>
        </p>
      )}

      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`view-${view}`} className="ppanel">
        {view === 'board' ? (
          <>
            {busy ? (
              <div className="tiles" aria-busy="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="tile sk" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <p className="pad">No site is {filterInfo.label.toLowerCase()} at this landing time.</p>
            ) : (
              groups.map((g) => (
                <section key={g.title} className="tgroup" aria-labelledby={`tg-${g.title.replace(/\W/g, '')}`}>
                  <h3 className="mono tgroup-title" id={`tg-${g.title.replace(/\W/g, '')}`}>
                    {g.title.toUpperCase()}
                  </h3>
                  <div className="tiles">
                    {g.rows.map((r) => (
                      <Tile key={r.site.id} row={r} fetching={fetching.has(r.site.id)} onOpen={open} />
                    ))}
                  </div>
                </section>
              ))
            )}
            {!busy && (
              <>
                <Incidents rows={rows} landingIso={props.landingIso} onPick={(id, t) => {
                    scrollY.current = window.scrollY;
                    props.onPickChange(id, t);
                    setCard(true);
                    window.scrollTo(0, 0);
                  }} />
                <div className="padd">
                  <AddCoordinates disabledReason={props.addBlocked} onAdd={props.onAdd} />
                </div>
              </>
            )}
          </>
        ) : (
          <PoleMap
            rows={rows}
            selectedId={selectedId}
            onSelect={open}
            visible={(r) => matchesFilter(r, filter)}
            statusMarkers
            caption="SOUTH POLE · POLAR VIEW"
            offMapNote={(n) => (
              <p className="pmapnote">
                {n} {n === 1 ? 'site is' : 'sites are'} north of this map.{' '}
                <button type="button" className="btn2" onClick={() => setView('board')}>
                  SEE THEM ON THE BOARD
                </button>
              </p>
            )}
          />
        )}
      </div>
    </main>
  );
}

function Tile({ row, fetching, onOpen }: { row: SiteRow; fetching: boolean; onOpen: (id: string) => void }) {
  const s = row.landing;
  const ready = s?.word === 'READY';
  const landingMs = row.series?.sun[0] ? Date.parse(row.series.sun[0].time) : 0;
  const word = s ? s.word : fetching ? 'FETCHING' : NO_DATA.word;
  return (
    <button type="button" className={`tile ${ready ? 'ok' : ''}`} data-site={row.site.id} onClick={() => onOpen(row.site.id)}>
      <b className="tile-name">{row.site.name}</b>
      <span className="mono tile-st">
        <span aria-hidden="true">{s ? s.symbol : fetching ? '…' : NO_DATA.symbol} </span>
        {word}
      </span>
      {row.result ? (
        <>
          <span className="sr">, ready {readyPct(row.result, DISPLAY_HOURS)} percent of the next 30 days</span>
          <span className="tile-strip" aria-hidden="true">
            <Track windows={readyWindows(row.result)} landingMs={landingMs} kind="power" />
          </span>
        </>
      ) : (
        <span className="tile-strip none" aria-hidden="true" />
      )}
    </button>
  );
}
