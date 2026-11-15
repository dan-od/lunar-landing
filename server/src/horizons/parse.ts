// Parse a NASA Horizons OBSERVER text reply (quantity 4: azimuth + elevation)
// into position rows. The data block sits between $$SOE and $$EOE.
import type { Body, PositionRow } from '@moon/core';

const MONTHS: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

const ROW_RE = /^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})\b(.*)$/;
const NUM_RE = /-?\d+\.\d+/g;

export function parseHorizons(text: string, body: Body): PositionRow[] {
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0 || eoe < soe) {
    throw new Error('Horizons reply has no $$SOE/$$EOE data block');
  }
  const block = text.slice(soe + '$$SOE'.length, eoe);
  const rows: PositionRow[] = [];

  for (const raw of block.split('\n')) {
    const line = raw.trimEnd();
    const m = ROW_RE.exec(line.trim());
    if (!m) continue;
    const [, year, mon, day, hh, mm, rest] = m;
    const monthNum = MONTHS[mon!];
    if (!monthNum) continue;

    // With QUANTITIES=4 the trailing numbers are azimuth then elevation.
    const nums = rest!.match(NUM_RE);
    if (!nums || nums.length < 2) continue;
    const azimuthDeg = Number(nums[nums.length - 2]);
    const elevationDeg = Number(nums[nums.length - 1]);

    rows.push({
      body,
      time: `${year}-${monthNum}-${day}T${hh}:${mm}:00Z`,
      azimuthDeg,
      elevationDeg,
    });
  }

  return rows;
}
