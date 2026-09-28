import { TripContextService } from './trip-context.service';

const keyFor = (uid: string) => `tripplanner_active_trip_id:${uid}`;
const LEGACY_KEY = 'tripplanner_active_trip_id';

describe('TripContextService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts with no active trip until a user is bound', () => {
    localStorage.setItem(keyFor('u1'), 'trip-xyz');
    const svc = new TripContextService();
    expect(svc.activeTripId()).toBeNull();
    expect(svc.hasActiveTrip()).toBe(false);
  });

  it('binding a user restores that user\'s own saved trip', () => {
    localStorage.setItem(keyFor('u1'), 'trip-xyz');
    const svc = new TripContextService();
    svc.bindUser('u1');
    expect(svc.activeTripId()).toBe('trip-xyz');
    expect(svc.hasActiveTrip()).toBe(true);
  });

  it('a different account on the same device never inherits another user\'s trip', () => {
    localStorage.setItem(keyFor('u1'), 'trip-xyz');
    const svc = new TripContextService();
    svc.bindUser('u2');
    expect(svc.activeTripId()).toBeNull();
  });

  it('ignores and removes the old device-wide key (it could belong to anyone)', () => {
    localStorage.setItem(LEGACY_KEY, 'trip-old');
    const svc = new TripContextService();
    svc.bindUser('u1');
    expect(svc.activeTripId()).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('switchTrip sets the signal and persists under the bound user', () => {
    const svc = new TripContextService();
    svc.bindUser('u1');
    svc.switchTrip('trip-123');
    expect(svc.activeTripId()).toBe('trip-123');
    expect(localStorage.getItem(keyFor('u1'))).toBe('trip-123');
    expect(localStorage.getItem(keyFor('u2'))).toBeNull();
  });

  it('signing out clears the active trip but keeps the user\'s saved choice for next time', () => {
    const svc = new TripContextService();
    svc.bindUser('u1');
    svc.switchTrip('trip-123');
    svc.bindUser(null);
    expect(svc.activeTripId()).toBeNull();
    expect(localStorage.getItem(keyFor('u1'))).toBe('trip-123');
    svc.bindUser('u1');
    expect(svc.activeTripId()).toBe('trip-123');
  });

  it('clearActiveTrip resets the signal and removes the user\'s persistence', () => {
    const svc = new TripContextService();
    svc.bindUser('u1');
    svc.switchTrip('trip-123');
    svc.clearActiveTrip();
    expect(svc.activeTripId()).toBeNull();
    expect(localStorage.getItem(keyFor('u1'))).toBeNull();
  });
});
