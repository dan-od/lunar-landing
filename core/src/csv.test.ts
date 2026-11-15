import { describe, it, expect } from 'vitest';
import { csvCell, csvRow } from './csv.js';

describe('csvCell (S-3: a cell can never start a formula)', () => {
  it('exports a name beginning with an equals sign as text', () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe('"\'=HYPERLINK(""http://x"",""click"")"');
  });

  it('neutralises every formula trigger, including after leading spaces', () => {
    for (const lead of ['=', '+', '-', '@', '\t', '\r']) {
      expect(csvCell(`${lead}1+1`).startsWith(`"'`)).toBe(true);
    }
    expect(csvCell('  =SUM(A1)')).toBe('"\'  =SUM(A1)"');
  });

  it('leaves ordinary text alone and quotes it', () => {
    expect(csvCell('IM-2 target, Mons Mouton')).toBe('"IM-2 target, Mons Mouton"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('writes numbers as numbers, including negatives', () => {
    expect(csvCell(-84.78)).toBe('-84.78');
    expect(csvCell(30)).toBe('30');
  });

  it('keeps line breaks inside one quoted cell', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
});

describe('csvRow', () => {
  it('joins cells with commas', () => {
    expect(csvRow(['Site', '=evil', 2])).toBe('"Site","\'=evil",2');
  });
});
