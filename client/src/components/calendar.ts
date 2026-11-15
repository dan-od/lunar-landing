// Date logic for the calendar popup: the grid of days for a month (weeks start
// on Monday, all dates UTC) and where the keyboard moves the focused day.
import { DATE_MAX, DATE_MIN, daysInMonth, shiftDate } from '../scenario';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const YEAR_MIN = Number(DATE_MIN.slice(0, 4));
export const YEAR_MAX = Number(DATE_MAX.slice(0, 4));

export const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const parts = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { y, m, d };
};

/** Monday = 0 … Sunday = 6. */
export function weekday(date: string): number {
  const { y, m, d } = parts(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The month as weeks of seven cells; cells outside the month are null. */
export function monthGrid(y: number, m: number): Array<Array<string | null>> {
  const first = weekday(iso(y, m, 1));
  const n = daysInMonth(y, m);
  const cells: Array<string | null> = [...Array<null>(first).fill(null)];
  for (let d = 1; d <= n; d++) cells.push(iso(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const inRange = (date: string) => date >= DATE_MIN && date <= DATE_MAX;

/**
 * Where a key moves the focused day: arrows by a day or a week, Home and End to
 * the start and end of the week, Page Up and Page Down by a month (with Shift,
 * a year). Returns null for any other key. Stays inside the allowed dates.
 */
export function keyMove(date: string, key: string, shift = false): string | null {
  switch (key) {
    case 'ArrowLeft':
      return shiftDate(date, { days: -1 });
    case 'ArrowRight':
      return shiftDate(date, { days: 1 });
    case 'ArrowUp':
      return shiftDate(date, { days: -7 });
    case 'ArrowDown':
      return shiftDate(date, { days: 7 });
    case 'Home':
      return shiftDate(date, { days: -weekday(date) });
    case 'End':
      return shiftDate(date, { days: 6 - weekday(date) });
    case 'PageUp':
      return shiftDate(date, shift ? { years: -1 } : { months: -1 });
    case 'PageDown':
      return shiftDate(date, shift ? { years: 1 } : { months: 1 });
    default:
      return null;
  }
}

/** "Monday 15 December 2026" for screen readers. */
export function spoken(date: string): string {
  const { y, m, d } = parts(date);
  return `${WEEKDAY_NAMES[weekday(date)]} ${d} ${MONTHS[m - 1]} ${y}`;
}
