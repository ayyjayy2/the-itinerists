import { dateRangeProblem } from './date-range';

describe('dateRangeProblem', () => {
  it('is fine when the end is on or after the start', () => {
    expect(dateRangeProblem('2026-10-01', '2026-10-05')).toBe('');
    expect(dateRangeProblem('2026-10-01', '2026-10-01')).toBe('');
  });

  it('names the pair when the end comes first', () => {
    expect(dateRangeProblem('2026-10-05', '2026-10-01')).toBe("End date can't be before the start date.");
    expect(dateRangeProblem('2026-10-05', '2026-10-01', 'Check-out', 'check-in'))
      .toBe("Check-out can't be before the check-in.");
    expect(dateRangeProblem('2026-10-05', '2026-10-01', 'Arrival date', 'departure date'))
      .toBe("Arrival date can't be before the departure date.");
  });

  it('stays quiet until both dates are filled in', () => {
    expect(dateRangeProblem('', '2026-10-01')).toBe('');
    expect(dateRangeProblem('2026-10-05', '')).toBe('');
    expect(dateRangeProblem(undefined, undefined)).toBe('');
  });
});
