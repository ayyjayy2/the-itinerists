/**
 * Outfit photos: several per person per day, each stored as its own
 * owner-private Firestore doc under `trips/{tripId}/outfitPhotos/{photoId}`.
 * The outfit entry keeps the ordered list of photo ids. Before this, one photo
 * lived at `{date}_{uid}` flagged by `photoUrl: 'stored'`; that is still read
 * as the first photo, so nothing needs migrating.
 */

/** Cap per person per day. */
export const MAX_OUTFIT_PHOTOS = 2;

/** Doc id of the pre-gallery single photo for a day. */
export function legacyPhotoId(date: string, uid: string): string {
  return `${date}_${uid}`;
}

/** A fresh photo doc id, prefixed with day and owner so it stays easy to trace. */
export function newOutfitPhotoId(date: string, uid: string): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  return `${date}_${uid}_${rand}`;
}

/** The ordered photo ids for an outfit, honoring the legacy single-photo flag. */
export function outfitPhotoIds(
  entry: { photoIds?: string[]; photoUrl?: string }, date: string, uid: string,
): string[] {
  if (entry.photoIds) return entry.photoIds;
  return entry.photoUrl === 'stored' ? [legacyPhotoId(date, uid)] : [];
}
