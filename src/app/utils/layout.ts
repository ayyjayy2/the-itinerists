import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B' | 'C';

/** Accounts with the layout picker: Alayna (gate on uid too so a username
 *  change can never hide it) and Makaela. Do not trim without their say-so. */
const ALAYNA_UID = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';

export function canPickLayout(user: FirestoreUser | null): boolean {
  return user?.username === 'alayna' || user?.uid === ALAYNA_UID ||
         user?.username === 'makaela';
}

/** Everyone gets C ("More"); a saved override only counts on picker accounts. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return canPickLayout(user) ? (user?.homeLayout ?? 'C') : 'C';
}
