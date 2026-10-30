import { TripDoc } from '../models/trip.models';
import { dayChipDate, dayFullDate, dayHeadingDate, dayNote } from './day-heading';

describe('dayHeadingDate', () => {
  it('reads as a short weekday and date', () => {
    expect(dayHeadingDate('2026-11-12')).toBe('Thu., Nov. 12');
    expect(dayHeadingDate('2026-11-16')).toBe('Mon., Nov. 16');
  });

  it('abbreviates months the newspaper way: short months stay whole, September is Sept.', () => {
    expect(dayHeadingDate('2026-05-06')).toBe('Wed., May 6');
    expect(dayHeadingDate('2026-06-01')).toBe('Mon., June 1');
    expect(dayHeadingDate('2026-03-03')).toBe('Tue., March 3');
    expect(dayHeadingDate('2026-09-30')).toBe('Wed., Sept. 30');
  });

  it('gives back an empty string for no date', () => {
    expect(dayHeadingDate('')).toBe('');
  });
});

describe('dayFullDate', () => {
  it('spells the date out, for under a day\'s heading', () => {
    expect(dayFullDate('2026-11-12')).toBe('Thursday, November 12');
    expect(dayFullDate('2026-09-30')).toBe('Wednesday, September 30');
    expect(dayFullDate('')).toBe('');
  });
});

describe('dayChipDate', () => {
  it('is the date alone, for the day chips', () => {
    expect(dayChipDate('2026-11-12')).toBe('Nov. 12');
    expect(dayChipDate('2026-07-04')).toBe('July 4');
  });
});

describe('dayNote', () => {
  const trip = {
    startDate: '2026-11-12', endDate: '2026-11-19', destination: 'Chiang Mai, Thailand',
    destinations: [
      { destination: 'Chiang Mai, Thailand', startDate: '2026-11-12', endDate: '2026-11-15', currency: 'THB' },
      { destination: 'Pai, Thailand',        startDate: '2026-11-15', endDate: '2026-11-19', currency: 'THB' },
    ],
  } as TripDoc;

  it('is the name you gave the day', () => {
    expect(dayNote('2026-11-14', trip, 'Old City')).toBe('Old City');
  });

  it('is the stop\'s city when the day has no name', () => {
    expect(dayNote('2026-11-13', trip, undefined)).toBe('Chiang Mai');
    expect(dayNote('2026-11-17', trip, '  ')).toBe('Pai');
  });

  it('names both cities on a day that moves between stops', () => {
    expect(dayNote('2026-11-15', trip, '')).toBe('Chiang Mai → Pai');
  });

  it('uses the trip\'s one destination when it has no stops listed', () => {
    const single = { startDate: '2026-10-06', endDate: '2026-10-09', destination: 'Berlin, Germany' } as TripDoc;
    expect(dayNote('2026-10-07', single, undefined)).toBe('Berlin');
  });

  it('is empty for a day outside every stop, or with no trip', () => {
    expect(dayNote('2026-12-01', trip, undefined)).toBe('');
    expect(dayNote('2026-11-13', null, undefined)).toBe('');
  });
});
