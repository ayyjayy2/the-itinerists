import { Injectable, signal, computed } from '@angular/core';

/** localStorage key for the persisted active trip id. */
const ACTIVE_TRIP_KEY = 'tripplanner_active_trip_id';

/**
 * Central reactive context for the currently-active trip.
 *
 * Holds the active trip id and persists it to localStorage so it survives
 * reloads. All trip-scoped services derive their Firestore paths
 * (`trips/{activeTripId}/...`) from `activeTripId()` and re-subscribe whenever
 * it changes. Supersedes the single-trip `TripConfigService`, which is removed
 * once the per-trip sub-collection rewrite (TP-8) and home screen update
 * (TP-15) land.
 */
@Injectable({ providedIn: 'root' })
export class TripContextService {
  private readonly _activeTripId = signal<string | null>(readStored());

  /** Id of the trip currently in focus, or null if none is selected. */
  readonly activeTripId = this._activeTripId.asReadonly();

  /** True when a trip is selected. */
  readonly hasActiveTrip = computed(() => this._activeTripId() !== null);

  /** Switch the active trip and persist the choice. */
  switchTrip(tripId: string): void {
    this._activeTripId.set(tripId);
    try {
      localStorage.setItem(ACTIVE_TRIP_KEY, tripId);
    } catch { /* storage unavailable — keep the in-memory value */ }
  }

  /** Clear the active trip (e.g. on logout or after leaving the last trip). */
  clearActiveTrip(): void {
    this._activeTripId.set(null);
    try {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    } catch { /* storage unavailable — nothing to clear */ }
  }
}

/** Read the persisted active trip id, tolerating environments without localStorage. */
function readStored(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TRIP_KEY);
  } catch {
    return null;
  }
}
