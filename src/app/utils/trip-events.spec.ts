import { CollapseTracker, COLLAPSE_WINDOW_MS, eventsForMe, isFor, unseenEvents } from './trip-events';
import { TripEvent } from '../models/trip.models';

const ev = (o: Partial<TripEvent>): TripEvent => ({
  id: 'e', kind: 'itinerary', action: 'added', actorUid: 'other', actorName: 'Pat', itemId: 'i1',
  summary: 'added Dinner', path: '/itinerary', audience: 'all', timestamp: 1000, ...o,
});

describe('trip-events: isFor / eventsForMe / unseenEvents', () => {
  it('everyone-events reach me unless I did them', () => {
    expect(isFor(ev({}), 'me')).toBeTrue();
    expect(isFor(ev({ actorUid: 'me' }), 'me')).toBeFalse();
  });
  it('named audiences must include me', () => {
    expect(isFor(ev({ audience: ['me', 'x'] }), 'me')).toBeTrue();
    expect(isFor(ev({ audience: ['x'] }), 'me')).toBeFalse();
    expect(isFor(ev({ audience: [] }), 'me')).toBeFalse();
  });
  it('eventsForMe is newest first and drops my own', () => {
    const list = [ev({ id: 'a', timestamp: 1 }), ev({ id: 'b', timestamp: 3, actorUid: 'me' }), ev({ id: 'c', timestamp: 2 })];
    expect(eventsForMe(list, 'me').map(e => e.id)).toEqual(['c', 'a']);
  });
  it('unseenEvents respects the high-water mark', () => {
    const list = [ev({ id: 'a', timestamp: 1000 }), ev({ id: 'b', timestamp: 2000 }), ev({ id: 'c', timestamp: 3000, audience: ['x'] })];
    expect(unseenEvents(list, 'me', 1000).map(e => e.id)).toEqual(['b']);
    expect(unseenEvents(list, 'me', 0).map(e => e.id)).toEqual(['b', 'a']);
  });
});

describe('trip-events: CollapseTracker', () => {
  it('reuses the last event for the same actor + kind + item inside five minutes', () => {
    const t = new CollapseTracker();
    expect(t.reuse('u', 'itinerary', 'i1', 0)).toBeNull();
    t.remember('u', 'itinerary', 'i1', 'ev-1', 0);
    expect(t.reuse('u', 'itinerary', 'i1', COLLAPSE_WINDOW_MS - 1)).toBe('ev-1');
    expect(t.reuse('u', 'itinerary', 'i1', COLLAPSE_WINDOW_MS)).toBeNull();
  });
  it('different item, kind or actor never collapses', () => {
    const t = new CollapseTracker();
    t.remember('u', 'itinerary', 'i1', 'ev-1', 0);
    expect(t.reuse('u', 'itinerary', 'i2', 10)).toBeNull();
    expect(t.reuse('u', 'stay', 'i1', 10)).toBeNull();
    expect(t.reuse('v', 'itinerary', 'i1', 10)).toBeNull();
  });
  it('trip-level events (no item) never collapse; forget ends the story', () => {
    const t = new CollapseTracker();
    t.remember('u', 'trip', '', 'ev-1', 0);
    expect(t.reuse('u', 'trip', '', 10)).toBeNull();
    t.remember('u', 'rec', 'r1', 'ev-2', 0);
    t.forget('u', 'rec', 'r1');
    expect(t.reuse('u', 'rec', 'r1', 10)).toBeNull();
  });
});

describe('trip-events: test accounts', () => {
  const list = [ev({ id: 'a', timestamp: 1 }), ev({ id: 't', timestamp: 2, test: true })];
  it('events done by or to a tester are hidden on a real trip', () => {
    expect(isFor(list[1], 'me')).toBeFalse();
    expect(eventsForMe(list, 'me').map(e => e.id)).toEqual(['a']);
    expect(unseenEvents(list, 'me', 0).map(e => e.id)).toEqual(['a']);
  });
  it('and shown on a test trip', () => {
    expect(isFor(list[1], 'me', true)).toBeTrue();
    expect(eventsForMe(list, 'me', true).map(e => e.id)).toEqual(['t', 'a']);
    expect(unseenEvents(list, 'me', 0, true).map(e => e.id)).toEqual(['t', 'a']);
  });
});
