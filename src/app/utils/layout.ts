import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B' | 'C';

/** Group default is B (user testing); A is an explicit per-account override. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return user?.homeLayout ?? 'B';
}
