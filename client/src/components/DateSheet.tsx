// Phone date bar (under 600 px): one line with the landing date and hour and a
// Now button. Tapping the date opens a sheet with the date field and calendar,
// the step buttons, and Slip: whether the chosen site is ready at the landing
// hour on each of the next 14 days, from /v1/slip (never guessed).
import { useEffect, useRef, useState } from 'react';
import { getSlip, type ApiFailure, type SlipReply } from '../api';
import { AIM_SITE_ID, shortName, useApp } from '../state';
import { isAllowedDate, nowUtc, shiftDate } from '../scenario';
import { useDialogFocus } from '../help/useDialogFocus';
import { Term } from '../help/Term';
import { barTime } from '../console/phoneBoard';
import { WhenFields, hh, RANGE_TEXT } from './WhenFields';
import { SLIPS } from './slips';

export function PhoneDateBar() {
  const { scenario, update, started, say } = useApp();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const now = () => {
    const next = nowUtc();
    if (!isAllowedDate(next.date)) {
      say(`Today is outside the allowed dates (${RANGE_TEXT}).`);
      return;
    }
    update({ ...next, t: 0 });
    say(`Landing set to now: ${next.date} ${hh(next.hour)} UTC`);
  };

  return (
    <div className="pdate" role="group" aria-label="Landing time">
      <button
        ref={opener}
        type="button"
        className="pdate-when mono"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!started}
        onClick={() => setOpen(true)}
      >
        <span className="sr">Landing </span>
        <b>{barTime(scenario.date, scenario.hour).split(' · ')[0]}</b>
        <span> · {hh(scenario.hour)} UTC</span>
        <span className="sr">. Change the landing time</span>
        <span aria-hidden="true" className="pdate-caret">
          ▾
        </span>
      </button>
      <button type="button" className="pdate-now" disabled={!started} onClick={now}>
        NOW<span className="sr">: set the landing to the current UTC date and hour</span>
      </button>
      {open && (
        <DateSheet
          onClose={() => {
            setOpen(false);
            // The sheet leaves the page on close, so focus is put back here.
            window.requestAnimationFrame(() => opener.current?.focus());
          }}
        />
      )}
    </div>
  );
}

function DateSheet({ onClose }: { onClose: () => void }) {
  const { scenario, update, sites, say } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, onClose, ref, { trap: true });
  const site = sites.find((s) => s.id === scenario.site);

  return (
    <>
      <div className="sheet-back" aria-hidden="true" onClick={onClose} />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1}>
        <div className="sheet-head">
          <h2 className="lbl" id="sheet-title" tabIndex={-1} data-autofocus>
            LANDING TIME (UTC)
          </h2>
          <button type="button" className="sheet-close" onClick={onClose}>
            CLOSE <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="pad line">
          <WhenFields
            label="Landing"
            date={scenario.date}
            hour={scenario.hour}
            onChange={(next) => update({ ...next, t: 0 })}
            onNow={(next) => say(`Landing set to now: ${next.date} ${hh(next.hour)} UTC`)}
          />
        </div>
        <h3 className="lbl">MOVE THE DATE</h3>
        <div className="sheet-steps line">
          {SLIPS.map((s) => (
            <button
              key={s.key}
              type="button"
              data-slip={s.key}
              onClick={() => update({ date: shiftDate(scenario.date, s.by), t: 0 })}
            >
              {s.text}
              <span className="sr">, {s.more}</span>
            </button>
          ))}
        </div>
        <SlipDays siteId={site?.id} siteName={site ? shortName(site) : ''} />
      </div>
    </>
  );
}

/** Ready or not at the landing hour if the landing slips 0 to 14 days. */
function SlipDays({ siteId, siteName }: { siteId?: string; siteName: string }) {
  const { scenario, update } = useApp();
  const [reply, setReply] = useState<{ key: string; data?: SlipReply; error?: string } | null>(null);
  const key = `${siteId}|${scenario.date}|${scenario.hour}|${scenario.margin}`;
  const usable = Boolean(siteId) && siteId !== AIM_SITE_ID;

  useEffect(() => {
    if (!usable || !siteId) return;
    const c = new AbortController();
    getSlip(siteId, scenario.date, scenario.hour, scenario.margin, c.signal)
      .then((data) => setReply({ key, data }))
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setReply({ key, error: (err as ApiFailure).message ?? 'The slip check failed.' });
      });
    return () => c.abort();
  }, [key, usable, siteId, scenario.date, scenario.hour, scenario.margin]);

  const current = reply?.key === key ? reply : null;
  const days = current?.data?.slips.filter((d) => d.slip_days >= 0 && d.slip_days <= 14) ?? [];
  const proof = current?.data?.slip_proof_0_to_14;

  return (
    <section aria-labelledby="slip-title">
      <h3 className="lbl" id="slip-title">
        SLIP · {siteName.toUpperCase()} <Term id="slip" />
      </h3>
      <div className="pad">
        {!usable ? (
          <p className="hint">Slip is worked out for listed sites and your own coordinates, not for an aim point.</p>
        ) : current?.error ? (
          <p className="hint">▲ {current.error}</p>
        ) : !current ? (
          <p className="hint" role="status">
            Checking the next 14 days…
          </p>
        ) : (
          <>
            <p className="slip-sum">
              {proof === true
                ? '● Slip-proof: ready at this hour on every day from 0 to 14 days late.'
                : proof === false
                  ? `▲ Not slip-proof: ready on ${days.filter((d) => d.ready).length} of these ${days.length} days.`
                  : 'Some of these days have no saved positions, so slip-proof is unknown.'}
            </p>
            <ul className="slip-days" aria-label="Landing state if the landing slips 0 to 14 days">
              {days.map((d) => (
                <li key={d.slip_days}>
                  <button
                    type="button"
                    className={d.ready ? 'ok' : ''}
                    aria-current={d.slip_days === 0 ? 'date' : undefined}
                    onClick={() => update({ date: d.date, t: 0 })}
                  >
                    <span className="mono">+{d.slip_days} d</span>
                    <span aria-hidden="true">{d.symbol ?? '–'}</span>
                    <span className="sr">
                      : {d.date}, {d.word ? d.word.toLowerCase() : 'no saved positions'}. Move the landing to this day.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">Smooth-Moon model, at {hh(scenario.hour)} UTC each day. Tap a day to land then.</p>
          </>
        )}
      </div>
    </section>
  );
}
