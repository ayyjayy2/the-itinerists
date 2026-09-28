import { Injectable, signal, computed } from '@angular/core';

/** localStorage key prefix; the signed-in user's uid is appended. */
const ACTIVE_TRIP_KEY = 'tripplanner_active_trip_id';

/**
 * Central reactive context for the currently-active trip.
 *
 * Holds the active trip id and persists it to localStorage so it survives
 * reloads. The choice is stored PER ACCOUNT: on a shared or reused device a
 * newly created or different account must never inherit another account's
 * trip — that opened listeners on a trip the person isn't on, every one of
 * them refused by the rules, and the burst crashed the Firestore client.
 * `bindUser` is called by UserService whenever the signed-in user changes.
 *
 * All trip-scoped services derive their Firestore paths
 * (`trips/{activeTripId}/...`) from `activeTripId()` and re-subscribe whenever
 * it changes. Replaced the old single-trip `TripConfigService` (retired in TP-20).
 */
@Injectable({ providedIn: 'root' })
export class TripContextService {
  private readonly _activeTripId = signal<string | null>(null);
  private boundUid: string | null = null;

  /** Id of the trip currently in focus, or null if none is selected. */
  readonly activeTripId = this._activeTripId.asReadonly();

  /** True when a trip is selected. */
  readonly hasActiveTrip = computed(() => this._activeTripId() !== null);

  /** Point the context at an account (or none): loads that account's saved trip. */
  bindUser(uid: string | null): void {
    if (uid === this.boundUid) return;
    this.boundUid = uid;
    try { localStorage.removeItem(ACTIVE_TRIP_KEY); } catch { /* old device-wide key; could be anyone's */ }
    this._activeTripId.set(uid ? readStored(uid) : null);
  }

  /** Switch the active trip and persist the choice for the bound account. */
  switchTrip(tripId: string): void {
    this._activeTripId.set(tripId);
    if (!this.boundUid) return;
    try {
      localStorage.setItem(keyFor(this.boundUid), tripId);
    } catch { /* storage unavailable — keep the in-memory value */ }
  }

  /** Clear the active trip (e.g. after leaving the last trip). */
  clearActiveTrip(): void {
    this._activeTripId.set(null);
    if (!this.boundUid) return;
    try {
      localStorage.removeItem(keyFor(this.boundUid));
    } catch { /* storage unavailable — nothing to clear */ }
  }
}

function keyFor(uid: string): string { return `${ACTIVE_TRIP_KEY}:${uid}`; }

/** Read the account's persisted active trip id, tolerating environments without localStorage. */
function readStored(uid: string): string | null {
  try {
    return localStorage.getItem(keyFor(uid));
  } catch {
    return null;
  }
}
