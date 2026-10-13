import { dateRangeProblem, timeRangeProblem } from './date-range';

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

describe('timeRangeProblem (#412)', () => {
  const MSG = "End time must be after the start time. For something that runs past midnight, leave the end time empty.";

  it('refuses an end before the start on the same day', () => {
    expect(timeRangeProblem('2:00 PM', '1:00 PM')).toBe(MSG);
    expect(timeRangeProblem('14:00', '13:00')).toBe(MSG);           // older 24-hour values too
  });

  it('refuses an end equal to the start: a zero-length activity says nothing', () => {
    expect(timeRangeProblem('2:00 PM', '2:00 PM')).toBe(MSG);
  });

  it('accepts an end after the start', () => {
    expect(timeRangeProblem('2:00 PM', '4:00 PM')).toBe('');
    expect(timeRangeProblem('11:30 AM', '12:15 PM')).toBe('');
    expect(timeRangeProblem('12:00 AM', '12:30 AM')).toBe('');      // just after midnight
  });

  it('accepts no times, a start with no end, and an end with no start', () => {
    expect(timeRangeProblem('', '')).toBe('');
    expect(timeRangeProblem('2:00 PM', '')).toBe('');
    expect(timeRangeProblem(undefined, undefined)).toBe('');
    expect(timeRangeProblem('', '3:00 PM')).toBe('');
  });

  it("doesn't judge a time it can't read (the time field reports that itself)", () => {
    expect(timeRangeProblem('2:00 PM', 'soon')).toBe('');
  });
});
