import { MemoryStore } from './memory-store';
import { seedDemo } from './seed';
import { DEMO_UID, DEMO_TRIP_ID } from './seed-constants';

describe('seedDemo', () => {
  let store: MemoryStore;
  beforeEach(() => { store = new MemoryStore(); seedDemo(store); });

  const trip = (...s: string[]) => ['trips', DEMO_TRIP_ID, ...s].join('/');

  it('signs the demo traveller into a trip they own', () => {
    const user = store.get(`users/${DEMO_UID}`);
    expect(user?.['displayName']).toBe('Alayna');
    expect(user?.['isAdmin']).toBe(false);
    const index = store.get(`userTrips/${DEMO_UID}`);
    expect(index?.['tripIds']).toEqual([DEMO_TRIP_ID]);
    expect(index?.['lastActiveTrip']).toBe(DEMO_TRIP_ID);
    expect(store.get(trip('members', DEMO_UID))?.['role']).toBe('owner');
  });

  it('keeps memberCount in step with the members collection', () => {
    const members = store.list(trip('members'));
    expect(store.get(trip())?.['memberCount']).toBe(members.length);
    expect(members.length).toBe(4);
    members.forEach(m => expect(store.has(`users/${m.id}`)).toBe(true));
  });

  it('seeds every sub-collection the pages read', () => {
    for (const name of ['itinerary', 'flights', 'stays', 'finance', 'recs', 'cars', 'pins', 'packingSuggestions', 'activityLog']) {
      expect(store.list(trip(name)).length).withContext(name).toBeGreaterThan(0);
    }
    expect(store.has(trip('packing', DEMO_UID))).toBe(true);
    expect(store.has(trip('dayLabels', DEMO_UID))).toBe(true);
    expect(store.has(`userExpenses/${DEMO_UID}`)).toBe(true);
  });

  it('dates every itinerary row inside the trip window and orders each day from zero', () => {
    const tripDoc = store.get(trip())!;
    const start = tripDoc['startDate'] as string;
    const end = tripDoc['endDate'] as string;
    const byDay = new Map<string, number[]>();
    for (const { data } of store.list(trip('itinerary'))) {
      const date = data['date'] as string;
      expect(date >= start && date <= end).withContext(data['activity'] as string).toBe(true);
      byDay.set(date, [...(byDay.get(date) ?? []), data['sortOrder'] as number]);
    }
    for (const [date, orders] of byDay) {
      expect([...orders].sort((a, b) => a - b)).withContext(date).toEqual(orders.map((_, i) => i));
    }
  });

  it('only references members in forWho and paidBy', () => {
    const names = new Set(store.list(trip('members')).map(m => m.data['displayName'] as string));
    const check = (who: string) => who.split(',').map(s => s.trim()).forEach(n => {
      if (n !== 'All') expect(names.has(n)).withContext(n).toBe(true);
    });
    store.list(trip('itinerary')).forEach(d => check(d.data['forWho'] as string));
    store.list(trip('finance')).forEach(d => { check(d.data['splitAmong'] as string); check(d.data['paidBy'] as string); });
  });
});
