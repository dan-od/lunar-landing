// Spreadsheet-safe CSV cells. User text (site names) must never be read as a
// formula by a spreadsheet app, so any text that would start one is prefixed
// with an apostrophe, which spreadsheet apps treat as "this is text" (S-3).

const FORMULA_START = /^\s*[=+\-@\t\r]/;

/** One CSV cell: numbers as they are, text quoted and never able to start a formula. */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '""';
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(',');
}
