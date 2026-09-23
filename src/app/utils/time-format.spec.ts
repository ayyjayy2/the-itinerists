import { toInputTime, fromInputTime, normalizeTime } from './time-format';

describe('toInputTime (display → native picker value)', () => {
  it('converts 12-hour display strings to HH:mm', () => {
    expect(toInputTime('3:50 PM')).toBe('15:50');
    expect(toInputTime('4:20pm')).toBe('16:20');
    expect(toInputTime('9 am')).toBe('09:00');
    expect(toInputTime('12:05 AM')).toBe('00:05');
    expect(toInputTime('12:30 PM')).toBe('12:30');
  });

  it('passes 24-hour values through zero-padded', () => {
    expect(toInputTime('14:30')).toBe('14:30');
    expect(toInputTime('9:05')).toBe('09:05');
  });

  it('is empty for blanks and junk', () => {
    expect(toInputTime('')).toBe('');
    expect(toInputTime(undefined)).toBe('');
    expect(toInputTime('noon-ish')).toBe('');
  });
});

describe('fromInputTime (native picker value → display)', () => {
  it('formats HH:mm as h:mm AM/PM', () => {
    expect(fromInputTime('15:50')).toBe('3:50 PM');
    expect(fromInputTime('09:00')).toBe('9:00 AM');
    expect(fromInputTime('00:05')).toBe('12:05 AM');
    expect(fromInputTime('12:30')).toBe('12:30 PM');
  });

  it('is empty for an empty picker', () => {
    expect(fromInputTime('')).toBe('');
  });
});

describe('normalizeTime (any stored string → the one display format)', () => {
  it('rewrites legacy 24-hour and compact strings', () => {
    expect(normalizeTime('10:00')).toBe('10:00 AM');
    expect(normalizeTime('4:20pm')).toBe('4:20 PM');
    expect(normalizeTime('9 am')).toBe('9:00 AM');
  });

  it('leaves canonical and unparseable strings as they are', () => {
    expect(normalizeTime('3:50 PM')).toBe('3:50 PM');
    expect(normalizeTime('after lunch')).toBe('after lunch');
    expect(normalizeTime('')).toBe('');
  });
});
