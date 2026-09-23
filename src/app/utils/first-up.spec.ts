import { parseTimeString, entryCutoffMs, pickFirstUp, FirstUpEntry } from './first-up';
import { FlightMoment } from './flight-events';

const at = (date: string, h: number, min = 0) => new Date(`${date}T00:00`).setHours(h, min);

const item = (over: Partial<FirstUpEntry>): FirstUpEntry => ({
  date: '2026-09-24', time: '', endTime: '', activity: 'Event', location: '', sortOrder: 0, ...over,
});

const moment = (over: Partial<FlightMoment>): FlightMoment => ({
  date: '2026-09-24', time: '4:20pm', label: 'Depart from ORD', kind: 'depart', section: 'ARRIVALS', ...over,
});

describe('parseTimeString', () => {
  it('parses 12h, compact, and 24h forms', () => {
    expect(parseTimeString('2:30 PM')).toEqual({ h: 14, min: 30 });
    expect(parseTimeString('4:20pm')).toEqual({ h: 16, min: 20 });
    expect(parseTimeString('9 am')).toEqual({ h: 9, min: 0 });
    expect(parseTimeString('14:30')).toEqual({ h: 14, min: 30 });
  });

  it('returns null for junk like "420" instead of guessing', () => {
    expect(parseTimeString('420')).toBeNull();
    expect(parseTimeString('')).toBeNull();
    expect(parseTimeString(undefined)).toBeNull();
  });
});

describe('pickFirstUp', () => {
  // Regression: tester's real flight (4:20pm) must beat their hand-made
  // "Fly Out" event whose time-picker silently defaulted to now (5:01 PM).
  it('prefers the real flight when it departs before a same-day manual event', () => {
    const manual = item({ activity: 'Fly Out', time: '5:01 PM' });
    const picked = pickFirstUp([manual], [moment({})], at('2026-09-24', 9));
    expect(picked?.activity).toBe('Depart from ORD');
    expect(picked?.time).toBe('4:20pm');
  });

  // The flight time the user entered on the Flights page is the truth. A
  // hand-typed duplicate of that flight must never show a stale earlier time.
  it('prefers the real flight over an earlier same-day manual Transport item', () => {
    const stale = item({ activity: 'Fly Out', time: '3:00 PM', category: 'Transport' });
    const picked = pickFirstUp([stale], [moment({})], at('2026-09-24', 9));
    expect(picked?.activity).toBe('Depart from ORD');
    expect(picked?.time).toBe('4:20pm');
  });

  it('prefers the real flight over an earlier same-day manual item that reads like a flight', () => {
    const stale = item({ activity: 'Fly out of ORD', time: '3:00 PM', category: 'Activity' });
    const picked = pickFirstUp([stale], [moment({})], at('2026-09-24', 9));
    expect(picked?.activity).toBe('Depart from ORD');
  });

  it('keeps an earlier manual event ahead of a later flight', () => {
    const breakfast = item({ activity: 'Breakfast', time: '8:00 AM' });
    const picked = pickFirstUp([breakfast], [moment({})], at('2026-09-24', 7));
    expect(picked?.activity).toBe('Breakfast');
  });

  it('lets an untimed manual event hold its day (existing behavior)', () => {
    const allDay = item({ activity: 'Explore town' });
    const picked = pickFirstUp([allDay], [moment({})], at('2026-09-24', 9));
    expect(picked?.activity).toBe('Explore town');
  });

  it('shows the flight when there are no manual events', () => {
    const picked = pickFirstUp([], [moment({})], at('2026-09-24', 9));
    expect(picked?.activity).toBe('Depart from ORD');
  });

  it('shows an earlier-day flight ahead of a later-day manual event', () => {
    const later = item({ date: '2026-09-26', activity: 'Museum', time: '10:00 AM' });
    const picked = pickFirstUp([later], [moment({})], at('2026-09-23', 12));
    expect(picked?.activity).toBe('Depart from ORD');
  });

  it('falls back to the last manual event when everything has passed', () => {
    const past = item({ activity: 'Fly Out', time: '5:01 PM' });
    const picked = pickFirstUp([past], [moment({})], at('2026-09-30', 12));
    expect(picked?.activity).toBe('Fly Out');
  });

  it('returns null with no events at all', () => {
    expect(pickFirstUp([], [], at('2026-09-24', 9))).toBeNull();
  });
});

describe('entryCutoffMs', () => {
  it('uses end time, then start time, then end of day', () => {
    const timed = item({ time: '4:20pm' });
    expect(entryCutoffMs(timed)).toBe(at('2026-09-24', 16, 20));
    const spans = item({ time: '4:20pm', endTime: '6:00 PM' });
    expect(entryCutoffMs(spans)).toBe(at('2026-09-24', 18, 0));
    const untimed = item({});
    expect(entryCutoffMs(untimed)).toBeGreaterThan(at('2026-09-24', 23, 58));
  });
});
