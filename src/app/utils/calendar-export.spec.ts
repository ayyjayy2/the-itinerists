import { buildIcs, tripCalendarEvents, isForMe, icsFileName, zoneOnDate } from './calendar-export';

const trip: any = {
  id: 't', name: 'Central America Tour 🗺️✨', destination: 'Panama', startDate: '2026-10-01', endDate: '2026-10-15',
  destinations: [
    { destination: 'Panama', startDate: '2026-10-01', endDate: '2026-10-05', timeZone: 'America/Panama' },
    { destination: 'Costa Rica', startDate: '2026-10-06', endDate: '2026-10-09', timeZone: 'America/Costa_Rica' },
  ],
};
const me = { uid: 'me', name: 'Alayna' };
const base = { trip, me, items: [], flights: [], stays: [], transport: [], airportZone: (c: string) => ({ ORD: 'America/Chicago', PTY: 'America/Panama' } as any)[c] };

describe('calendar export', () => {
  it('reads "for" fields like the My Trip view', () => {
    expect(isForMe('All', 'Alayna')).toBeTrue();
    expect(isForMe('', 'Alayna')).toBeTrue();
    expect(isForMe('Maya, alayna', 'Alayna')).toBeTrue();
    expect(isForMe('Maya, Rafa', 'Alayna')).toBeFalse();
  });

  it('puts an item at its stop\'s time: 7:00 PM in Costa Rica is 01:00 UTC next day', () => {
    expect(zoneOnDate(trip, '2026-10-07')).toBe('America/Costa_Rica');
    const ev = tripCalendarEvents({ ...base, items: [{ id: 'i1', date: '2026-10-07', time: '7:00 PM', endTime: '', activity: 'Dinner', location: 'San José', category: 'Food', notes: '', forWho: 'All' } as any] });
    expect(ev.length).toBe(1);
    expect(ev[0].start).toEqual({ allDay: false, ms: Date.UTC(2026, 9, 8, 1, 0) });
    expect(ev[0].end).toEqual({ allDay: false, ms: Date.UTC(2026, 9, 8, 2, 0) });   // an hour when no end time
  });

  it('skips items for other people and an item without a time becomes all-day', () => {
    const ev = tripCalendarEvents({ ...base, items: [
      { id: 'a', date: '2026-10-02', time: '', endTime: '', activity: 'Canal day', location: '', category: 'Sightseeing', notes: '', forWho: 'All' },
      { id: 'b', date: '2026-10-02', time: '9:00 AM', endTime: '', activity: 'Surf lesson', location: '', category: 'Activity', notes: '', forWho: 'Maya' },
    ] as any });
    expect(ev.map(e => e.title)).toEqual(['Canal day']);
    expect(ev[0].start).toEqual({ allDay: true, date: '2026-10-02' });
    expect(ev[0].end).toEqual({ allDay: true, date: '2026-10-03' });
  });

  it('times a flight in each airport\'s zone and drops a hand-typed copy of it', () => {
    const ev = tripCalendarEvents({ ...base,
      flights: [{ id: 'f1', uid: 'me', from: 'ORD', to: 'PTY', flightNumber: 'CM 351', airline: 'Copa', departureDate: '2026-10-03', departureTime: '11:30 AM', arrivalDate: '2026-10-03', arrivalTime: '5:40 PM', notes: '' } as any,
                { id: 'f2', uid: 'someone', from: 'ORD', to: 'PTY', departureDate: '2026-10-03', departureTime: '9:00 AM' } as any],
      items: [{ id: 'x', date: '2026-10-03', time: '11:30 AM', endTime: '', activity: 'Depart from ORD', category: 'Travel', location: '', notes: '', forWho: 'All' } as any] });
    expect(ev.map(e => e.title)).toEqual(['✈ ORD → PTY · CM 351']);
    expect(ev[0].start).toEqual({ allDay: false, ms: Date.UTC(2026, 9, 3, 16, 30) });   // 11:30 CDT
    expect(ev[0].end).toEqual({ allDay: false, ms: Date.UTC(2026, 9, 3, 22, 40) });     // 17:40 Panama (UTC-5)
  });

  it('a stay spans check-in through the check-out day', () => {
    const ev = tripCalendarEvents({ ...base, stays: [{ id: 's', name: 'Casa Azul', address: 'Casco Viejo', checkIn: '2026-10-01', checkOut: '2026-10-05', checkInTime: '3:00 PM', forWho: 'All', notes: '', bookingRef: 'ABC' } as any] });
    expect(ev[0]).toEqual(jasmine.objectContaining({ title: '🛏 Casa Azul', start: { allDay: true, date: '2026-10-01' }, end: { allDay: true, date: '2026-10-06' } }));
  });

  it('writes a valid calendar file: escaped text, CRLF, folded long lines', () => {
    const ics = buildIcs('Trip; with, commas', [
      { uid: 'item-1', title: 'Dinner, drinks; more', start: { allDay: false, ms: Date.UTC(2026, 9, 8, 1) }, end: { allDay: false, ms: Date.UTC(2026, 9, 8, 2) }, description: 'x'.repeat(120) },
      { uid: 'stay-1', title: 'Stay', start: { allDay: true, date: '2026-10-01' }, end: { allDay: true, date: '2026-10-06' } },
    ], Date.UTC(2026, 9, 2));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBeTrue();
    expect(ics).toContain('X-WR-CALNAME:Trip\; with\\, commas');
    expect(ics).toContain('SUMMARY:Dinner\\, drinks\; more');
    expect(ics).toContain('DTSTART:20261008T010000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261001');
    expect(ics).toContain('DTEND;VALUE=DATE:20261006');
    expect(ics).toContain('UID:item-1@theitinerists.com');
    expect(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBeTrue();
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBeTrue();
  });

  it('names the file after the trip', () => {
    expect(icsFileName('Central America Tour 🗺️✨')).toBe('central-america-tour.ics');
    expect(icsFileName('🎉')).toBe('trip.ics');
  });
});
