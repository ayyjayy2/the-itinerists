import { TripContextService } from './trip-context.service';

const KEY = 'tripplanner_active_trip_id';

describe('TripContextService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts with no active trip', () => {
    const svc = new TripContextService();
    expect(svc.activeTripId()).toBeNull();
    expect(svc.hasActiveTrip()).toBe(false);
  });

  it('switchTrip sets the signal and persists to localStorage', () => {
    const svc = new TripContextService();
    svc.switchTrip('trip-123');
    expect(svc.activeTripId()).toBe('trip-123');
    expect(svc.hasActiveTrip()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('trip-123');
  });

  it('restores the active trip id from localStorage on init', () => {
    localStorage.setItem(KEY, 'trip-xyz');
    const svc = new TripContextService();
    expect(svc.activeTripId()).toBe('trip-xyz');
    expect(svc.hasActiveTrip()).toBe(true);
  });

  it('clearActiveTrip resets the signal and removes persistence', () => {
    const svc = new TripContextService();
    svc.switchTrip('trip-123');
    svc.clearActiveTrip();
    expect(svc.activeTripId()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
