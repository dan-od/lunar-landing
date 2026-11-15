// Flow 5, second part: be emailed when a rule breaks. Shown only when the
// server has email alerts switched on. Nothing is sent until the address owner
// confirms (5-2); every email has a one-click unsubscribe that deletes the
// address. The privacy line sits above the Start button (P-1).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { useDialogFocus } from '../help/useDialogFocus';
import { createWatch, deleteWatch, resendWatch, WatchFailure, type WatchSummary } from './watchApi';
import { useWatches, watchTarget } from './WatchesProvider';

const STATUS: Record<WatchSummary['status'], { text: string; cls: string }> = {
  pending: { text: '… WAITING FOR CONFIRMATION', cls: 'wait' },
  active: { text: '● HOLDING', cls: 'ok' },
  tripped: { text: '▲ TRIPPED', cls: '' },
  expired: { text: '✕ LINK EXPIRED', cls: '' },
};

/** The sign-up form, for the side pane of the Watch tab. */
export function EmailWatchForm() {
  const { scenario, sites, say } = useApp();
  const { config, remember, refresh } = useWatches();
  const site = sites.find((s) => s.id === scenario.site);
  const target = watchTarget(site, scenario);
  // An aim carried from Miss pre-selects "odds too low" (contract 4 → 5).
  const [rule, setRule] = useState(site?.aim ? 'odds70' : 'power');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const ruleRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (site?.aim) setRule('odds70');
  }, [site?.aim]);

  if (!config?.email_enabled) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError({ field: 'email', message: 'That email address does not look complete.' });
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const w = await createWatch({ site: target.site, ...target.scenario, rule, email: trimmed });
      remember(w.id, w.manage_token);
      setEmail('');
      setError(null);
      say(`Check ${w.address_masked} for a confirmation link. Nothing is sent until you confirm.`);
      await refresh();
    } catch (err) {
      const f = err instanceof WatchFailure ? err : new WatchFailure('The watch could not be started.', undefined, 0);
      if (f.watch) {
        // Saved, but the confirmation email was not sent: keep it so "Send a new link" is offered.
        remember(f.watch.id, f.watch.manage_token);
        await refresh();
      }
      const field = f.field === 'rule' ? 'rule' : 'email';
      setError({ field, message: f.message });
      (field === 'rule' ? ruleRef : emailRef).current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="email-title">
      <h2 className="lbl" id="email-title">
        03 / OR BE EMAILED IF IT STOPS WORKING
      </h2>
      {!target ? (
        <p className="pad hint">
          Email alerts work for the listed sites and the Miss aim point, not for your own coordinates.
        </p>
      ) : (
        <form className="pad line" noValidate onSubmit={submit} aria-label="Start an email watch">
          {error?.field === 'rule' && (
            <p className="err" role="alert" id="watch-rule-err">
              {error.message}
            </p>
          )}
          <label className="fld">
            <span>TELL ME WHEN</span>
            <select
              ref={ruleRef}
              value={rule}
              aria-invalid={error?.field === 'rule' ? true : undefined}
              aria-describedby={error?.field === 'rule' ? 'watch-rule-err' : undefined}
              onChange={(e) => setRule(e.target.value)}
            >
              {config.rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {error?.field === 'email' && (
            <p className="err" role="alert" id="watch-email-err">
              {error.message}
            </p>
          )}
          <label className="fld">
            <span>SEND TO (EMAIL)</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              aria-invalid={error?.field === 'email' ? true : undefined}
              aria-describedby={error?.field === 'email' ? 'watch-email-err watch-privacy' : 'watch-privacy'}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <p className="hint" id="watch-privacy">
            {config.privacy} A watch starts only after you open the link we email you, so nobody can sign
            up someone else.
          </p>
          <button type="submit" className="btn watch-all" disabled={busy}>
            {busy ? 'STARTING…' : 'START WATCH'}
          </button>
        </form>
      )}
    </section>
  );
}

/** This browser's email watches, with their event log. */
export function EmailWatchList() {
  const { say } = useApp();
  const { config, watches, tokenFor, forget, replace } = useWatches();
  const [asking, setAsking] = useState<WatchSummary | null>(null);
  if (!config?.email_enabled || watches.length === 0) return null;

  const resend = async (w: WatchSummary) => {
    const token = tokenFor(w.id);
    if (!token) return;
    try {
      replace(await resendWatch(w.id, token));
      say(`A new confirmation link was sent to ${w.address_masked}.`);
    } catch (err) {
      say(err instanceof WatchFailure ? err.message : 'A new link could not be sent.');
    }
  };

  return (
    <section aria-labelledby="mine-title">
      <h2 className="lbl" id="mine-title" tabIndex={-1}>
        04 / YOUR EMAIL WATCHES · {watches.filter((w) => w.status === 'active' || w.status === 'tripped').length} ACTIVE
      </h2>
      {watches.map((w) => (
        <div key={w.id} className="pad line watch-item">
          <div className="watch-item-head">
            <b>{w.site_name}</b>
            <span className={`tag ${STATUS[w.status].cls}`}>{STATUS[w.status].text}</span>
          </div>
          <div>
            Tell me when: {w.rule_label.toLowerCase()} · landing {w.scenario.date} {String(w.scenario.hour).padStart(2, '0')}:00
            UTC · {w.model} model
          </div>
          <div className="mono hint">{w.address_masked}</div>
          {w.status === 'pending' && (
            <p className="hint">Open the link in the confirmation email to start this watch. It works for 24 hours.</p>
          )}
          {w.status === 'expired' && (
            <p className="hint">The confirmation link was not used in time, so no alerts will be sent.</p>
          )}
          {w.events.length > 0 && (
            <div className="tl-table">
              <table className="t">
                <caption className="sr">What happened to this watch</caption>
                <thead>
                  <tr>
                    <th scope="col">TIME (UTC)</th>
                    <th scope="col">LEVEL</th>
                    <th scope="col">WHAT HAPPENED</th>
                  </tr>
                </thead>
                <tbody>
                  {w.events.map((e, i) => (
                    <tr key={`${e.time}-${i}`}>
                      <td className="mono">{e.time.slice(0, 16).replace('T', ' ')}</td>
                      <td className="mono">{e.level}</td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="watch-actions">
            {(w.status === 'pending' || w.status === 'expired') && (
              <button type="button" className="btn2" onClick={() => void resend(w)}>
                SEND A NEW LINK
              </button>
            )}
            <button type="button" className="btn2" id={`del-${w.id}`} onClick={() => setAsking(w)}>
              DELETE WATCH
            </button>
          </div>
        </div>
      ))}
      <DeleteDialog
        watch={asking}
        onKeep={() => setAsking(null)}
        onDelete={async () => {
          const w = asking!;
          const token = tokenFor(w.id);
          setAsking(null);
          if (!token) return;
          try {
            await deleteWatch(w.id, token);
            forget(w.id);
            say('Watch deleted, with its address and log.');
            (document.getElementById('mine-title') ?? document.getElementById('keep-title'))?.focus();
          } catch (err) {
            say(err instanceof WatchFailure ? err.message : 'The watch could not be deleted.');
          }
        }}
      />
    </section>
  );
}

/** A small dialog for deleting a watch, with focus on the safe choice (flow 5, step 7). */
function DeleteDialog({ watch, onKeep, onDelete }: { watch: WatchSummary | null; onKeep: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const open = watch !== null;
  const opener = useRef<string | null>(null);
  if (watch) opener.current = `del-${watch.id}`;
  useDialogFocus(open, onKeep, ref, { trap: true, returnTo: () => (opener.current ? document.getElementById(opener.current) : null) });
  if (!watch) return null;
  return (
    <>
      <div className="scrim" />
      <div ref={ref} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-text">
        <div className="pad">
          <h2 id="del-title" className="h2 site-name">
            Delete this watch?
          </h2>
          <p id="del-text">
            Alerts for {watch.site_name} will stop, and the address and log are deleted. This cannot be undone.
          </p>
        </div>
        <div className="grid2 modal-actions">
          <button type="button" data-autofocus onClick={onKeep}>
            KEEP IT
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            DELETE
          </button>
        </div>
      </div>
    </>
  );
}
