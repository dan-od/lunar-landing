// Landing date and hour (UTC) as real fields, plus a "Now" button that sets both
// to the current UTC date and hour. Used in the scenario bar and on each side of
// Compare, so every tab edits the moment of touchdown the same way.
import { useEffect, useId, useState } from 'react';
import { DATE_MAX, DATE_MIN, isAllowedDate, nowUtc } from '../scenario';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
export const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
export const RANGE_TEXT = `${DATE_MIN} to ${DATE_MAX}`;

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

  // Follow changes made elsewhere (slip buttons, links, quick setups).
  useEffect(() => {
    setDraft(date);
    setError('');
  }, [date]);

  const commitDate = (v: string) => {
    setDraft(v);
    if (isAllowedDate(v)) {
      setError('');
      if (v !== date) onChange({ date: v, hour });
    } else if (v) {
      setError(`The date must be between ${RANGE_TEXT} (UTC).`);
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

  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className={`when ${className}`} role="group" aria-label={`${label} date and hour, UTC`}>
      {error && (
        <p className="err when-err" role="alert" id={errId}>
          {error}
        </p>
      )}
      <label className="fld when-date">
        <span>DATE (UTC)</span>
        <input
          type="date"
          min={DATE_MIN}
          max={DATE_MAX}
          value={draft}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errId} ${hintId}` : hintId}
          onChange={(e) => commitDate(e.target.value)}
          onBlur={() => {
            // Leaving a half-typed date puts the last good one back.
            if (!isAllowedDate(draft)) setDraft(date);
          }}
        />
      </label>
      <label className="fld when-hour">
        <span>HOUR (UTC)</span>
        <select
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
        </select>
      </label>
      <button type="button" className="btn2 when-now" disabled={disabled} onClick={now}>
        NOW<span className="sr">: set {label.toLowerCase()} to the current UTC date and hour</span>
      </button>
      <span className="hint when-hint" id={hintId}>
        Allowed dates {RANGE_TEXT}
      </span>
    </div>
  );
}
