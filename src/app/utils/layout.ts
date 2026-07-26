import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B' | 'C';

/** Group default is C; A and B are explicit per-account overrides. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return user?.homeLayout ?? 'C';
}
