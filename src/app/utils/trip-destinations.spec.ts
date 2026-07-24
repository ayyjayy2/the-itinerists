import { tripSummary, tripDestinations, activeLeg, buildEditedDestinations } from './trip-destinations';
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

describe('activeLeg', () => {
  const legs = [
    leg({ destination: 'Paris',  startDate: '2026-03-01', endDate: '2026-03-05' }),
    leg({ destination: 'Rome',   startDate: '2026-03-05', endDate: '2026-03-10' }),
    leg({ destination: 'Lisbon', startDate: '2026-03-10', endDate: '2026-03-15' }),
  ];

  it('returns the leg whose range contains today', () => {
    expect(activeLeg(legs, '2026-03-07').destination).toBe('Rome');
  });

  it('is inclusive of the start and end dates', () => {
    expect(activeLeg(legs, '2026-03-01').destination).toBe('Paris');
    expect(activeLeg(legs, '2026-03-15').destination).toBe('Lisbon');
  });

  it('returns the next upcoming leg before the trip starts', () => {
    expect(activeLeg(legs, '2026-02-20').destination).toBe('Paris');
  });

  it('returns the next upcoming leg in a gap between legs', () => {
    const gapped = [
      leg({ destination: 'Paris', startDate: '2026-03-01', endDate: '2026-03-05' }),
      leg({ destination: 'Rome',  startDate: '2026-03-20', endDate: '2026-03-25' }),
    ];
    expect(activeLeg(gapped, '2026-03-10').destination).toBe('Rome');
  });

  it('returns the last leg when the whole trip is past', () => {
    expect(activeLeg(legs, '2026-05-01').destination).toBe('Lisbon');
  });

  it('returns the only leg for a single-destination trip', () => {
    expect(activeLeg([leg({ destination: 'Bali' })], '2020-01-01').destination).toBe('Bali');
  });
});

describe('buildEditedDestinations', () => {
  it('trims destination text and carries dates/currency', () => {
    const [d] = buildEditedDestinations([
      { destination: '  Paris, France  ', startDate: '2026-03-01', endDate: '2026-03-05', currency: 'EUR' },
    ]);
    expect(d).toEqual({ destination: 'Paris, France', startDate: '2026-03-01', endDate: '2026-03-05', currency: 'EUR' });
  });

  it('preserves coords when the destination text is unchanged', () => {
    const original = leg({ destination: 'Rome, Italy', destinationCoords: { lat: 41.9, lng: 12.5 }, destinationPlaceId: 'p1' });
    const [d] = buildEditedDestinations([
      { destination: 'Rome, Italy', startDate: '2026-03-05', endDate: '2026-03-10', currency: 'EUR', original },
    ]);
    expect(d.destinationCoords).toEqual({ lat: 41.9, lng: 12.5 });
    expect(d.destinationPlaceId).toBe('p1');
  });

  it('drops coords when the destination text changed', () => {
    const original = leg({ destination: 'Rome, Italy', destinationCoords: { lat: 41.9, lng: 12.5 }, destinationPlaceId: 'p1' });
    const [d] = buildEditedDestinations([
      { destination: 'Milan, Italy', startDate: '2026-03-05', endDate: '2026-03-10', currency: 'EUR', original },
    ]);
    expect(d.destinationCoords).toBeUndefined();
    expect(d.destinationPlaceId).toBeUndefined();
  });

  it('leaves a brand-new row (no original) without coords', () => {
    const [d] = buildEditedDestinations([
      { destination: 'Lisbon', startDate: '2026-03-10', endDate: '2026-03-15', currency: 'EUR' },
    ]);
    expect(d.destinationCoords).toBeUndefined();
  });
});
