import { parseTimeString, entryCutoffMs, pickFirstUp, FirstUpEntry } from './first-up';
import { FlightMoment, flightMomentsForUid } from './flight-events';

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

describe('pickFirstUp with time zones (2026-10-01)', () => {
  // 11:35 in Chicago = 16:35 UTC = 17:35 in Lisbon.
  const NOW = Date.UTC(2026, 9, 1, 16, 35);
  const land = { date: '2026-10-01', time: '2:30 PM', endTime: '', activity: 'Land at Lisbon Airport', location: 'Humberto Delgado Airport', sortOrder: 0, category: 'Transport' };
  const dinner = { date: '2026-10-01', time: '8:00 PM', endTime: '', activity: 'Welcome dinner', location: 'Time Out Market', sortOrder: 2, category: 'Food' };
  const zoneFor = (iata: string) => ({ JFK: 'America/New_York', LIS: 'Europe/Lisbon' } as Record<string, string>)[iata];
  const flights = flightMomentsForUid([
    { uid: 'me', section: 'ARRIVALS', from: 'JFK', to: 'LIS', departureDate: '2026-09-30', departureTime: '9:45 PM', arrivalDate: '2026-10-01', arrivalTime: '10:30 AM' },
  ], 'me', 'Lisbon', zoneFor);

  it('reads itinerary times in the trip zone, so a Lisbon afternoon item is past at 17:35 Lisbon', () => {
    const pick = pickFirstUp([land, dinner], [], NOW, 'Europe/Lisbon');
    expect(pick?.activity).toBe('Welcome dinner');
    expect(pick?.zone).toBe('Europe/Lisbon');
  });

  it('would still show the landing on the phone clock (the old behaviour) without a zone', () => {
    // 2:30 PM Chicago is still ahead at 11:35 Chicago — exactly the bug.
    expect(pickFirstUp([land, dinner], [], NOW)?.activity).toBe('Land at Lisbon Airport');
  });

  it('puts each flight moment in its airport zone and orders them by instant', () => {
    const inFlight = Date.UTC(2026, 9, 1, 5, 0); // 1 AM New York, 6 AM Lisbon: airborne
    const pick = pickFirstUp([land, dinner], flights, inFlight, 'Europe/Lisbon');
    expect(pick?.activity).toBe('Arrive at LIS – Lisbon');
    expect(pick?.zone).toBe('Europe/Lisbon');
    const beforeTakeoff = Date.UTC(2026, 10 - 1, 1, 0, 30); // 8:30 PM New York on Sep 30
    expect(pickFirstUp([], flights, beforeTakeoff, 'Europe/Lisbon')?.activity).toBe('Depart from JFK');
  });
});

describe('pickFirstUp ignores hand-typed copies of a real flight', () => {
  const zoneFor = (iata: string) => ({ JFK: 'America/New_York', LIS: 'Europe/Lisbon' } as Record<string, string>)[iata];
  const flights = flightMomentsForUid([
    { uid: 'me', section: 'ARRIVALS', from: 'JFK', to: 'LIS', departureDate: '2026-09-30', departureTime: '9:45 PM', arrivalDate: '2026-10-01', arrivalTime: '10:30 AM' },
  ], 'me', 'Lisbon', zoneFor);
  const land   = { date: '2026-10-01', time: '2:30 PM', endTime: '', activity: 'Land at Lisbon Airport', location: 'Humberto Delgado Airport', sortOrder: 0, category: 'Transport' };
  const hotel  = { date: '2026-10-01', time: '4:30 PM', endTime: '', activity: 'Check in at hotel', location: 'Baixa', sortOrder: 1, category: 'Accommodation' };
  const dinner = { date: '2026-10-01', time: '8:00 PM', endTime: '', activity: 'Welcome dinner', location: 'Time Out Market', sortOrder: 2, category: 'Food' };

  it('after the flight has landed, moves on to the next real item instead of the stale copy', () => {
    const noonLisbon = Date.UTC(2026, 9, 1, 11, 0); // flight landed 10:30; the copy says 2:30 PM
    expect(pickFirstUp([land, hotel, dinner], flights, noonLisbon, 'Europe/Lisbon')?.activity).toBe('Check in at hotel');
  });

  it('before landing, shows the real arrival time', () => {
    const inFlight = Date.UTC(2026, 9, 1, 5, 0);
    const pick = pickFirstUp([land, hotel, dinner], flights, inFlight, 'Europe/Lisbon');
    expect(pick?.activity).toBe('Arrive at LIS – Lisbon');
    expect(pick?.time).toBe('10:30 AM');
  });

  it('keeps a flight-like item on a day with no real flight', () => {
    const taxi = { ...land, date: '2026-10-02', activity: 'Taxi to the airport' };
    expect(pickFirstUp([taxi], flights, Date.UTC(2026, 9, 2, 8, 0), 'Europe/Lisbon')?.activity).toBe('Taxi to the airport');
  });
});
