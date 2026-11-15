// When the Miss tab and the Console seem to disagree, say why: the Console shows
// the smooth-Moon model at one hour; the Miss tab asks whether a landing works on
// real terrain at touchdown and for at least 90% of the first 10 days.
import type { GridPoint, SiteState } from '@moon/core';

/** Does the prepared point at the original target work? Undefined if it is not prepared. */
export function targetWorks(grid: GridPoint[], stepM: number): boolean | undefined {
  const p = grid.find((g) => Math.abs(g.east) < stepM / 2 && Math.abs(g.north) < stepM / 2);
  return p?.works;
}

/** The explanation, or null when the two agree (or one of them is unknown). */
export function differsNote(consoleState: SiteState | undefined, works: boolean | undefined, place: string, when: string): string | null {
  if (!consoleState || works === undefined) return null;
  if ((consoleState.word === 'READY') === works) return null;
  return (
    `The Console shows ${consoleState.symbol} ${consoleState.word} for ${place} at ${when} UTC: that is the smooth-Moon model at that one hour. ` +
    `Here the terrain model asks whether a landing works at touchdown and for at least 90% of the first 10 days, ` +
    `and at the original target it ${works ? 'does' : 'does not'}. Both are right about different questions.`
  );
}
