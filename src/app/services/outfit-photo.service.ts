import { Injectable, inject, signal, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, deleteDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getBlob, deleteObject } from '@angular/fire/storage';
import { newOutfitPhotoId } from '../utils/outfit-photos';
import { resizeToJpeg } from '../utils/image-resize';
import {
  outfitPhotoPaths, photoSource, PHOTO_MAX_PX, THUMB_MAX_PX, JPEG_QUALITY,
  OUTFIT_PHOTO_STORAGE_ENABLED,
} from '../utils/outfit-photo-storage';

/** Size of the inline fallback copy (the pre-Storage format) so it stays well under Firestore's 1 MB doc cap. */
const INLINE_FALLBACK_PX = 1200;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface UploadedPhoto { id: string; url: string }

/**
 * Owner-private outfit photos.
 *
 * Each photo is a Firestore doc at `trips/{tripId}/outfitPhotos/{photoId}`
 * (`ownerUid` gates it to the uploader) that points at two JPEGs in Cloud
 * Storage: a 1600 px copy and a 300 px thumbnail, both under the owner's uid
 * so storage.rules can keep everyone else out. Docs from before the move
 * carry the image inline as `dataUrl`; they are still read, and
 * scripts/migrate-outfit-photos.js turns them into Storage objects.
 */
@Injectable({ providedIn: 'root' })
export class OutfitPhotoService {
  private firestore = inject(Firestore);
  private storage   = inject(Storage);
  private ngZone    = inject(NgZone);
  private injector  = inject(Injector);
  private cancelled = false;
  /** Best URL we have per `${tripId}/${id}`: the thumbnail until the full copy arrives. */
  private urls      = new Map<string, string>();
  private fullReady = new Set<string>();

  uploading = signal(false);

  constructor() {
    // Fail fast instead of the SDK's default ten-minute retry window, so a
    // photo falls back to the inline copy within seconds if Storage is unreachable.
    this.storage.maxUploadRetryTime    = 15_000;
    this.storage.maxOperationRetryTime = 10_000;
  }

  /** Resize, store both sizes, write the doc; returns the new id and a local URL for immediate display. */
  async upload(tripId: string, date: string, uid: string, file: File): Promise<UploadedPhoto> {
    this.cancelled = false;
    this.uploading.set(true);
    try {
      const full = await resizeToJpeg(file, PHOTO_MAX_PX, JPEG_QUALITY);
      if (this.cancelled) throw new Error('cancelled');
      const thumb = await resizeToJpeg(full.blob, THUMB_MAX_PX, JPEG_QUALITY);
      if (this.cancelled) throw new Error('cancelled');

      const id    = newOutfitPhotoId(date, uid);
      const paths = outfitPhotoPaths(uid, tripId, id);
      let data: Record<string, unknown>;
      try {
        if (!OUTFIT_PHOTO_STORAGE_ENABLED) throw new Error('Cloud Storage for photos is switched off');
        const meta = { contentType: 'image/jpeg' };
        await uploadBytes(ref(this.storage, paths.path), full.blob, meta);
        await uploadBytes(ref(this.storage, paths.thumbPath), thumb.blob, meta);
        data = { ownerUid: uid, date, ...paths, width: full.width, height: full.height };
      } catch (err) {
        // Safety net: if Storage is unreachable, keep the photo the old inline
        // way rather than lose it. The migration script picks these up later.
        // TODO remove once scripts/migrate-outfit-photos.js has run clean.
        if (OUTFIT_PHOTO_STORAGE_ENABLED) console.warn('[OutfitPhotoService] Storage upload failed, storing inline:', err);
        const small = await resizeToJpeg(full.blob, INLINE_FALLBACK_PX, JPEG_QUALITY);
        data = { ownerUid: uid, date, dataUrl: await blobToDataUrl(small.blob) };
      }
      if (this.cancelled) throw new Error('cancelled');

      await runInInjectionContext(this.injector, () =>
        setDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', id), data)
      );
      const url = URL.createObjectURL(full.blob);
      const key = `${tripId}/${id}`;
      this.urls.set(key, url);
      this.fullReady.add(key);
      return { id, url };
    } finally {
      this.ngZone.run(() => this.uploading.set(false));
    }
  }

  /**
   * Resolve one of the current user's own photos. `onUrl` fires with the
   * thumbnail as soon as it is available and again with the full-size copy,
   * so a grid can paint quickly; inline (legacy) photos fire once.
   */
  async loadPhoto(tripId: string, id: string, onUrl: (url: string) => void): Promise<void> {
    const key = `${tripId}/${id}`;
    const cached = this.urls.get(key);
    if (cached) { onUrl(cached); if (this.fullReady.has(key)) return; }

    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', id))
    );
    const source = photoSource(snap.exists() ? snap.data() : undefined);
    if (!source) return;

    if (source.kind === 'inline') {
      this.urls.set(key, source.dataUrl);
      this.fullReady.add(key);
      onUrl(source.dataUrl);
      return;
    }
    if (!cached) {
      const thumb = await this.fetchObjectUrl(source.thumbPath);
      if (thumb) { this.urls.set(key, thumb); onUrl(thumb); }
    }
    const full = await this.fetchObjectUrl(source.path);
    if (full) { this.urls.set(key, full); this.fullReady.add(key); onUrl(full); }
  }

  /** The full-size copy of one of the current user's own photos, or null. */
  async getPhoto(tripId: string, id: string): Promise<string | null> {
    let last: string | null = null;
    await this.loadPhoto(tripId, id, url => { last = url; });
    return last;
  }

  /** Remove a photo the owner no longer wants: both Storage objects and the doc. Best-effort. */
  async deletePhoto(tripId: string, id: string): Promise<void> {
    const key = `${tripId}/${id}`;
    this.urls.delete(key);
    this.fullReady.delete(key);
    try {
      const docRef = doc(this.firestore, 'trips', tripId, 'outfitPhotos', id);
      const snap   = await runInInjectionContext(this.injector, () => getDoc(docRef));
      const source = photoSource(snap.exists() ? snap.data() : undefined);
      if (source?.kind === 'storage') {
        await Promise.allSettled([
          deleteObject(ref(this.storage, source.path)),
          deleteObject(ref(this.storage, source.thumbPath)),
        ]);
      }
      await runInInjectionContext(this.injector, () => deleteDoc(docRef));
    } catch (err) {
      console.error('[OutfitPhotoService] deletePhoto failed:', err);
    }
  }

  cancelUpload(): void {
    this.cancelled = true;
    this.uploading.set(false);
  }

  private async fetchObjectUrl(path: string): Promise<string | null> {
    try {
      const blob = await getBlob(ref(this.storage, path));
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('[OutfitPhotoService] download failed for', path, err);
      return null;
    }
  }
}
