import {
  resolveAudience, fmtDay, fmtRange, money,
  itineraryAdded, itineraryChanged, itineraryRemoved,
  flightAdded, flightChanged, flightRemoved,
  stayAdded, stayChanged, stayRemoved,
  transportAdded, transportChanged, transportRemoved,
  financeAdded, financeChanged, financeRemoved,
  recAdded, recChanged, recRemoved,
  pinAdded, pinRemoved,
  packingSuggested, packingAnswered,
  memberEvent, tripChanged,
} from './event-text';
import {
  ItineraryItemDoc, FlightDoc, AccommodationDoc, RentalCar, FinanceEntryDoc, RecDoc, MapPin, TripDoc,
} from '../models/trip.models';

const members = [
  { uid: 'u-maya', displayName: 'Maya' },
  { uid: 'u-sam',  displayName: 'Sam' },
  { uid: 'u-al',   displayName: 'Alayna' },
];

const item = (o: Partial<ItineraryItemDoc> = {}): ItineraryItemDoc => ({
  id: 'i1', date: '2026-10-03', time: '7:00 PM', endTime: '', activity: 'Dinner at Café Einstein',
  location: 'Kurfürstenstraße 58', category: 'Food', notes: '', forWho: 'All', addedByUid: 'u-maya', sortOrder: 0, createdAt: 0, ...o,
});
const flight = (o: Partial<FlightDoc> = {}): FlightDoc => ({
  id: 'f1', uid: 'u-maya', addedByUid: 'u-maya', section: 'DEPARTURES', airline: 'Delta', flightNumber: 'DL 44',
  from: 'SAV', to: 'BER', departureDate: '2026-10-03', departureTime: '10:40 AM', arrivalDate: '2026-10-04',
  arrivalTime: '8:15 AM', notes: '', createdAt: 0, ...o,
});
const stay = (o: Partial<AccommodationDoc> = {}): AccommodationDoc => ({
  id: 's1', name: 'Hotel Adlon', address: '', checkIn: '2026-10-03', checkOut: '2026-10-05',
  notes: '', bookingRef: '', forWho: 'All', addedByUid: 'u-maya', createdAt: 0, ...o,
});
const car = (o: Partial<RentalCar> = {}): RentalCar => ({
  company: 'Hertz', confirmationNumber: '', pickupDate: '2026-10-04', pickupTime: '10:00 AM', pickupLocation: '',
  dropoffDate: '2026-10-08', dropoffTime: '9:00 AM', dropoffLocation: '', drivers: '', notes: '', ...o,
});
const entry = (o: Partial<FinanceEntryDoc> = {}): FinanceEntryDoc => ({
  id: 'e1', date: '2026-10-03', description: 'Dinner', amount: 84, currency: 'EUR', paidBy: 'Maya',
  splitAmong: 'All', category: 'Food', addedByUid: 'u-maya', createdAt: 0, ...o,
});
const rec = (o: Partial<RecDoc> = {}): RecDoc => ({
  id: 'r1', category: 'Food', title: 'Café Einstein', description: '', extra: '', addedByUid: 'u-maya', createdAt: 0, ...o,
});
const pin = (o: Partial<MapPin> = {}): MapPin => ({
  id: 'p1', name: 'Tempelhof Field', lat: 0, lng: 0, category: 'Sightseeing', addedBy: 'Maya', forWho: 'All', ...o,
});
const trip = (o: Partial<TripDoc> = {}): TripDoc => ({
  id: 't1', name: 'Berlin', destination: 'Berlin, Germany', startDate: '2026-10-03', endDate: '2026-10-11',
  currency: 'EUR', ...o,
} as TripDoc);

describe('event-text: helpers', () => {
  it('resolveAudience', () => {
    expect(resolveAudience('All', members)).toBe('all');
    expect(resolveAudience('', members)).toBe('all');
    expect(resolveAudience(undefined, members)).toBe('all');
    expect(resolveAudience('Maya, sam', members)).toEqual(['u-maya', 'u-sam']);
    expect(resolveAudience(' maya ', members)).toEqual(['u-maya']);
    expect(resolveAudience('Nobody', members)).toEqual([]);
  });
  it('fmtDay / fmtRange / money', () => {
    expect(fmtDay('2026-10-03')).toBe('Sat Oct 3');
    expect(fmtRange('2026-10-03', '2026-10-05')).toBe('Oct 3 – 5');
    expect(fmtRange('2026-09-30', '2026-10-05')).toBe('Sep 30 – Oct 5');
    expect(money(84, 'EUR')).toBe('€84.00');
    expect(money(84, 'XXX')).toContain('84.00');
  });
});

describe('event-text: itinerary', () => {
  it('added, with day number and time', () => {
    const r = itineraryAdded(item(), 1, members);
    expect(r.summary).toBe('added Dinner at Café Einstein to Day 1, Sat Oct 3 at 7:00 PM');
    expect(r.audience).toBe('all');
  });
  it('added without a time or day number, for named people', () => {
    const r = itineraryAdded(item({ time: '', forWho: 'Sam' }), null, members);
    expect(r.summary).toBe('added Dinner at Café Einstein on Sat Oct 3');
    expect(r.audience).toEqual(['u-sam']);
  });
  it('time changed', () => {
    expect(itineraryChanged(item({ time: '11:00 AM', activity: 'Museum Island' }), item({ time: '2:00 PM', activity: 'Museum Island' }), members)!.summary)
      .toBe('changed Museum Island to 2:00 PM (was 11:00 AM)');
  });
  it('time set where there was none', () => {
    expect(itineraryChanged(item({ time: '' }), item({ time: '2:00 PM' }), members)!.summary)
      .toBe('changed Dinner at Café Einstein to 2:00 PM');
  });
  it('moved to another day', () => {
    expect(itineraryChanged(item({ activity: 'Bike tour' }), item({ activity: 'Bike tour', date: '2026-10-04' }), members)!.summary)
      .toBe('moved Bike tour to Sun Oct 4');
  });
  it('renamed', () => {
    expect(itineraryChanged(item({ activity: 'Museum' }), item({ activity: 'Museum Island' }), members)!.summary)
      .toBe('renamed Museum to Museum Island');
  });
  it('location changed', () => {
    expect(itineraryChanged(item({ activity: 'Dinner' }), item({ activity: 'Dinner', location: 'Café Einstein' }), members)!.summary)
      .toBe('changed the location of Dinner to Café Einstein');
  });
  it('several fields', () => {
    expect(itineraryChanged(item({ activity: 'Dinner' }), item({ activity: 'Dinner', time: '8:00 PM', location: 'Elsewhere' }), members)!.summary)
      .toBe('updated Dinner (time, location)');
  });
  it('nothing notable → null; audience follows the new item', () => {
    expect(itineraryChanged(item(), item({ sortOrder: 3 }), members)).toBeNull();
    expect(itineraryChanged(item(), item({ time: '8:00 PM', forWho: 'Maya' }), members)!.audience).toEqual(['u-maya']);
  });
  it('removed', () => {
    expect(itineraryRemoved(item({ activity: 'Bike tour', date: '2026-10-02' }), 2, members).summary)
      .toBe('removed Bike tour from Day 2, Fri Oct 2');
  });
});

describe('event-text: flights', () => {
  it('added, someone else\'s flight', () => {
    const r = flightAdded(flight(), 'Maya', 'u-al');
    expect(r.summary).toBe("added Maya's flight SAV → BER, Sat Oct 3 at 10:40 AM");
    expect(r.audience).toBe('all');
  });
  it('added, own flight', () => {
    expect(flightAdded(flight(), 'Maya', 'u-maya').summary).toBe('added their flight SAV → BER, Sat Oct 3 at 10:40 AM');
  });
  it('changed lists the fields; null when nothing notable', () => {
    expect(flightChanged(flight(), flight({ departureTime: '11:00 AM' }), 'Maya', 'u-al')!.summary)
      .toBe("changed Maya's flight SAV → BER (departure time)");
    expect(flightChanged(flight(), flight({ notes: 'x' }), 'Maya', 'u-al')).toBeNull();
  });
  it('removed', () => {
    expect(flightRemoved(flight(), 'Maya', 'u-al').summary).toBe("removed Maya's flight SAV → BER");
  });
});

describe('event-text: stays', () => {
  it('added / changed / removed', () => {
    expect(stayAdded(stay(), members).summary).toBe('added a stay: Hotel Adlon, Oct 3 – 5');
    expect(stayChanged(stay(), stay({ checkOut: '2026-10-06' }), members)!.summary).toBe('changed Hotel Adlon (check-out)');
    expect(stayChanged(stay(), stay({ notes: 'late' }), members)).toBeNull();
    expect(stayRemoved(stay({ forWho: 'Sam' }), members)).toEqual({ summary: 'removed the stay Hotel Adlon', audience: ['u-sam'] });
  });
});

describe('event-text: transport', () => {
  it('added / changed / removed', () => {
    expect(transportAdded(car()).summary).toBe('added a rental car: Hertz, pick-up Sun Oct 4 at 10:00 AM');
    expect(transportAdded(car({ mode: 'Train', company: 'DB' })).summary).toBe('added a train: DB, pick-up Sun Oct 4 at 10:00 AM');
    expect(transportChanged(car(), car({ dropoffTime: '11:00 AM' }))!.summary).toBe('changed the Hertz rental car (drop-off)');
    expect(transportChanged(car(), car({ notes: 'x' }))).toBeNull();
    expect(transportRemoved(car()).summary).toBe('removed the Hertz rental car');
  });
});

describe('event-text: finance', () => {
  it('added by the payer, split with everyone', () => {
    const r = financeAdded(entry(), 'Maya', 'EUR', members);
    expect(r.summary).toBe('added €84.00 for Dinner, split between all of you');
    expect(r.audience).toBe('all');
  });
  it('added by someone else, split between named people', () => {
    const r = financeAdded(entry({ splitAmong: 'Sam, Alayna' }), 'Alayna', 'EUR', members);
    expect(r.summary).toBe('added €84.00 for Dinner, paid by Maya, split between 2 of you');
    expect(r.audience).toEqual(['u-maya', 'u-sam', 'u-al']);
  });
  it('amount changed / split changed / other fields / nothing', () => {
    expect(financeChanged(entry(), entry({ amount: 90 }), 'EUR', members)!.summary).toBe('changed Dinner to €90.00 (was €84.00)');
    expect(financeChanged(entry(), entry({ splitAmong: 'Sam' }), 'EUR', members)!.summary).toBe('changed who splits Dinner');
    expect(financeChanged(entry(), entry({ vendor: 'Café', date: '2026-10-04' }), 'EUR', members)!.summary).toBe('updated Dinner (vendor, date)');
    expect(financeChanged(entry(), entry({ notes: 'x' }), 'EUR', members)).toBeNull();
  });
  it('removed', () => {
    expect(financeRemoved(entry(), 'EUR', members).summary).toBe('removed €84.00 for Dinner');
  });
});

describe('event-text: recs and pins', () => {
  it('recs', () => {
    expect(recAdded(rec())).toEqual({ summary: 'added a rec: Café Einstein (Food)', audience: 'all' });
    expect(recChanged(rec(), rec({ title: 'Einstein Kaffee' }))!.summary).toBe('changed the rec Café Einstein (title)');
    expect(recChanged(rec(), rec())).toBeNull();
    expect(recRemoved(rec()).summary).toBe('removed the rec Café Einstein');
  });
  it('pins', () => {
    expect(pinAdded(pin(), members)).toEqual({ summary: 'pinned Tempelhof Field (Sightseeing)', audience: 'all' });
    expect(pinRemoved(pin({ forWho: 'Maya' }), members)).toEqual({ summary: 'removed the pin Tempelhof Field', audience: ['u-maya'] });
  });
});

describe('event-text: packing, members, trip', () => {
  it('packing suggestions go to one person', () => {
    expect(packingSuggested('rain jacket', 'u-sam')).toEqual({ summary: 'suggested you pack: rain jacket', audience: ['u-sam'] });
    expect(packingAnswered('rain jacket', 'u-maya', true)).toEqual({ summary: 'added your suggestion: rain jacket', audience: ['u-maya'] });
    expect(packingAnswered('rain jacket', 'u-maya', false)).toEqual({ summary: 'passed on your suggestion: rain jacket', audience: ['u-maya'] });
  });
  it('members', () => {
    expect(memberEvent('joined', 'Tess', true).summary).toBe('joined the trip');
    expect(memberEvent('left', 'Tess', true).summary).toBe('left the trip');
    expect(memberEvent('kicked', 'Tess', false).summary).toBe('removed Tess');
    expect(memberEvent('restored', 'Tess', false)).toEqual({ summary: 'added Tess back', audience: 'all' });
  });
  it('trip dates, name, destination; nothing → null', () => {
    expect(tripChanged(trip(), { startDate: '2026-10-03', endDate: '2026-10-11' })).toBeNull();
    expect(tripChanged(trip(), { endDate: '2026-10-12' })!.summary).toBe('changed the trip dates to Oct 3 – 12');
    expect(tripChanged(trip(), { name: 'Berlin 2026' })!.summary).toBe('renamed the trip to Berlin 2026');
    expect(tripChanged(trip(), { destination: 'Munich, Germany' })!.summary).toBe('changed the destination to Munich, Germany');
    expect(tripChanged(trip(), { name: 'B', endDate: '2026-10-12' })!.summary).toBe('updated the trip (name, dates)');
  });
});

describe('update text carries the zone code with every time', () => {
  const members = [{ uid: 'u1', displayName: 'Maya' }];
  const base = { id: 'i', dayLabel: '', endTime: '', location: '', category: '', notes: '', forWho: 'All', addedByUid: 'u1', sortOrder: 0, createdAt: 0 } as any;

  it('itinerary added: the trip zone as of that day', () => {
    const r = itineraryAdded({ ...base, date: '2026-10-02', time: '6:30 PM', activity: 'Sunset' }, 2, members, 'Europe/Lisbon');
    expect(r.summary).toContain('at 6:30 PM WEST');
  });

  it('itinerary time change shows both times with their code', () => {
    const before = { ...base, date: '2026-11-12', time: '11:00 AM', activity: 'Museum' };
    const r = itineraryChanged(before, { ...before, time: '2:00 PM' }, members, 'America/Chicago')!;
    expect(r.summary).toBe('changed Museum to 2:00 PM CST (was 11:00 AM CST)');
  });

  it('flight added: the departure airport zone', () => {
    const f = { uid: 'u1', from: 'ORD', to: 'BER', departureDate: '2026-09-24', departureTime: '4:20 PM' } as any;
    expect(flightAdded(f, 'Makaela', 'u1', 'America/Chicago').summary).toContain('at 4:20 PM CDT');
  });

  it('transport added: the trip zone', () => {
    const c = { company: 'Hertz', mode: 'Rental Car', pickupDate: '2026-10-03', pickupTime: '9:00 AM' } as any;
    expect(transportAdded(c, 'Europe/Vienna').summary).toContain('at 9:00 AM CEST');
  });

  it('stays bare when no zone is known', () => {
    expect(itineraryAdded({ ...base, date: '2026-10-02', time: '6:30 PM', activity: 'Sunset' }, 2, members).summary).toMatch(/at 6:30 PM$/);
  });
});

