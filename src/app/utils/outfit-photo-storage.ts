/**
 * Where an outfit photo lives and how its Firestore doc describes it.
 *
 * New photos are two JPEGs in Cloud Storage under
 * `outfitPhotos/{ownerUid}/{tripId}/{photoId}.jpg` (+ `_thumb.jpg`); the uid
 * is the first path segment so storage.rules can grant the owner and nobody
 * else. The Firestore doc keeps `path` / `thumbPath`. Docs written before the
 * move carry the image inline as `dataUrl`; both shapes are read until the
 * one-time migration (scripts/migrate-outfit-photos.js) has run.
 */
/**
 * Master switch for writing new photos to Cloud Storage. Off until the
 * project's default bucket exists (it needs the Blaze plan) and
 * scripts/set-storage-cors.js has run; while off, uploads use the inline
 * Firestore format and every reader still understands both.
 */
export const OUTFIT_PHOTO_STORAGE_ENABLED = false;

export const PHOTO_MAX_PX = 1600;
export const THUMB_MAX_PX = 300;
export const JPEG_QUALITY = 0.85;

export interface OutfitPhotoPaths { path: string; thumbPath: string }

export type PhotoSource =
  | { kind: 'inline'; dataUrl: string }
  | { kind: 'storage'; path: string; thumbPath: string };

export function outfitPhotoPaths(uid: string, tripId: string, photoId: string): OutfitPhotoPaths {
  const base = `outfitPhotos/${uid}/${tripId}/${photoId}`;
  return { path: `${base}.jpg`, thumbPath: `${base}_thumb.jpg` };
}

export function photoSource(data: Record<string, unknown> | undefined): PhotoSource | null {
  if (!data) return null;
  const path = data['path'], thumbPath = data['thumbPath'], dataUrl = data['dataUrl'];
  if (typeof path === 'string' && typeof thumbPath === 'string') return { kind: 'storage', path, thumbPath };
  if (typeof dataUrl === 'string' && dataUrl) return { kind: 'inline', dataUrl };
  return null;
}
