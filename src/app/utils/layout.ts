import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B' | 'C';

/** Accounts with the layout picker: Alayna and Makaela. Each gated on uid too
 *  so a username change can never hide it. Do not trim without their say-so. */
const ALAYNA_UID  = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';
const MAKAELA_UID = 'SIXcW7K34VTOD8yZcHWSTg0yFS02';

export function canPickLayout(user: FirestoreUser | null): boolean {
  return user?.username === 'alayna' || user?.uid === ALAYNA_UID ||
         user?.username === 'makaelajohnston' || user?.uid === MAKAELA_UID;
}

/** Everyone gets C ("More"); a saved override only counts on picker accounts. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return canPickLayout(user) ? (user?.homeLayout ?? 'C') : 'C';
}
