// The date step buttons, shared by the scenario bar and the phone date sheet.
// The spoken name starts with the visible text, then says what it does.
export const SLIPS: Array<{ key: string; by: { days?: number; months?: number; years?: number }; text: string; more: string }> = [
  { key: 'd-1', by: { days: -1 }, text: '−1 d', more: 'landing one day earlier' },
  { key: 'd1', by: { days: 1 }, text: '+1 d', more: 'landing one day later' },
  { key: 'd10', by: { days: 10 }, text: '+10 d', more: 'landing ten days later' },
  { key: 'm-1', by: { months: -1 }, text: '−1 mo', more: 'landing one month earlier' },
  { key: 'm1', by: { months: 1 }, text: '+1 mo', more: 'landing one month later' },
  { key: 'y-1', by: { years: -1 }, text: '−1 y', more: 'landing one year earlier' },
  { key: 'y1', by: { years: 1 }, text: '+1 y', more: 'landing one year later' },
];
