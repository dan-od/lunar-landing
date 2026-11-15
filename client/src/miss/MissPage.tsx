// Flow 4: test a missed landing. A round terrain map on the left, odds on the
// right. Only prepared terrain is shown; a site without it gets an explanation
// and two exits. Behaviour and wording follow the flow prototype.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MAX_AIM_DISTANCE,
  aimText,
  clampAim,
  outOfTen,
  ringOdds,
  safestAim,
  type Aim,
  type GridPoint,
} from '@moon/core';
import { ApiFailure, getMiss } from '../api';
import { AIM_SITE_ID, shortName, useApp } from '../state';
import { MissMap } from './MissMap';
import { Term } from '../help/Term';
import { tabFor } from '../tabs';
import { usePageMeta } from '../meta';

const TAB = tabFor('/miss')!;

const KINDS: Array<{ radius: number; name: string }> = [
  { radius: 100, name: 'A very accurate lander' },
  { radius: 250, name: 'A lander like the 2025 one' },
  { radius: 320, name: 'A less accurate lander' },
];

interface Terrain {
  key: string;
  stepM: number;
  halfM: number;
  grid: GridPoint[];
}

export function MissPage() {
  const { scenario, update, started, start, sites, terrainSite, sitesStatus, search, say } = useApp();
  const navigate = useNavigate();
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: ApiFailure } | null>(null);
  const [announce, setAnnounce] = useState('');
  const moved = useRef(false);

  usePageMeta(TAB.title, TAB.description, TAB.path);
  useEffect(() => {
    if (!started) start();
  }, [started, start]);

  // The place being tested: a site with terrain, or the aim point that belongs to one.
  const selected = sites.find((s) => s.id === scenario.site);
  const site = selected?.aim ? terrainSite : selected;
  const hasTerrain = Boolean(site?.has_terrain);
  const key = site ? `${site.id}|${scenario.date}|${scenario.hour}` : '';

  useEffect(() => {
    if (!started || !site || !hasTerrain) return;
    const controller = new AbortController();
    getMiss(site.id, scenario.date, scenario.hour, controller.signal)
      .then((reply) => {
        setTerrain({
          key,
          stepM: reply.grid.step_m,
          halfM: reply.grid.half_m,
          grid: reply.grid.points.map(([east, north, works]) => ({ east, north, works: works === 1 })),
        });
        setFailure(null);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setFailure({
          key,
          error: err instanceof ApiFailure ? err : new ApiFailure('network', 'The request failed.'),
        });
      });
    return () => controller.abort();
    // `key` stands for the site, date and hour.
  }, [key, started, hasTerrain, site, scenario.date, scenario.hour]);

  const current = terrain && terrain.key === key ? terrain : null;
  const error = failure && failure.key === key ? failure.error : null;
  const aim = scenario.aim;

  const odds = useMemo(
    () =>
      current
        ? KINDS.map((k) => ({ ...k, ...ringOdds(current.grid, aim, k.radius, current.stepM) }))
        : [],
    [current, aim],
  );
  const chosen = odds.find((o) => o.radius === scenario.accuracy) ?? odds[1];
  const best = useMemo(
    () => (current ? safestAim(current.grid, scenario.accuracy, current.stepM) : null),
    [current, scenario.accuracy],
  );

  // Announce the result of each aim move without moving focus.
  useEffect(() => {
    if (!moved.current || !chosen) return;
    moved.current = false;
    setAnnounce(
      `Aim ${aimText(aim)}. ${outOfTen(chosen.share)} out of 10 landings would work for a lander that lands within ${chosen.radius} metres.`,
    );
  }, [aim, chosen]);

  const moveAim = (next: Aim) => {
    if (!current) return;
    const snapped = clampAim(next, current.stepM, Math.min(MAX_AIM_DISTANCE, current.halfM));
    moved.current = true;
    update({ aim: snapped });
  };

  if (sitesStatus === 'loading' || !started) {
    return (
      <main id="content" tabIndex={-1} className="body" aria-busy="true">
        <h1 className="sr">What if we miss?</h1>
        <div className="main">
          <div className="lbl" role="status">
            LOADING THE SITE LIST
          </div>
        </div>
      </main>
    );
  }

  // No terrain for this site (4-7): say what is missing and offer two exits.
  if (!site || !hasTerrain || error?.kind === 'no-terrain') {
    return (
      <main id="content" tabIndex={-1} className="body">
        <div className="main">
          <div className="empty">
            <h1 className="h2">No terrain prepared for this site yet</h1>
            <p>
              The Miss view needs an elevation map around the target so hills and crater shadows can
              be counted.{' '}
              {terrainSite
                ? `It is ready for the ${shortName(terrainSite)} target only.`
                : 'No site has terrain prepared yet.'}
            </p>
            {site && (
              <p className="hint">
                {site.name} has no prepared terrain, so no odds are shown for it. Nothing is estimated.
              </p>
            )}
            <p className="choices">
              {terrainSite && (
                <button type="button" className="btn" onClick={() => update({ site: terrainSite.id, t: 0 })}>
                  SWITCH TO {shortName(terrainSite).toUpperCase()} TARGET
                </button>
              )}{' '}
              <Link className="btn2 as-button" to={{ pathname: '/', search }}>
                BACK TO CONSOLE
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="content" tabIndex={-1} className="body">
        <h1 className="sr">What if we miss?</h1>
        <div className="main">
          <div className="ban" role="status">
            <span>
              <b>▲ {error.message}</b> The terrain map cannot be shown until positions load.
            </span>
          </div>
        </div>
      </main>
    );
  }

  if (!current || !chosen || !best) {
    return (
      <main id="content" tabIndex={-1} className="body" aria-busy="true">
        <h1 className="sr">What if we miss?</h1>
        <div className="main">
          <div className="lbl" role="status">
            WORKING OUT WHICH GROUND IS IN SHADOW
          </div>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="sk" />
          ))}
        </div>
      </main>
    );
  }

  const onTarget = aim.east === 0 && aim.north === 0;
  const safer = best.share > chosen.share + 0.04;
  const view = (current.halfM * 2 + current.stepM) / 1000;
  const nudges: Array<{ de: number; dn: number; arrow: string; word: string }> = [
    { de: -current.stepM, dn: 0, arrow: '◀', word: 'west' },
    { de: 0, dn: current.stepM, arrow: '▲', word: 'north' },
    { de: 0, dn: -current.stepM, arrow: '▼', word: 'south' },
    { de: current.stepM, dn: 0, arrow: '▶', word: 'east' },
  ];

  const carry = (to: 'console' | 'compare') => {
    if (to === 'console') {
      update({ site: onTarget ? site.id : AIM_SITE_ID, t: 0 });
      say(onTarget ? 'The aim is on the target, so the Console shows the target.' : 'Aim carried to the Console');
      navigate({ pathname: '/', search: window.location.search });
    } else {
      update({ site: site.id, setup: 'aim', b: null, t: 0 });
      say('Aim carried to Compare');
      navigate({ pathname: '/compare', search: window.location.search });
    }
  };

  return (
    <main id="content" tabIndex={-1} className="body">
      <h1 className="sr">What if we miss?</h1>
      <div className="main">
        <section className="mapwrap miss-wrap" aria-labelledby="miss-title">
          <h2 className="cap" id="miss-title">
            WHERE SHOULD WE AIM? · {shortName(site).toUpperCase()} · REAL TERRAIN
          </h2>
          <div className="miss-intro">
            <div className="h2">
              Landers never hit the exact spot <Term id="miss" />
            </div>
            <p>
              Light ground works. Dark ground is in shadow.{' '}
              <span className="c-sun">Click the map to move the aim.</span>
            </p>
          </div>
          <MissMap
            grid={current.grid}
            stepM={current.stepM}
            halfM={current.halfM}
            aim={aim}
            accuracy={scenario.accuracy}
            onAim={moveAim}
          />
          <p className="mono miss-caption">
            THE VIEW IS {view.toFixed(2)} KM ACROSS · NORTH IS UP · THE SOLID RING IS YOUR LANDING ACCURACY (
            {scenario.accuracy} M)
          </p>
        </section>
      </div>

      <aside className="insp" aria-labelledby="aim-title">
        <h2 className="lbl" id="aim-title">
          IF WE AIM HERE
        </h2>
        <p className="pad line miss-aim">
          {onTarget ? 'You are aiming at the original target.' : `You are aiming ${aimText(aim)}.`}
        </p>

        {odds.map((o) => {
          const n = outOfTen(o.share);
          const mine = o.radius === scenario.accuracy;
          return (
            <div key={o.radius} className={`pad line miss-row ${mine ? 'mine' : ''}`}>
              <div className="miss-kind">{o.name}</div>
              <div className="hint">
                Lands within {o.radius} m of where it aims{mine ? ' · chosen in Settings' : ''}
                {mine && <Term id="accuracy" />}
              </div>
              <div className="miss-odds">
                <span className="miss-n">{n}</span> out of 10 landings would work
              </div>
              <div className="bar" role="img" aria-label={`${n} out of 10`}>
                <div style={{ width: `${Math.round(o.share * 100)}%` }} />
              </div>
              {o.coverage < 1 && (
                <div className="hint miss-cover">
                  ▲ Part of this ring is outside the prepared terrain. This counts only the{' '}
                  {Math.round(o.coverage * 100)}% of it that is prepared.
                </div>
              )}
            </div>
          );
        })}

        <p className="pad line miss-aim">
          {safer
            ? `There is a safer place to aim: ${aimText(best)}. There, ${outOfTen(best.share)} out of 10 landings would work.`
            : 'This is the safest place to aim that keeps the whole ring inside the prepared terrain.'}
        </p>

        <div className="grid2 line">
          <button type="button" className="btn" onClick={() => moveAim(best)}>
            MOVE TO THE SAFEST SPOT
          </button>
          <button type="button" className="miss-plain" onClick={() => moveAim({ east: 0, north: 0 })}>
            BACK TO THE TARGET
          </button>
        </div>

        <h3 className="lbl">NUDGE THE AIM · {current.stepM} M PER TAP</h3>
        <div className="miss-nudge line">
          {nudges.map((d) => (
            <button
              key={d.word}
              type="button"
              data-nudge={d.word}
              onClick={() => moveAim({ east: aim.east + d.de, north: aim.north + d.dn })}
            >
              <span aria-hidden="true">{d.arrow}</span>
              <span className="sr">
                Move aim {current.stepM} metres {d.word}
              </span>
            </button>
          ))}
        </div>

        <h3 className="lbl">USE THIS AIM IN ANOTHER TAB</h3>
        <button type="button" className="row" onClick={() => carry('console')}>
          <span className="grow miss-use">SEE ITS NEXT 30 DAYS</span>
          <span className="mono hint">Console →</span>
        </button>
        <button type="button" className="row" onClick={() => carry('compare')}>
          <span className="grow miss-use">COMPARE IT WITH THE TARGET</span>
          <span className="mono hint">Compare →</span>
        </button>
        <Link className="row as-row" to={{ pathname: '/watch', search }}>
          <span className="grow miss-use">ALERT ME IF IT STOPS WORKING</span>
          <span className="mono hint">Watch →</span>
        </Link>

        <p className="pad hint">
          Terrain model. A landing works when the Sun and Earth clear the terrain at touchdown and
          for at least 90% of the first 10 days. Terrain is from the LOLA south pole elevation map
          (80 m per pixel) on a {current.stepM} m grid out to {current.halfM} m from the target;
          craters smaller than that are not seen.
        </p>
      </aside>

      <div className="sr" aria-live="polite">
        {announce}
      </div>
    </main>
  );
}
