// 30-day power and contact timeline for every site. Bars are drawn straight from
// the calculator's windows (1-3); the white line is the time marker (1-4).
import { useState } from 'react';
import type { Window } from '@moon/core';
import { DISPLAY_DAYS, DISPLAY_HOURS } from '../siteData';
import type { SiteRow } from './types';

interface Props {
  rows: SiteRow[];
  selectedId: string;
  t: number;
  playing: boolean;
  onScrub: (t: number) => void;
  onPlay: () => void;
}

export function Track({ windows, landingMs, kind }: { windows: Window[]; landingMs: number; kind: 'power' | 'contact' }) {
  return (
    <span className={`track ${kind}`}>
      {windows.map((w) => {
        const left = ((Date.parse(w.start) - landingMs) / (DISPLAY_HOURS * 3_600_000)) * 100;
        const width = (w.hours / DISPLAY_HOURS) * 100;
        return <span key={w.start} className="seg" style={{ left: `${left}%`, width: `${width}%` }} />;
      })}
    </span>
  );
}

const sheetTime = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function Timeline({ rows, selectedId, t, playing, onScrub, onPlay }: Props) {
  const [asTable, setAsTable] = useState(false);
  const selected = rows.find((r) => r.site.id === selectedId);
  const windows = selected?.result
    ? [
        ...selected.result.power.windows.map((w) => ({ kind: 'Sunlight (power)', ...w })),
        ...selected.result.contact.windows.map((w) => ({ kind: 'Earth in view (contact)', ...w })),
      ]
    : [];

  return (
    <section className="tl" aria-labelledby="tl-title">
      <div className="lbl tl-head">
        <h2 id="tl-title">03 / TIMELINE · 30 D</h2>
        <span className="tl-keys" aria-hidden="true">
          <span className="key sun" /> SUN <span className="key earth" /> EARTH <span className="key out" /> OUT
        </span>
        <button type="button" className="tl-toggle" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          SHOW AS TABLE
        </button>
      </div>
      <div className="scrub">
        <button type="button" className="btn2" aria-pressed={playing} onClick={onPlay}>
          {playing ? '❚❚ PAUSE' : '▶ PLAY'}
        </button>
        <label className="sr" htmlFor="scrub">
          Days after landing
        </label>
        <input
          id="scrub"
          type="range"
          min={0}
          max={DISPLAY_DAYS}
          step={0.5}
          value={t}
          aria-valuetext={`${t.toFixed(1)} days after landing`}
          onChange={(e) => onScrub(Number(e.target.value))}
        />
        <span className="mono tplus">T+{t.toFixed(1)} d</span>
      </div>
      {rows.map((r) => {
        const landingMs = r.series?.sun[0] ? Date.parse(r.series.sun[0].time) : 0;
        const label = r.result
          ? `${r.short}: sunlight ${r.result.power.uptimePct} percent of the 30 days, Earth in view ${r.result.contact.uptimePct} percent`
          : `${r.short}: no saved positions`;
        return (
          <div key={r.site.id} className={`trk ${r.site.id === selectedId ? 'sel' : ''}`}>
            <span className="n">{r.short}</span>
            <span className="b" role="img" aria-label={label}>
              {r.result ? (
                <>
                  <Track windows={r.result.power.windows} landingMs={landingMs} kind="power" />
                  <Track windows={r.result.contact.windows} landingMs={landingMs} kind="contact" />
                </>
              ) : (
                <span className="nodata-track mono">NO SAVED POSITIONS</span>
              )}
              <span className="ph" style={{ left: `${(t / DISPLAY_DAYS) * 100}%` }} />
            </span>
            <span className="mono pct">
              {r.result ? `${r.result.power.uptimePct}% / ${r.result.contact.uptimePct}%` : '– / –'}
            </span>
          </div>
        );
      })}
      {asTable && selected && (
        <div className="tl-table">
          <table className="t">
            <caption>
              {selected.site.name}: windows in the 30 days after landing (
              {selected.result?.model === 'terrain' ? 'terrain model' : 'smooth-Moon model'}, times in UTC)
            </caption>
            <thead>
              <tr>
                <th scope="col">KIND</th>
                <th scope="col">START</th>
                <th scope="col">END</th>
                <th scope="col">LENGTH</th>
              </tr>
            </thead>
            <tbody>
              {windows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No windows: neither the Sun nor Earth is up in these 30 days, or no positions are saved.</td>
                </tr>
              ) : (
                windows.map((w) => (
                  <tr key={`${w.kind}${w.start}`}>
                    <td>{w.kind}</td>
                    <td className="mono">{sheetTime(w.start)}</td>
                    <td className="mono">{sheetTime(w.end)}</td>
                    <td className="mono">{w.hours} h</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
