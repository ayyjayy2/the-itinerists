import { pickMapDay } from './map-day';

describe('pickMapDay', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-04'];

  it('returns today when the itinerary has events today (mid-trip)', () => {
    expect(pickMapDay(dates, '2026-10-02')).toBe('2026-10-02');
  });

  it('returns the next planned day when today has no events', () => {
    expect(pickMapDay(dates, '2026-10-03')).toBe('2026-10-04');
  });

  it('returns the first planned day before the trip starts', () => {
    expect(pickMapDay(dates, '2026-07-25')).toBe('2026-10-01');
  });

  it('returns null when the trip is over or there are no events', () => {
    expect(pickMapDay(dates, '2026-10-05')).toBeNull();
    expect(pickMapDay([], '2026-07-25')).toBeNull();
  });
});
