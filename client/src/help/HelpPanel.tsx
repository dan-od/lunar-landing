// Help: a right-hand panel that explains the current tab in plain language:
// what it answers, how to use it in three steps, and what each number means.
// Escape or the close button closes it; focus returns to the Help button.
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../state';
import { TAB_HELP, TERMS } from './content';
import { useDialogFocus } from './useDialogFocus';

export function HelpPanel() {
  const { helpOpen, setHelpOpen, setTourOpen, search } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setHelpOpen(false);
  useDialogFocus(helpOpen, close, ref, {
    trap: true,
    returnTo: () => document.getElementById('help-open'),
  });

  if (!helpOpen) return null;
  const help = TAB_HELP[pathname] ?? TAB_HELP['/']!;

  const startTour = () => {
    setHelpOpen(false);
    if (pathname !== '/') navigate({ pathname: '/', search });
    // Let the Console render before the tour points at it.
    window.setTimeout(() => setTourOpen(true), 50);
  };

  return (
    <>
      <div className="scrim" onClick={close} />
      <div
        ref={ref}
        className="drawer help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        aria-describedby="help-answers"
        tabIndex={-1}
      >
        <div className="lbl drawer-head">
          <h2 id="help-title">HELP · {help.title.toUpperCase()}</h2>
          <button type="button" aria-label="Close help" data-autofocus onClick={close}>
            ✕
          </button>
        </div>
        <div className="help-body">
          <section className="pad line">
            <h3 className="help-h">What it answers</h3>
            <p id="help-answers">{help.answers}</p>
          </section>
          <section className="pad line">
            <h3 className="help-h">How to use it</h3>
            <ol className="help-steps">
              {help.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
          <section className="pad line">
            <h3 className="help-h">What the numbers mean</h3>
            <dl className="help-terms">
              {help.numbers.map((n) => (
                <div key={n.name}>
                  <dt>{n.name}</dt>
                  <dd>{n.meaning}</dd>
                </div>
              ))}
            </dl>
            {help.note && <p className="hint">{help.note}</p>}
          </section>
          <section className="pad line">
            <h3 className="help-h">Words used across the app</h3>
            <dl className="help-terms">
              {Object.values(TERMS).map((t) => (
                <div key={t.word}>
                  <dt>{t.word}</dt>
                  <dd>{t.text}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="pad help-actions">
            <button type="button" className="btn2" onClick={startTour}>
              SHOW THE CONSOLE TOUR
            </button>
            <button
              type="button"
              className="btn2"
              onClick={() => {
                setHelpOpen(false);
                navigate({ pathname: '/api', search, hash: '#right' });
                window.setTimeout(() => document.getElementById('right')?.focus(), 300);
              }}
            >
              HOW WE KNOW IT&apos;S RIGHT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
