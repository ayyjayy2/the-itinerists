import { planCalendarSync, toNative, tagFor, ExistingEvent } from './calendar-sync';
import { CalEvent } from './calendar-export';

const T = 'trip1';
const dinner: CalEvent = { uid: 'item-a', title: 'Dinner', start: { allDay: false, ms: Date.UTC(2026, 9, 8, 1) }, end: { allDay: false, ms: Date.UTC(2026, 9, 8, 2) }, location: 'San José' };
const flight: CalEvent = { uid: 'flight-f', title: '✈ ORD → PTY', start: { allDay: false, ms: Date.UTC(2026, 9, 3, 16, 30) }, end: { allDay: false, ms: Date.UTC(2026, 9, 3, 22, 40) } };
const asExisting = (e: CalEvent, id: string, tweak: Partial<ExistingEvent> = {}): ExistingEvent => {
  const n = toNative(e, T);
  return { id, title: n.title, startDate: n.startDate, endDate: n.endDate, isAllDay: n.isAllDay, location: n.location ?? null, description: n.description, ...tweak };
};

describe('planCalendarSync', () => {
  it('first time: adds everything', () => {
    const p = planCalendarSync([dinner, flight], [], T);
    expect(p.create.length).toBe(2);
    expect(p.create[0].description).toContain(tagFor(T, 'item-a'));
    expect(p.update.length + p.remove.length).toBe(0);
  });

  it('adding again with nothing changed: no duplicates, nothing touched', () => {
    const p = planCalendarSync([dinner, flight], [asExisting(dinner, 'e1'), asExisting(flight, 'e2')], T);
    expect(p).toEqual({ create: [], update: [], remove: [], unchanged: 2 });
  });

  it('a changed time updates the same event instead of adding a copy', () => {
    const later = { ...dinner, start: { allDay: false as const, ms: Date.UTC(2026, 9, 8, 2) }, end: { allDay: false as const, ms: Date.UTC(2026, 9, 8, 3) } };
    const p = planCalendarSync([later], [asExisting(dinner, 'e1')], T);
    expect(p.create.length).toBe(0);
    expect(p.update.map(u => u.id)).toEqual(['e1']);
  });

  it('removes events deleted from the trip and stray copies, never anyone else\'s', () => {
    const mine = { id: 'own', title: 'Dentist', startDate: 0, endDate: 0, isAllDay: false, location: null, description: 'bring forms' };
    const otherTrip = asExisting(dinner, 'o1', { description: 'Added by The Itinerists · itinerists:trip2:item-a' });
    const p = planCalendarSync([dinner], [asExisting(dinner, 'e1'), asExisting(dinner, 'e1-copy'), asExisting(flight, 'e2'), mine, otherTrip], T);
    expect(p.remove.sort()).toEqual(['e1-copy', 'e2']);
    expect(p.unchanged).toBe(1);
  });

  it('all-day events cover their days in local time', () => {
    const stay: CalEvent = { uid: 'stay-s', title: 'Casa Azul', start: { allDay: true, date: '2026-10-01' }, end: { allDay: true, date: '2026-10-06' } };
    const n = toNative(stay, T);
    expect(n.isAllDay).toBeTrue();
    expect(n.startDate).toBe(new Date(2026, 9, 1).getTime());
    expect(new Date(n.endDate).getDate()).toBe(5);    // through Oct 5, the check-out day
  });
});
