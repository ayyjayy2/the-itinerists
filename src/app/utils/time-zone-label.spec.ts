import { zoneLabelOn, zoneLabelAt, planZoneLabel } from './time-zone-label';
import { TripDoc } from '../models/trip.models';

describe('zoneLabelOn', () => {
  const trip = (fields: Partial<TripDoc>) => ({ name: 'T', startDate: '2026-10-01', endDate: '2026-11-20', ...fields }) as TripDoc;

  it("gives the trip's zone code at the plan's own moment (CDT in October, CST in November)", () => {
    const t = trip({ timeZone: 'America/Chicago' });
    expect(zoneLabelOn(t, '2026-10-02', '20:00')).toBe('CDT');
    expect(zoneLabelOn(t, '2026-11-10', '8:00 PM')).toBe('CST');
  });

  it('uses the zone of the stop the date falls in', () => {
    const t = trip({
      timeZone: 'Asia/Bangkok',
      destinations: [
        { destination: 'Lisbon', startDate: '2026-10-01', endDate: '2026-10-10', currency: 'EUR', timeZone: 'Europe/Lisbon' },
        { destination: 'Chicago', startDate: '2026-10-11', endDate: '2026-10-20', currency: 'USD', timeZone: 'America/Chicago' },
      ],
    } as Partial<TripDoc>);
    expect(zoneLabelOn(t, '2026-10-05', '09:00')).toBe('WEST');
    expect(zoneLabelOn(t, '2026-10-15', '09:00')).toBe('CDT');
  });

  it('still labels a plan with no time, by its day', () => {
    expect(zoneLabelOn(trip({ timeZone: 'Asia/Bangkok' }), '2026-11-13')).toBe('ICT');
  });

  it('is empty when the trip has no zone yet', () => {
    expect(zoneLabelOn(trip({}), '2026-11-13', '09:00')).toBe('');
    expect(zoneLabelOn(null, '2026-11-13', '09:00')).toBe('');
  });
});

describe('zoneLabelAt', () => {
  it("gives a zone's code at a day and time, or nothing without a zone", () => {
    expect(zoneLabelAt('America/Chicago', '2026-11-12', '3:50 PM')).toBe('CST');
    expect(zoneLabelAt(undefined, '2026-11-12', '3:50 PM')).toBe('');
  });
});

describe('planZoneLabel', () => {
  const bangkok = { name: 'T', startDate: '2026-11-12', endDate: '2026-11-19', timeZone: 'Asia/Bangkok' } as TripDoc;
  const airports: Record<string, string> = { ORD: 'America/Chicago' };
  const zoneFor = (code: string) => airports[code];

  it("uses the airport's zone for a flight plan that names one (#537)", () => {
    const plan = { date: '2026-11-12', activity: 'Depart Chicago O’Hare', category: 'Transport', location: 'ORD' };
    expect(planZoneLabel(plan, '3:50 PM', bangkok, zoneFor)).toBe('CST');
  });

  it("uses the trip's zone for other plans, and for airports we don't know", () => {
    expect(planZoneLabel({ date: '2026-11-14', activity: 'Khao soi lunch', category: 'Food', location: 'Khao Soi Khun Yai' }, '12:30 PM', bangkok, zoneFor)).toBe('ICT');
    expect(planZoneLabel({ date: '2026-11-12', activity: 'Depart', category: 'Transport', location: 'XYZ' }, '9:00 AM', bangkok, zoneFor)).toBe('ICT');
  });
});
