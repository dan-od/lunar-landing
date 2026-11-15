import { describe, it, expect } from 'vitest';
import { keyMove, monthGrid, spoken, weekday } from './calendar';

describe('calendar popup logic (C)', () => {
  it('lays out a month in weeks starting on Monday', () => {
    // 1 December 2026 is a Tuesday.
    const weeks = monthGrid(2026, 12);
    expect(weeks[0]).toEqual([null, '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
    expect(weeks.flat().filter(Boolean).length).toBe(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(monthGrid(2024, 2).flat().filter(Boolean).length).toBe(29);
  });

  it('moves the focused day with the keyboard', () => {
    expect(keyMove('2026-12-15', 'ArrowRight')).toBe('2026-12-16');
    expect(keyMove('2026-12-01', 'ArrowLeft')).toBe('2026-11-30');
    expect(keyMove('2026-12-15', 'ArrowDown')).toBe('2026-12-22');
    expect(keyMove('2026-12-15', 'ArrowUp')).toBe('2026-12-08');
    expect(keyMove('2026-12-16', 'Home')).toBe('2026-12-14');
    expect(keyMove('2026-12-16', 'End')).toBe('2026-12-20');
    expect(keyMove('2026-01-31', 'PageDown')).toBe('2026-02-28');
    expect(keyMove('2026-12-15', 'PageUp', true)).toBe('2025-12-15');
    expect(keyMove('2026-12-15', 'a')).toBeNull();
  });

  it('never leaves the allowed dates', () => {
    expect(keyMove('1960-01-01', 'ArrowLeft')).toBe('1960-01-01');
    expect(keyMove('2100-12-31', 'ArrowDown')).toBe('2100-12-31');
  });

  it('says the full date for screen readers', () => {
    expect(weekday('2026-12-14')).toBe(0);
    expect(spoken('2026-12-15')).toBe('Tuesday 15 December 2026');
  });
});
