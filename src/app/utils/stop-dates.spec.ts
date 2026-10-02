import { stopDateRange } from './stop-dates';

describe('stopDateRange', () => {
  it('keeps a stop\'s dates short but clear', () => {
    expect(stopDateRange('2026-10-06', '2026-10-09')).toBe('Oct 6 – 9');
    expect(stopDateRange('2026-09-30', '2026-10-03')).toBe('Sep 30 – Oct 3');
    expect(stopDateRange('2026-10-06', '2026-10-06')).toBe('Oct 6');
    expect(stopDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30 – Jan 2');
  });
});
