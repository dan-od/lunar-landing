// Plain-language change report between two cases (flow 3). Every number in a
// sentence is taken from the same calculator result shown on that side, so the
// words cannot disagree with the readouts. Marks are from B's point of view.
import type { WindowResult } from './types.js';

export type Mark = 'better' | 'worse' | 'same';

/** A mark is always a symbol and a word, never colour alone. */
export const MARK_SYMBOL: Record<Mark, string> = { better: '▲', worse: '▼', same: '=' };
export const MARK_LABEL: Record<Mark, string> = { better: 'Better', worse: 'Worse', same: 'Same' };

export interface ReportLine {
  mark: Mark;
  symbol: string;
  label: string;
  text: string;
}

export interface ChangeReport {
  verdict: string;
  /** Shown under the verdict when nothing differs. */
  note?: string;
  /** True when every line is the same: "No meaningful change". */
  same: boolean;
  lines: ReportLine[];
}

const line = (delta: number, text: string): ReportLine => {
  const mark: Mark = delta > 0 ? 'better' : delta < 0 ? 'worse' : 'same';
  return { mark, symbol: MARK_SYMBOL[mark], label: MARK_LABEL[mark], text };
};

/** Days as shown on screen: one decimal. Comparisons use this shown value. */
export const shownDays = (days: number): string => days.toFixed(1);

export function buildReport(a: WindowResult, b: WindowResult): ChangeReport {
  const lines: ReportLine[] = [];

  const sunA = a.power.uptimePct;
  const sunB = b.power.uptimePct;
  lines.push(
    line(
      sunB - sunA,
      sunA === sunB
        ? `Time in sunlight is unchanged at ${sunA}%.`
        : `Time in sunlight goes from ${sunA}% to ${sunB}%.`,
    ),
  );

  const linkA = a.contact.uptimePct;
  const linkB = b.contact.uptimePct;
  lines.push(
    line(
      linkB - linkA,
      linkA === linkB
        ? `Earth contact is unchanged at ${linkA}%.`
        : `Earth contact goes from ${linkA}% to ${linkB}%.`,
    ),
  );

  const upA = a.landing.powerUp;
  const upB = b.landing.powerUp;
  const word = (up: boolean) => (up ? 'Sun up' : 'Sun down');
  lines.push(
    line(
      Number(upB) - Number(upA),
      upA === upB
        ? `Power at landing is the same on both sides (${word(upA)}).`
        : `Power at landing: ${word(upA)} in A, ${word(upB)} in B.`,
    ),
  );

  const darkA = shownDays(a.power.longestGapDays);
  const darkB = shownDays(b.power.longestGapDays);
  lines.push(line(Number(darkA) - Number(darkB), `Longest dark stretch: ${darkA} days in A, ${darkB} days in B.`));

  const gapA = shownDays(a.contact.longestGapDays);
  const gapB = shownDays(b.contact.longestGapDays);
  lines.push(
    line(Number(gapA) - Number(gapB), `Longest gap in Earth contact: ${gapA} days in A, ${gapB} days in B.`),
  );

  const same = lines.every((l) => l.mark === 'same');
  const score = lines.reduce((t, l) => t + (l.mark === 'better' ? 1 : l.mark === 'worse' ? -1 : 0), 0);
  const verdict = same
    ? 'No meaningful change'
    : score > 0
      ? 'B is the better case'
      : score < 0
        ? 'B is the worse case'
        : 'No clear winner';

  return {
    verdict,
    note: same ? 'The Moon turns slowly, so a few hours often changes nothing.' : undefined,
    same,
    lines,
  };
}

/** The report as text for copying: exactly what is on screen (3-5). */
export function reportText(report: ChangeReport, context: string): string {
  return [
    report.verdict,
    ...report.lines.map((l) => `${l.symbol} ${l.label}: ${l.text}`),
    context,
  ].join('\n');
}
