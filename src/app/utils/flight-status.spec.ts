import { flightMomentMs, flightStatus } from './flight-status';

describe('flight status (JFK 9:45 PM Sep 30 → LIS 10:30 AM Oct 1, 2026)', () => {
  const dep = flightMomentMs('2026-09-30', '9:45 PM', 'America/New_York');
  const arr = flightMomentMs('2026-10-01', '10:30 AM', 'Europe/Lisbon');

  it('reads each end in its own airport zone', () => {
    expect(dep).toBe(Date.UTC(2026, 9, 1, 1, 45));
    expect(arr).toBe(Date.UTC(2026, 9, 1, 9, 30));
  });

  it('is boarding soon, in flight, landed, then nothing', () => {
    expect(flightStatus(dep, arr, dep - 3 * 3_600_000)).toBeNull();
    expect(flightStatus(dep, arr, dep - 90 * 60_000)).toBe('soon');
    expect(flightStatus(dep, arr, Date.UTC(2026, 9, 1, 5, 0))).toBe('inflight');
    expect(flightStatus(dep, arr, arr + 60 * 60_000)).toBe('landed');
    expect(flightStatus(dep, arr, arr + 7 * 3_600_000)).toBeNull();
  });

  it('claims nothing when a zone or time is missing, or the times are inconsistent', () => {
    expect(flightMomentMs('2026-10-01', '10:30 AM', undefined)).toBeNaN();
    expect(flightStatus(NaN, arr, arr)).toBeNull();
    expect(flightStatus(arr, dep, arr)).toBeNull();
  });

  it('would have called the same flight still airborne at 2 PM Lisbon if arrival were read as New York time (the old bug)', () => {
    const wrongArr = flightMomentMs('2026-10-01', '10:30 AM', 'America/New_York');
    const twoPmLisbon = Date.UTC(2026, 9, 1, 13, 0);
    expect(flightStatus(dep, wrongArr, twoPmLisbon)).toBe('inflight');
    expect(flightStatus(dep, arr, twoPmLisbon)).toBe('landed');
  });
});
