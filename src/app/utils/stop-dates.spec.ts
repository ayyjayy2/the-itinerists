import { stopDateRange, tripDateRange } from './stop-dates';

describe('stopDateRange', () => {
  it('keeps a stop\'s dates short but clear', () => {
    expect(stopDateRange('2026-10-06', '2026-10-09')).toBe('Oct 6 – 9');
    expect(stopDateRange('2026-09-30', '2026-10-03')).toBe('Sep 30 – Oct 3');
    expect(stopDateRange('2026-10-06', '2026-10-06')).toBe('Oct 6');
    expect(stopDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30 – Jan 2');
  });
});

// #536: Home's hero read "Nov 12 – Nov 19, 2026".
describe('tripDateRange', () => {
  it('is the short range plus the year', () => {
    expect(tripDateRange('2026-11-12', '2026-11-19')).toBe('Nov 12 – 19, 2026');
    expect(tripDateRange('2026-09-30', '2026-10-03')).toBe('Sep 30 – Oct 3, 2026');
    expect(tripDateRange('2026-10-06', '2026-10-06')).toBe('Oct 6, 2026');
  });
  it('names both years when the trip crosses a new year', () => {
    expect(tripDateRange('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
  });
  it('is empty without both dates', () => {
    expect(tripDateRange('', '2026-11-19')).toBe('');
    expect(tripDateRange('2026-11-12', '')).toBe('');
  });
});
