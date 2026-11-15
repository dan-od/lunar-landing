// Our own calendar popup: month and year dropdowns at the top, previous and next
// month arrows, and a grid of days. Picking a day sets the date and closes it.
// Keyboard: arrows move between days, Page Up/Down by month (Shift: by year),
// Home/End to the week's ends, Enter or Space picks, Escape closes. Today and
// the selected day are marked with a symbol as well as colour.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { nowUtc } from '../scenario';
import { Select } from './Select';
import {
  MONTHS,
  WEEKDAY_NAMES,
  WEEKDAYS,
  YEAR_MAX,
  YEAR_MIN,
  inRange,
  iso,
  keyMove,
  monthGrid,
  parts,
  spoken,
} from './calendar';
import { daysInMonth } from '../scenario';

interface Props {
  /** The selected date (YYYY-MM-DD). */
  value: string;
  onPick: (date: string) => void;
  onClose: () => void;
  labelledBy: string;
}

const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

export function CalendarPopup({ value, onPick, onClose, labelledBy }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = nowUtc().date;
  // The day that holds keyboard focus; the month shown follows it.
  const [focus, setFocus] = useState(value);
  const [moveFocus, setMoveFocus] = useState(true);
  const { y, m } = parts(focus);

  // Put focus on the focused day after it changes by keyboard or on opening.
  useLayoutEffect(() => {
    if (!moveFocus) return;
    ref.current?.querySelector<HTMLButtonElement>(`button[data-date="${focus}"]`)?.focus();
    setMoveFocus(false);
  }, [focus, moveFocus]);

  // Close on a press outside, and on Escape from anywhere inside.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [onClose]);

  const goMonth = (ny: number, nm: number, keepFocusHere = false) => {
    const d = Math.min(parts(focus).d, daysInMonth(ny, nm));
    let next = iso(ny, nm, d);
    if (!inRange(next)) next = next < iso(YEAR_MIN, 1, 1) ? iso(YEAR_MIN, 1, 1) : iso(YEAR_MAX, 12, 31);
    setFocus(next);
    if (!keepFocusHere) setMoveFocus(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      // Keep Tab inside the popup.
      const items = ref.current?.querySelectorAll<HTMLElement>('select, .cal-nav button:not([disabled]), button[tabindex="0"]:not([disabled])');
      if (!items?.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const onDayKey = (e: React.KeyboardEvent, date: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(date);
      return;
    }
    const next = keyMove(date, e.key, e.shiftKey);
    if (next) {
      e.preventDefault();
      setFocus(next);
      setMoveFocus(true);
    }
  };

  const atStart = y === YEAR_MIN && m === 1;
  const atEnd = y === YEAR_MAX && m === 12;
  const prev = () => (m === 1 ? goMonth(y - 1, 12, true) : goMonth(y, m - 1, true));
  const next = () => (m === 12 ? goMonth(y + 1, 1, true) : goMonth(y, m + 1, true));

  return (
    <div
      ref={ref}
      className="cal"
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      <div className="cal-head">
        <span className="cal-nav">
          <button type="button" onClick={prev} disabled={atStart} aria-label="Previous month">
            <span aria-hidden="true">◀</span>
          </button>
        </span>
        <label className="cal-pick">
          <span className="sr">Month</span>
          <Select width="short" value={m} onChange={(e) => goMonth(y, Number(e.target.value), true)}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <label className="cal-pick">
          <span className="sr">Year</span>
          <Select width="short" value={y} onChange={(e) => goMonth(Number(e.target.value), m, true)}>
            {YEARS.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </Select>
        </label>
        <span className="cal-nav">
          <button type="button" onClick={next} disabled={atEnd} aria-label="Next month">
            <span aria-hidden="true">▶</span>
          </button>
        </span>
      </div>
      <table className="cal-grid" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`}>
        <thead>
          <tr>
            {WEEKDAYS.map((w, i) => (
              <th key={w} scope="col" abbr={WEEKDAY_NAMES[i]}>
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(y, m).map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                if (!date) return <td key={di} />;
                const selected = date === value;
                const isToday = date === today;
                const usable = inRange(date);
                const label = `${spoken(date)}${selected ? ', selected' : ''}${isToday ? ', today' : ''}`;
                return (
                  <td key={di} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      data-date={date}
                      className={`cal-day${selected ? ' sel' : ''}${isToday ? ' today' : ''}`}
                      tabIndex={date === focus ? 0 : -1}
                      disabled={!usable}
                      aria-label={label}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onPick(date)}
                      onKeyDown={(e) => onDayKey(e, date)}
                      onFocus={() => setFocus(date)}
                    >
                      <span aria-hidden="true">{parts(date).d}</span>
                      {selected && (
                        <span className="cal-mark" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      {isToday && !selected && (
                        <span className="cal-mark" aria-hidden="true">
                          •
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cal-key hint">
        <span aria-hidden="true">✓</span> selected · <span aria-hidden="true">•</span> today (UTC) · arrows move,
        Enter picks, Esc closes
      </p>
    </div>
  );
}
