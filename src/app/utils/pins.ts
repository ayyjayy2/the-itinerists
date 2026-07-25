import { FirestoreUser } from '../models/trip.models';

/** 3 fit a phone-width row. */
export const DEFAULT_HOME_PINS = ['/itinerary', '/finance', '/packing'];

/** Account pins, or the defaults when none are saved. `[]` is a valid saved state. */
export function effectivePins(user: FirestoreUser | null): string[] {
  return user?.homePins ?? DEFAULT_HOME_PINS;
}
