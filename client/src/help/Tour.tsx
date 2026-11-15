// First-visit tour of the Console: four short steps, each pointing at one part
// of the page. Skip closes it for now; "Don't show again" is remembered in this
// browser. Help can start it again. It does not block the page, so the part it
// points at stays visible and usable. Nothing moves when reduced motion is on.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../state';
import { TOUR, TOUR_KEY } from './content';
import { prefersReducedMotion, useDialogFocus } from './useDialogFocus';
import { usePhone } from '../usePhone';

function remembered(): boolean {
  try {
    return window.localStorage.getItem(TOUR_KEY) === 'off';
  } catch {
    return false;
  }
}

/** Shown once per visit unless turned off; the session flag stops it reopening on every tab change. */
const SEEN_KEY = 'moon:tour-seen';
function seenThisVisit(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function Tour({ ready }: { ready: boolean }) {
  const { tourOpen, setTourOpen } = useApp();
  const { pathname } = useLocation();
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // First visit: open once the Console has its sites on screen.
  useEffect(() => {
    if (ready && pathname === '/' && !remembered() && !seenThisVisit()) {
      setStep(0);
      setTourOpen(true);
    }
  }, [ready, pathname, setTourOpen]);

  useEffect(() => {
    if (tourOpen) setStep(0);
  }, [tourOpen]);

  const close = () => {
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
      if (dontShow) window.localStorage.setItem(TOUR_KEY, 'off');
    } catch {
      // Storage blocked: the tour may show again next visit.
    }
    setTourOpen(false);
  };
  useDialogFocus(tourOpen && pathname === '/', close, ref, {
    returnTo: () => document.getElementById('help-open') ?? document.getElementById('content'),
  });

  // Point at the current step's part of the page.
  const phone = usePhone();
  const step0 = TOUR[step]!;
  const current = phone ? { ...step0, ...step0.phone } : step0;
  useEffect(() => {
    if (!tourOpen) return;
    const el = document.querySelector<HTMLElement>(current.target);
    const box = el?.closest<HTMLElement>('aside, section, .scn-when, .tl') ?? el;
    if (!box) return;
    box.classList.add('tour-on');
    box.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    return () => box.classList.remove('tour-on');
  }, [tourOpen, current.target]);

  if (!tourOpen || pathname !== '/') return null;
  const last = step === TOUR.length - 1;

  return (
    <div ref={ref} className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-text" tabIndex={-1}>
      <div className="mono tour-count">
        STEP {step + 1} OF {TOUR.length}
      </div>
      <h2 className="tour-title" id="tour-title" tabIndex={-1} data-autofocus>
        {current.title}
      </h2>
      <p id="tour-text">{current.text}</p>
      <div className="sr" aria-live="polite">
        Step {step + 1} of {TOUR.length}: {current.title}. {current.text}
      </div>
      <label className="tour-check">
        <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
        <span>Don’t show again</span>
      </label>
      <div className="tour-actions">
        <button type="button" className="btn2" onClick={close}>
          SKIP
        </button>
        <span className="tour-nav">
          {step > 0 && (
            <button type="button" className="btn2" onClick={() => setStep((s) => s - 1)}>
              BACK
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => (last ? close() : setStep((s) => s + 1))}
          >
            {last ? 'DONE' : 'NEXT'}
          </button>
        </span>
      </div>
    </div>
  );
}
