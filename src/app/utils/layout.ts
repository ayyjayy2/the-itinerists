import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B' | 'C';

/** Accounts flagged `layoutPicker` (set by scripts/set-account-flags.js, from a
 *  local list kept out of the repo). Don't unflag anyone without their say-so. */
export function canPickLayout(user: FirestoreUser | null): boolean {
  return user?.layoutPicker === true;
}

/** Everyone gets C ("More"); a saved override only counts on picker accounts. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return canPickLayout(user) ? (user?.homeLayout ?? 'C') : 'C';
}
