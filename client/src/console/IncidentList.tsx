// 05 / Next changes, all sites (1-12): sunrises, sunsets, Earth rises and Earth
// sets across every site, soonest first. Choosing one selects that site and moves
// the time marker to the change.
import { useState } from 'react';
import type { ChangeKind } from '@moon/core';
import { fmtDuration } from '../siteData';
import { incidents } from './incidents';
import type { SiteRow } from './types';

const MARK: Record<ChangeKind, { symbol: string; cls: string }> = {
  sunrise: { symbol: '▲', cls: 'c-sun' },
  sunset: { symbol: '▼', cls: 'c-sun' },
  earthrise: { symbol: '▲', cls: 'c-earth' },
  earthset: { symbol: '▼', cls: 'c-earth' },
};
const SHOWN = 6;

export function Incidents({
  rows,
  landingIso,
  onPick,
}: {
  rows: SiteRow[];
  landingIso: string;
  onPick: (siteId: string, tDays: number) => void;
}) {
  const [all, setAll] = useState(false);
  const list = incidents(rows, landingIso);
  const shown = all ? list : list.slice(0, SHOWN);
  return (
    <section className="incidents" aria-labelledby="inc-title">
      <div className="lbl tl-head">
        <h2 id="inc-title">05 / NEXT CHANGES · ALL SITES · SOONEST FIRST</h2>
        {list.length > SHOWN && (
          <button type="button" className="tl-toggle" aria-expanded={all} onClick={() => setAll((a) => !a)}>
            {all ? 'SHOW FEWER' : `SHOW ALL ${list.length}`}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="pad hint">No site changes in the 30 days after landing.</p>
      ) : (
        <ol className="inc-list">
          {shown.map((c) => (
            <li key={`${c.site.id}-${c.kind}-${c.time}`}>
              <button type="button" className="row inc-row" onClick={() => onPick(c.site.id, c.hoursAfterLanding / 24)}>
                <span className="mono inc-t">T+{fmtDuration(c.hoursAfterLanding)}</span>
                <span className="grow">
                  <span aria-hidden="true" className={MARK[c.kind].cls}>
                    {MARK[c.kind].symbol}{' '}
                  </span>
                  <b>{c.label}</b> at {c.short}
                </span>
                <span className="mono hint">{c.time.slice(0, 16).replace('T', ' ')} UTC</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
