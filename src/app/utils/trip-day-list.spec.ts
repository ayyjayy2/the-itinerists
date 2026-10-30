import { bookingDatesFor, everyDay, tripDayList } from './trip-day-list';

// The demo trip: Nov 12 – 19. You set off from home on Nov 12, land in
// Chiang Mai on Nov 13 and fly home on Nov 19.
const tripDays = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
const myFlights = [
  { section: 'ARRIVALS',   departureDate: '2026-11-12', arrivalDate: '2026-11-13' },
  { section: 'DEPARTURES', departureDate: '2026-11-19', arrivalDate: '2026-11-19' },
];

describe('tripDayList', () => {
  it('in My Trip, starts on the day you set off, not the day you land', () => {
    const days = tripDayList({ tripDays, plans: [], bookingDates: [], myFlights, showAll: false });
    expect(days[0]).toBe('2026-11-12');
    expect(days.at(-1)).toBe('2026-11-19');
  });

  it('in My Trip, leaves out days outside your travel, unless you have plans that day', () => {
    const early = { section: 'ARRIVALS', departureDate: '2026-11-14', arrivalDate: '2026-11-14' };
    const days = tripDayList({
      tripDays, myFlights: [early, myFlights[1]], bookingDates: [], showAll: false,
      plans: [{ date: '2026-11-12', mine: false }, { date: '2026-11-13', mine: true }],
    });
    expect(days).not.toContain('2026-11-12');    // someone else's plan, before you arrive
    expect(days).toContain('2026-11-13');        // your own plan, so it shows
    expect(days[1]).toBe('2026-11-14');
  });

  it('adds days with plans or bookings outside the trip\'s dates', () => {
    const days = tripDayList({ tripDays, myFlights, showAll: true,
      plans: [{ date: '2026-11-21', mine: false }], bookingDates: ['2026-11-11'] });
    expect(days[0]).toBe('2026-11-11');
    expect(days.at(-1)).toBe('2026-11-21');
  });

  it('shows every day in All, or when you have no flights', () => {
    expect(tripDayList({ tripDays, plans: [], bookingDates: [], myFlights, showAll: true })).toEqual(tripDays);
    expect(tripDayList({ tripDays, plans: [], bookingDates: [], myFlights: [], showAll: false })).toEqual(tripDays);
  });
});

describe('bookingDatesFor', () => {
  it('counts your flights (landing out, taking off home), your stays and every ride', () => {
    const flights = [
      { uid: 'me',  section: 'ARRIVALS',   departureDate: '2026-11-12', arrivalDate: '2026-11-13' },
      { uid: 'me',  section: 'DEPARTURES', departureDate: '2026-11-19', arrivalDate: '2026-11-20' },
      { uid: 'you', section: 'ARRIVALS',   departureDate: '2026-11-10', arrivalDate: '2026-11-11' },
    ];
    const stays = [
      { name: 'Baan Nimman', forWho: 'All', checkIn: '2026-11-13', checkOut: '2026-11-16' },
      { name: 'Not mine',    forWho: 'Theo', checkIn: '2026-11-09', checkOut: '2026-11-10' },
    ];
    const cars = [{ company: 'Grab', pickupDate: '2026-11-14', dropoffDate: '' }, { company: '', pickupDate: '2026-11-08' }];
    expect(bookingDatesFor(flights, stays, cars, 'me', 'Alayna').sort())
      .toEqual(['2026-11-13', '2026-11-13', '2026-11-14', '2026-11-16', '2026-11-19']);
  });
});

describe('everyDay', () => {
  it('lists each date from the first to the last, across a month end', () => {
    expect(everyDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('counts calendar days, whatever the phone\'s time zone (no shift east of UTC)', () => {
    expect(everyDay('2026-11-12', '2026-11-12')).toEqual(['2026-11-12']);
    expect(everyDay('2026-11-13', '2026-11-12')).toEqual([]);
  });
});
