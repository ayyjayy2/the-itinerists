import { daysToSave, forecastRange, weatherRequests } from './forecast-window';

describe('forecastRange', () => {
  // 11:50 AM CDT on Oct 30 — Open-Meteo then allowed 2026-07-29 … 2026-11-14.
  const now = new Date('2026-10-30T16:50:00Z');

  it('asks for a leg that ends on the last forecast day (today + 15, today counted)', () => {
    expect(forecastRange('2026-11-12', '2026-11-14', now)).toEqual({ start: '2026-11-12', end: '2026-11-14' });
  });

  it('skips a leg that starts the day after the forecast ends (#552: Pai on Nov 15)', () => {
    expect(forecastRange('2026-11-15', '2026-11-15', now)).toBeNull();
  });

  it('cuts a leg that runs past the forecast at its last day', () => {
    expect(forecastRange('2026-11-12', '2026-11-20', now)).toEqual({ start: '2026-11-12', end: '2026-11-14' });
  });

  it('counts days by the UTC date, as Open-Meteo does', () => {
    // 9 PM CDT on Oct 29 is already Oct 30 in UTC, so Nov 14 is in range.
    const lateEvening = new Date('2026-10-30T02:00:00Z');
    expect(forecastRange('2026-11-14', '2026-11-14', lateEvening)).toEqual({ start: '2026-11-14', end: '2026-11-14' });
    // 6 PM CDT on Oct 29 is still Oct 29 in UTC, so Nov 14 is not.
    const earlyEvening = new Date('2026-10-29T23:00:00Z');
    expect(forecastRange('2026-11-14', '2026-11-14', earlyEvening)).toBeNull();
  });

  it('starts a long-running leg at the earliest day Open-Meteo still serves', () => {
    expect(forecastRange('2026-06-01', '2026-11-01', now)).toEqual({ start: '2026-07-30', end: '2026-11-01' });
  });

  it('skips a leg that ended before the earliest day', () => {
    expect(forecastRange('2026-05-01', '2026-05-09', now)).toBeNull();
  });
});

describe('weatherRequests', () => {
  const now = new Date('2026-10-30T16:50:00Z');   // today is Oct 30 (UTC)
  const none = new Set<string>();

  it('asks the forecast for a trip that is still to come', () => {
    expect(weatherRequests('2026-11-12', '2026-11-19', now, none))
      .toEqual([{ source: 'forecast', start: '2026-11-12', end: '2026-11-14' }]);
  });

  it('asks history for the days that have passed, and the forecast from today on', () => {
    expect(weatherRequests('2026-10-26', '2026-11-02', now, none)).toEqual([
      { source: 'history',  start: '2026-10-26', end: '2026-10-29' },
      { source: 'forecast', start: '2026-10-30', end: '2026-11-02' },
    ]);
  });

  it('looks up a trip from long ago in history', () => {
    expect(weatherRequests('2025-10-06', '2025-10-09', now, none))
      .toEqual([{ source: 'history', start: '2025-10-06', end: '2025-10-09' }]);
  });

  it('skips past days that are already saved', () => {
    const saved = new Set(['2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09']);
    expect(weatherRequests('2025-10-06', '2025-10-09', now, saved)).toEqual([]);
  });

  it('asks only for the stretch of past days still missing', () => {
    const saved = new Set(['2025-10-06', '2025-10-09']);
    expect(weatherRequests('2025-10-06', '2025-10-09', now, saved))
      .toEqual([{ source: 'history', start: '2025-10-07', end: '2025-10-08' }]);
  });
});

describe('daysToSave', () => {
  const now = new Date('2026-10-30T16:50:00Z');

  it('saves past days once they have settled (6 days on), and not already saved', () => {
    const dates = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-29', '2026-11-02'];
    expect(daysToSave(dates, new Set(['2026-10-23']), now)).toEqual(['2026-10-24']);
  });
});
