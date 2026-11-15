// Settings: a right drawer, so the timeline stays visible and changes behind it.
// Escape or the scrim closes it and focus returns to the control that opened it.
import { useEffect, useRef } from 'react';
import { useApp } from '../state';
import { ACCURACIES } from '../scenario';

export function SettingsDrawer() {
  const { scenario, update, drawerOpen, setDrawerOpen } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (drawerOpen) {
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      document.getElementById('settings-open')?.focus();
    }
    wasOpen.current = drawerOpen;
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
      if (e.key !== 'Tab') return;
      // Keep Tab inside the drawer while it is open.
      const items = drawerRef.current?.querySelectorAll<HTMLElement>('button, input, select, a[href]');
      if (!items || items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <>
      <div className="scrim" onClick={() => setDrawerOpen(false)} />
      <div ref={drawerRef} className="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="lbl drawer-head">
          <h2 id="settings-title">SETTINGS</h2>
          <button ref={closeRef} type="button" aria-label="Close settings" onClick={() => setDrawerOpen(false)}>
            ✕
          </button>
        </div>
        <div className="pad">
          <label className="fld">
            <span>SHADOW ALLOWANCE (MARGIN): {scenario.margin.toFixed(1)}°</span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={scenario.margin}
              onChange={(e) => update({ margin: Number(e.target.value) })}
            />
          </label>
          <p className="hint">
            The Sun or Earth must be this far above the horizon to count. It stands in for hills the
            smooth-Moon model cannot see.
          </p>
          <label className="fld">
            <span>LANDING ACCURACY</span>
            <select value={scenario.accuracy} onChange={(e) => update({ accuracy: Number(e.target.value) })}>
              {ACCURACIES.map((v) => (
                <option key={v} value={v}>
                  Can miss by up to {v} m
                </option>
              ))}
            </select>
          </label>
          <p className="hint">Times are always shown in UTC.</p>
        </div>
      </div>
    </>
  );
}
