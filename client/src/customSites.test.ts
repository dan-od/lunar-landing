import { describe, it, expect } from 'vitest';
import { checkCoordinates, cleanName, customId, parseCustomId } from './customSites';

describe('checkCoordinates (2-2)', () => {
  it('accepts real coordinates', () => {
    expect(checkCoordinates('-85.2', '31.5')).toEqual({ ok: true, lat: -85.2, lon: 31.5 });
    expect(checkCoordinates(' 90 ', '360')).toEqual({ ok: true, lat: 90, lon: 360 });
    expect(checkCoordinates('-90', '-180')).toEqual({ ok: true, lat: -90, lon: -180 });
  });

  it('refuses 95 for latitude and names the latitude field', () => {
    expect(checkCoordinates('95', '10')).toEqual({
      ok: false,
      field: 'lat',
      message: 'Latitude must be a number from -90 to 90.',
    });
  });

  it('refuses a longitude out of range and names the longitude field', () => {
    expect(checkCoordinates('10', '400')).toMatchObject({ ok: false, field: 'lon' });
    expect(checkCoordinates('10', '-181')).toMatchObject({ ok: false, field: 'lon' });
  });

  it('refuses anything that is not a plain number', () => {
    for (const bad of ['', 'abc', '12abc', '1e2', '--5', '5,2', 'NaN', 'Infinity']) {
      expect(checkCoordinates(bad, '10')).toMatchObject({ ok: false, field: 'lat' });
      expect(checkCoordinates('10', bad)).toMatchObject({ ok: false, field: 'lon' });
    }
  });

  it('checks latitude first, so focus goes to the first field at fault', () => {
    expect(checkCoordinates('95', '400')).toMatchObject({ field: 'lat' });
  });
});

describe('custom site ids carry their coordinates', () => {
  it('round-trips', () => {
    const id = customId(-85.2, 31.5);
    expect(id).toBe('c:-85.2,31.5');
    expect(parseCustomId(id)).toEqual({ lat: -85.2, lon: 31.5 });
  });

  it('rounds to four decimals, so the same point always has the same id', () => {
    expect(customId(-85.20004, 31.49996)).toBe('c:-85.2,31.5');
  });

  it('is not fooled by other ids or bad values', () => {
    for (const id of ['im2', 'aim', 'c:', 'c:1', 'c:1,2,3', 'c:95,10', 'c:10,400', 'c:x,y', 'c:,5']) {
      expect(parseCustomId(id)).toBeNull();
    }
  });
});

describe('cleanName', () => {
  it('trims, single-spaces and limits the length', () => {
    expect(cleanName('  My   site \n')).toBe('My site');
    expect(cleanName('x'.repeat(200)).length).toBe(60);
  });

  it('keeps awkward text as plain text (it is escaped wherever it is shown)', () => {
    expect(cleanName('=SUM(A1) <b>')).toBe('=SUM(A1) <b>');
  });
});
