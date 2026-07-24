import { tripSummary, tripDestinations } from './trip-destinations';
import { TripDestination, TripDoc } from '../models/trip.models';

const leg = (over: Partial<TripDestination> = {}): TripDestination => ({
  destination: 'Paris', startDate: '2026-03-02', endDate: '2026-03-06', currency: 'EUR', ...over,
});

describe('tripSummary', () => {
  it('mirrors the single destination', () => {
    const s = tripSummary([leg()]);
    expect(s).toEqual(jasmine.objectContaining({
      destination: 'Paris', startDate: '2026-03-02', endDate: '2026-03-06', currency: 'EUR',
    }));
  });

  it('takes the primary from the first leg and the overall range across legs', () => {
    const s = tripSummary([
      leg({ destination: 'Paris',  startDate: '2026-03-02', endDate: '2026-03-06', currency: 'EUR' }),
      leg({ destination: 'London', startDate: '2026-03-01', endDate: '2026-03-10', currency: 'GBP' }),
    ]);
    expect(s.destination).toBe('Paris');   // primary = first leg
    expect(s.currency).toBe('EUR');        // primary currency
    expect(s.startDate).toBe('2026-03-01'); // earliest across legs
    expect(s.endDate).toBe('2026-03-10');   // latest across legs
  });

  it('carries the primary leg coords/placeId when present', () => {
    const s = tripSummary([leg({ destinationCoords: { lat: 48.8, lng: 2.3 }, destinationPlaceId: 'p1' })]);
    expect(s.destinationCoords).toEqual({ lat: 48.8, lng: 2.3 });
    expect(s.destinationPlaceId).toBe('p1');
  });
});

describe('tripDestinations', () => {
  it('returns the stored array when present', () => {
    const legs = [leg({ destination: 'Rome' })];
    const trip = { destinations: legs, destination: 'Rome', startDate: '2026-03-02', endDate: '2026-03-06', currency: 'EUR' } as TripDoc;
    expect(tripDestinations(trip)).toEqual(legs);
  });

  it('derives a one-element array from flat fields for legacy trips', () => {
    const trip = {
      destination: 'Lisbon', startDate: '2026-05-01', endDate: '2026-05-08', currency: 'EUR',
      destinationCoords: { lat: 38.7, lng: -9.1 },
    } as TripDoc;
    const legs = tripDestinations(trip);
    expect(legs.length).toBe(1);
    expect(legs[0]).toEqual(jasmine.objectContaining({
      destination: 'Lisbon', startDate: '2026-05-01', endDate: '2026-05-08', currency: 'EUR',
      destinationCoords: { lat: 38.7, lng: -9.1 },
    }));
  });
});
