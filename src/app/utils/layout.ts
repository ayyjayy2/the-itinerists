import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B' | 'C';

/** Layout experiments are Alayna-only. Gate on uid too so a username change
 *  can never hide the picker. Do not remove without her explicit say-so. */
const LAYOUT_PICKER_UID = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';

export function canPickLayout(user: FirestoreUser | null): boolean {
  return user?.username === 'alayna' || user?.uid === LAYOUT_PICKER_UID;
}

/** Everyone gets C; a saved A/B override only counts on the experiment account. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return canPickLayout(user) ? (user?.homeLayout ?? 'C') : 'C';
}
