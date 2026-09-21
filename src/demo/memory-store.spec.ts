import { MemoryStore, FieldTransform } from './memory-store';

const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('MemoryStore', () => {
  let store: MemoryStore;
  beforeEach(() => { store = new MemoryStore(); });

  it('sets and gets a document', () => {
    store.set('trips/t1', { name: 'Chiang Mai' });
    expect(store.get('trips/t1')).toEqual({ name: 'Chiang Mai' });
    expect(store.get('trips/nope')).toBeUndefined();
  });

  it('returns copies so callers cannot mutate stored data', () => {
    store.set('trips/t1', { tags: ['a'] });
    const read = store.get('trips/t1') as { tags: string[] };
    read.tags.push('b');
    expect(store.get('trips/t1')).toEqual({ tags: ['a'] });
  });

  it('set without merge replaces the whole document', () => {
    store.set('trips/t1', { name: 'A', currency: 'THB' });
    store.set('trips/t1', { name: 'B' });
    expect(store.get('trips/t1')).toEqual({ name: 'B' });
  });

  it('set with merge deep-merges nested maps', () => {
    store.set('trips/t1/dayLabels/u1', { dayLabels: { '2026-11-12': 'Arrive' } });
    store.set('trips/t1/dayLabels/u1', { dayLabels: { '2026-11-13': 'Temples' } }, true);
    expect(store.get('trips/t1/dayLabels/u1')).toEqual({
      dayLabels: { '2026-11-12': 'Arrive', '2026-11-13': 'Temples' },
    });
  });

  it('update merges shallowly and rejects a missing document', () => {
    store.set('trips/t1', { name: 'A', memberCount: 1 });
    store.update('trips/t1', { name: 'B' });
    expect(store.get('trips/t1')).toEqual({ name: 'B', memberCount: 1 });
    expect(() => store.update('trips/missing', { name: 'x' })).toThrowError(/No document/);
  });

  it('applies increment, arrayUnion and arrayRemove transforms', () => {
    store.set('trips/t1', { memberCount: 1, ids: ['a'] });
    store.update('trips/t1', {
      memberCount: FieldTransform.increment(2),
      ids: FieldTransform.arrayUnion('b', 'a'),
    });
    expect(store.get('trips/t1')).toEqual({ memberCount: 3, ids: ['a', 'b'] });
    store.update('trips/t1', { ids: FieldTransform.arrayRemove('a') });
    expect(store.get('trips/t1')).toEqual({ memberCount: 3, ids: ['b'] });
  });

  it('transforms work on set-with-merge when the field is absent', () => {
    store.set('userTrips/u1', { tripIds: FieldTransform.arrayUnion('t1'), lastActiveTrip: 't1' }, true);
    expect(store.get('userTrips/u1')).toEqual({ tripIds: ['t1'], lastActiveTrip: 't1' });
  });

  it('deletes a document', () => {
    store.set('trips/t1', { name: 'A' });
    store.delete('trips/t1');
    expect(store.get('trips/t1')).toBeUndefined();
  });

  it('lists only direct children of a collection, ordered by id', () => {
    store.set('trips/b', { n: 2 });
    store.set('trips/a', { n: 1 });
    store.set('trips/a/members/m1', { uid: 'm1' });
    expect(store.list('trips').map(d => d.id)).toEqual(['a', 'b']);
    expect(store.list('trips/a/members').map(d => d.id)).toEqual(['m1']);
    expect(store.list('nothing')).toEqual([]);
  });

  it('filters a collection with where clauses', () => {
    store.set('users/1', { username: 'alayna', n: 1 });
    store.set('users/2', { username: 'maya', n: 2 });
    store.set('users/3', { username: 'theo', n: 3 });
    expect(store.list('users', [{ field: 'username', op: '==', value: 'maya' }]).map(d => d.id)).toEqual(['2']);
    expect(store.list('users', [{ field: 'n', op: '>=', value: 2 }]).map(d => d.id)).toEqual(['2', '3']);
    expect(store.list('users', [{ field: 'username', op: 'in', value: ['alayna', 'theo'] }]).map(d => d.id)).toEqual(['1', '3']);
  });

  it('generates 20-character auto ids that are unique', () => {
    const ids = new Set(Array.from({ length: 50 }, () => store.autoId()));
    expect(ids.size).toBe(50);
    ids.forEach(id => expect(id).toMatch(/^[A-Za-z0-9]{20}$/));
  });

  it('notifies a document listener on first subscribe and on change, asynchronously', async () => {
    const seen: unknown[] = [];
    const unsub = store.watchDoc('trips/t1', d => seen.push(d));
    expect(seen).toEqual([]);
    await flush();
    expect(seen).toEqual([undefined]);
    store.set('trips/t1', { name: 'A' });
    await flush();
    expect(seen).toEqual([undefined, { name: 'A' }]);
    unsub();
    store.set('trips/t1', { name: 'B' });
    await flush();
    expect(seen.length).toBe(2);
  });

  it('notifies a collection listener when any direct child changes, not for grandchildren', async () => {
    const seen: number[] = [];
    store.set('trips/t1/members/m1', { uid: 'm1' });
    store.watchCollection('trips/t1/members', [], docs => seen.push(docs.length));
    await flush();
    expect(seen).toEqual([1]);
    store.set('trips/t1/members/m2', { uid: 'm2' });
    store.set('trips/t1/members/m2/deep/x', { y: 1 });
    await flush();
    expect(seen).toEqual([1, 2]);
    store.delete('trips/t1/members/m1');
    await flush();
    expect(seen).toEqual([1, 2, 1]);
  });

  it('coalesces several writes in one tick into one notification', async () => {
    const seen: number[] = [];
    store.watchCollection('trips/t1/itinerary', [], docs => seen.push(docs.length));
    await flush();
    store.set('trips/t1/itinerary/a', { n: 1 });
    store.set('trips/t1/itinerary/b', { n: 2 });
    store.set('trips/t1/itinerary/c', { n: 3 });
    await flush();
    expect(seen).toEqual([0, 3]);
  });

  it('applies a batch atomically in order', () => {
    store.set('trips/t1', { memberCount: 2 });
    store.set('trips/t1/members/m1', { uid: 'm1' });
    store.batch([
      { kind: 'delete', path: 'trips/t1/members/m1' },
      { kind: 'update', path: 'trips/t1', data: { memberCount: FieldTransform.increment(-1) } },
      { kind: 'set', path: 'trips/t1/activityLog/l1', data: { action: 'member_removed' } },
    ]);
    expect(store.get('trips/t1/members/m1')).toBeUndefined();
    expect(store.get('trips/t1')).toEqual({ memberCount: 1 });
    expect(store.get('trips/t1/activityLog/l1')).toEqual({ action: 'member_removed' });
  });
});
