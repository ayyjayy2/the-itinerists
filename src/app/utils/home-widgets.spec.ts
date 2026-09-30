import { isPageHidden, visibleWidgetKeys, WIDGET_PATHS } from './home-widgets';

describe('home-widgets: isPageHidden', () => {
  it('matches a path against the hidden keys (no leading slash)', () => {
    expect(isPageHidden('/finance', ['finance'])).toBeTrue();
    expect(isPageHidden('/finance', ['map'])).toBeFalse();
    expect(isPageHidden('/accommodations', ['accommodations'])).toBeTrue();
  });
  it('is false for an empty hidden list', () => {
    expect(isPageHidden('/map', [])).toBeFalse();
  });
});

describe('home-widgets: visibleWidgetKeys', () => {
  it('returns every widget in default nav order when nothing is hidden', () => {
    expect(visibleWidgetKeys(undefined, [])).toEqual([
      'itinerary', 'finance', 'packing', 'flights', 'accommodations',
      'transportation', 'expenses', 'recs', 'outfits',
    ]);
  });
  it('drops hidden pages and closes the gap', () => {
    expect(visibleWidgetKeys(undefined, ['finance', 'transportation', 'map'])).toEqual([
      'itinerary', 'packing', 'flights', 'accommodations', 'expenses', 'recs', 'outfits',
    ]);
  });
  it('follows the personal nav order but keeps itinerary first', () => {
    const order = ['/recs', '/packing', '/itinerary', '/finance'];
    expect(visibleWidgetKeys(order, [])).toEqual([
      'itinerary', 'recs', 'packing', 'finance', 'flights', 'accommodations',
      'transportation', 'expenses', 'outfits',
    ]);
  });
  it('never includes map', () => {
    expect(visibleWidgetKeys(['/map'], [])).not.toContain('map' as never);
    expect(Object.keys(WIDGET_PATHS)).not.toContain('map');
  });
});

import {
  nextStay, nextTransport, nextFlight, expensesTotalBetween, recsGlance,
} from './home-widgets';
import { AccommodationDoc, RentalCar, RecDoc, Expense } from '../models/trip.models';
import { FlightMoment } from './flight-events';

const stay = (o: Partial<AccommodationDoc>): AccommodationDoc => ({
  id: 's', name: 'Hotel', address: '', checkIn: '2026-10-03', checkOut: '2026-10-05',
  notes: '', bookingRef: '', forWho: 'All', addedByUid: 'u', createdAt: 0, ...o,
});
const car = (o: Partial<RentalCar>): RentalCar => ({
  company: 'Hertz', confirmationNumber: '', pickupDate: '2026-10-03', pickupTime: '10:00',
  pickupLocation: '', dropoffDate: '2026-10-08', dropoffTime: '09:00', dropoffLocation: '',
  drivers: '', notes: '', ...o,
});
const moment = (o: Partial<FlightMoment>): FlightMoment => ({
  date: '2026-10-03', time: '10:40', label: 'Depart from SAV', kind: 'depart', section: 'DEPARTURES', ...o,
});
const exp = (date: string, amount: number): Expense =>
  ({ id: date + amount, date, description: '', amount, currency: 'USD', category: 'other' });
const rec = (title: string, createdAt: number): RecDoc =>
  ({ id: title, category: 'Food', title, description: '', extra: '', addedByUid: 'u', createdAt });

describe('home-widgets: nextStay', () => {
  it('returns tonight when today is inside a stay', () => {
    const r = nextStay([stay({ name: 'Adlon' })], '2026-10-04');
    expect(r).toEqual(jasmine.objectContaining({ kind: 'tonight' }));
    expect(r!.stay.name).toBe('Adlon');
  });
  it('check-out day is not a night there', () => {
    expect(nextStay([stay({})], '2026-10-05')).toBeNull();
  });
  it('returns the earliest upcoming check-in otherwise', () => {
    const r = nextStay([stay({ name: 'Late', checkIn: '2026-10-10', checkOut: '2026-10-12' }),
                        stay({ name: 'Soon', checkIn: '2026-10-06', checkOut: '2026-10-07' })], '2026-10-01');
    expect(r!.kind).toBe('next');
    expect(r!.stay.name).toBe('Soon');
  });
  it('is null with no stays or only past stays', () => {
    expect(nextStay([], '2026-10-01')).toBeNull();
    expect(nextStay([stay({})], '2026-11-01')).toBeNull();
  });
});

describe('home-widgets: nextTransport', () => {
  it('picks the earliest pick-up or drop-off on or after today', () => {
    const r = nextTransport([car({})], '2026-10-01');
    expect(r).toEqual(jasmine.objectContaining({ kind: 'pickup', date: '2026-10-03', time: '10:00', company: 'Hertz' }));
  });
  it('rolls to the drop-off once the pick-up has passed', () => {
    const r = nextTransport([car({})], '2026-10-04');
    expect(r).toEqual(jasmine.objectContaining({ kind: 'dropoff', date: '2026-10-08' }));
  });
  it('carries the mode, defaulting to Rental Car', () => {
    expect(nextTransport([car({})], '2026-10-01')!.mode).toBe('Rental Car');
    expect(nextTransport([car({ mode: 'Train', company: 'DB' })], '2026-10-01')!.mode).toBe('Train');
  });
  it('is null with nothing upcoming', () => {
    expect(nextTransport([], '2026-10-01')).toBeNull();
    expect(nextTransport([car({})], '2026-10-09')).toBeNull();
  });
});

describe('home-widgets: nextFlight', () => {
  it('returns the soonest moment on or after today with the day count', () => {
    const r = nextFlight([moment({ date: '2026-10-05' }), moment({ date: '2026-10-03' })], '2026-10-01');
    expect(r!.moment.date).toBe('2026-10-03');
    expect(r!.inDays).toBe(2);
  });
  it('orders same-day moments by time', () => {
    const r = nextFlight([moment({ time: '3:00 PM' }), moment({ time: '10:40 AM', label: 'first' })], '2026-10-03');
    expect(r!.moment.label).toBe('first');
    expect(r!.inDays).toBe(0);
  });
  it('is null with no upcoming moments', () => {
    expect(nextFlight([], '2026-10-01')).toBeNull();
    expect(nextFlight([moment({})], '2026-10-04')).toBeNull();
  });
});

describe('home-widgets: expensesTotalBetween', () => {
  it('sums expenses dated inside the trip window, inclusive', () => {
    const list = [exp('2026-10-01', 10), exp('2026-10-03', 20), exp('2026-10-09', 40), exp('2026-09-30', 80)];
    expect(expensesTotalBetween(list, '2026-10-01', '2026-10-09')).toBe(70);
  });
  it('sums everything when the trip has no dates', () => {
    expect(expensesTotalBetween([exp('2026-01-01', 5), exp('2027-01-01', 6)], '', '')).toBe(11);
  });
});

describe('home-widgets: recsGlance', () => {
  it('counts recs and names the newest', () => {
    expect(recsGlance([rec('Old', 1), rec('New', 9), rec('Mid', 5)])).toEqual({ count: 3, latest: 'New' });
  });
  it('is zero/empty with no recs', () => {
    expect(recsGlance([])).toEqual({ count: 0, latest: '' });
  });
});
