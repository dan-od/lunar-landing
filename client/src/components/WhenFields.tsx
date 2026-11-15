// Landing date and hour (UTC) as real fields, plus a "Now" button that sets both
// to the current UTC date and hour. The date can be typed (YYYY-MM-DD) or picked
// from our own calendar popup, opened by the calendar button inside the field.
// Used in the scenario bar and on each side of Compare.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DATE_MAX, DATE_MIN, isAllowedDate, nowUtc } from '../scenario';
import { Select } from './Select';
import { CalendarPopup } from './CalendarPopup';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
export const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
export const RANGE_TEXT = `${DATE_MIN} to ${DATE_MAX}`;

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** The message for a typed date that cannot be used, always naming the allowed range. */
export function dateError(text: string): string {
  if (!DATE_SHAPE.test(text)) return `Type the date as YYYY-MM-DD, from ${RANGE_TEXT} (UTC).`;
  if (text >= DATE_MIN && text <= DATE_MAX) return `${text} is not a real date. Allowed dates are ${RANGE_TEXT} (UTC).`;
  return `The date must be from ${RANGE_TEXT} (UTC).`;
}

interface Props {
  date: string;
  hour: number;
  onChange: (next: { date: string; hour: number }) => void;
  /** Words that say whose date this is, for screen readers ("Side B", "Landing"). */
  label: string;
  disabled?: boolean;
  /** Called after Now is pressed, e.g. to say what happened. */
  onNow?: (next: { date: string; hour: number }) => void;
  className?: string;
}

export function WhenFields({ date, hour, onChange, label, disabled, onNow, className = '' }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(date);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const calButton = useRef<HTMLButtonElement>(null);

  // Follow changes made elsewhere (slip buttons, links, quick setups).
  useEffect(() => {
    setDraft(date);
    setError('');
  }, [date]);

  const typed = (v: string) => {
    setDraft(v);
    if (isAllowedDate(v)) {
      setError('');
      if (v !== date) onChange({ date: v, hour });
    } else if (v.length >= 10) {
      setError(dateError(v));
    } else {
      setError('');
    }
  };

  const now = () => {
    const next = nowUtc();
    if (!isAllowedDate(next.date)) {
      setError(`Today is outside the allowed dates (${RANGE_TEXT}).`);
      return;
    }
    setError('');
    onChange(next);
    onNow?.(next);
  };

  const close = useCallback(() => {
    setOpen(false);
    calButton.current?.focus();
  }, []);

  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const labelId = `${id}-label`;
  return (
    <div className={`when ${className}`} role="group" aria-label={`${label} date and hour, UTC`}>
      {error && (
        <p className="err when-err" role="alert" id={errId}>
          {error}
        </p>
      )}
      <div className="fld when-date">
        <label htmlFor={`${id}-date`}>
          <span id={labelId}>DATE (UTC)</span>
        </label>
        <div className="datebox">
          <input
            id={`${id}-date`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={10}
            placeholder="YYYY-MM-DD"
            value={draft}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errId} ${hintId}` : hintId}
            onChange={(e) => typed(e.target.value.trim())}
            onBlur={() => {
              // Leaving a date that cannot be used: say why, and put the last good one back.
              if (draft !== date && !isAllowedDate(draft)) {
                if (draft) setError(dateError(draft));
                setDraft(date);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <button
            ref={calButton}
            type="button"
            className="cal-open"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`Choose ${label.toLowerCase()} date from a calendar`}
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true" />
          </button>
          {open && (
            <CalendarPopup
              value={isAllowedDate(draft) ? draft : date}
              labelledBy={labelId}
              onClose={close}
              onPick={(d) => {
                setError('');
                setDraft(d);
                if (d !== date) onChange({ date: d, hour });
                close();
              }}
            />
          )}
        </div>
      </div>
      <label className="fld when-hour">
        <span>HOUR (UTC)</span>
        <Select
          width="short"
          value={hour}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange({ date, hour: Number(e.target.value) })}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hh(h)}
            </option>
          ))}
        </Select>
      </label>
      <button type="button" className="btn2 when-now" disabled={disabled} onClick={now}>
        NOW<span className="sr">: set {label.toLowerCase()} to the current UTC date and hour</span>
      </button>
      <span className="hint when-hint" id={hintId}>
        Type YYYY-MM-DD or use the calendar · allowed {RANGE_TEXT}
      </span>
    </div>
  );
}
