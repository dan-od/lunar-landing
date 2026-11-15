// Upcoming changes for the Watch tab and the calendar file: when the Sun rises
// or sets and when Earth rises or sets, read straight from the one calculator's
// windows. "Rises" means it climbs above the shadow allowance (or the terrain
// horizon); "sets" means it drops below it. Times are hourly, like NASA's positions.
import type { WindowResult } from './types.js';

export type ChangeKind = 'sunrise' | 'sunset' | 'earthrise' | 'earthset';

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  earthrise: 'Earth rise',
  earthset: 'Earth set',
};

export interface Change {
  kind: ChangeKind;
  label: string;
  /** ISO-8601 UTC. */
  time: string;
  hoursAfterLanding: number;
}

/**
 * Every change after the landing moment and before the end of the span. A window
 * that is already open at landing has no rise; one still open at the end of the
 * span has no set.
 */
export function changesFrom(result: WindowResult, landingIso: string, spanHours: number): Change[] {
  const landing = Date.parse(landingIso);
  const end = landing + spanHours * 3_600_000;
  const out: Change[] = [];
  const add = (kind: ChangeKind, time: string) => {
    const ms = Date.parse(time);
    if (ms <= landing || ms >= end) return;
    out.push({
      kind,
      label: CHANGE_LABELS[kind],
      time: new Date(ms).toISOString().replace('.000Z', 'Z'),
      hoursAfterLanding: Math.round((ms - landing) / 3_600_000),
    });
  };
  for (const w of result.power.windows) {
    add('sunrise', w.start);
    add('sunset', w.end);
  }
  for (const w of result.contact.windows) {
    add('earthrise', w.start);
    add('earthset', w.end);
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.kind.localeCompare(b.kind));
}
