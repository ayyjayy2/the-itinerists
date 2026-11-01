import { buildShareView, newShareToken } from './share-view';
import { AccommodationDoc, FlightDoc, ItineraryItemDoc, TripDoc, TripMember } from '../models/trip.models';

describe('share view (#611)', () => {
  const trip = {
    id: 't', name: 'Chiang Mai, November', startDate: '2026-11-12', endDate: '2026-11-19', currency: 'THB',
    destination: 'Chiang Mai, Thailand', timeZone: 'Asia/Bangkok',
    destinations: [{ destination: 'Chiang Mai, Thailand', startDate: '2026-11-12', endDate: '2026-11-19', currency: 'THB', timeZone: 'Asia/Bangkok' }],
  } as unknown as TripDoc;
  const members = [
    { uid: 'a', displayName: 'Maya Lopez', avatarEmoji: '🌸', color: '#fff', role: 'owner', joinedAt: 0 },
    { uid: 'b', displayName: 'Theo', avatarEmoji: 'T', color: '#000', avatarLetterColor: '#fff', role: 'member', joinedAt: 0 },
  ] as TripMember[];
  const itinerary = [
    { id: '2', date: '2026-11-13', time: '7:00 PM', endTime: '9:00 PM', activity: 'Night market', location: 'Wualai Road', notes: 'bring cash, code 4412', forWho: 'All', sortOrder: 2 },
    { id: '1', date: '2026-11-13', time: '', endTime: '', activity: 'Temple walk', location: 'Old City', notes: '', forWho: 'All', sortOrder: 1 },
  ] as ItineraryItemDoc[];
  const flights = [{
    id: 'f', uid: 'a', section: 'ARRIVALS', airline: 'Thai Airways', flightNumber: 'TG110', from: 'BKK', to: 'CNX',
    departureDate: '2026-11-12', departureTime: '8:30 AM', arrivalDate: '2026-11-12', arrivalTime: '9:45 AM', notes: 'seat 4A', createdAt: 0,
  }] as FlightDoc[];
  const stays = [{
    id: 's', name: 'Baan Nimman Guesthouse', address: '12 Nimman Soi 7, Chiang Mai', checkIn: '2026-11-12', checkOut: '2026-11-15',
    notes: 'door code 9876', bookingRef: 'ABC123', link: 'https://example.com', forWho: 'All',
  }] as AccommodationDoc[];
  const view = buildShareView({ trip, members, itinerary, flights, stays, airportZone: () => 'Asia/Bangkok' });

  it('words the trip, its places and people for display', () => {
    expect(view.tripName).toBe('Chiang Mai, November');
    expect(view.dates).toBe('Nov 12 – 19');
    expect(view.places).toEqual(['Chiang Mai, Thailand']);
    expect(view.people.map(p => p.name)).toEqual(['Maya', 'Theo']);
  });

  it('lists each day in order, with times and their zone code', () => {
    expect(view.days.length).toBe(1);
    expect(view.days[0].label).toBe('Fri, Nov 13');
    expect(view.days[0].items).toEqual([
      { time: '', title: 'Temple walk', place: 'Old City' },
      { time: '7:00 PM – 9:00 PM ICT', title: 'Night market', place: 'Wualai Road' },
    ]);
  });

  it('gives flights with who, route and zoned times', () => {
    expect(view.flights).toEqual([{
      who: 'Maya', flight: 'Thai Airways TG110', route: 'BKK → CNX', departs: 'Nov 12, 8:30 AM ICT', arrives: 'Nov 12, 9:45 AM ICT',
    }]);
  });

  it('puts flights in time order, not text order', () => {
    const late = { ...flights[0], id: 'g', uid: 'b', departureTime: '11:10 PM' };
    const early = { ...flights[0], id: 'h', uid: 'b', departureTime: '3:50 PM' };
    const v = buildShareView({ trip, members, itinerary: [], flights: [late, early], stays: [], airportZone: () => 'Asia/Bangkok' });
    expect(v.flights.map(f => f.departs)).toEqual(['Nov 12, 3:50 PM ICT', 'Nov 12, 11:10 PM ICT']);
  });

  it('shows where people stay by town, never the address', () => {
    expect(view.stays).toEqual([{ name: 'Baan Nimman Guesthouse', where: 'Chiang Mai', dates: 'Nov 12 – 15' }]);
  });

  it('never carries notes, booking references, links or addresses', () => {
    const text = JSON.stringify(view);
    for (const secret of ['code 4412', 'seat 4A', 'door code', 'ABC123', 'example.com', 'Soi 7']) expect(text).not.toContain(secret);
  });

  it('makes long random tokens', () => {
    const t = newShareToken();
    expect(t).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(newShareToken()).not.toBe(t);
  });
});
