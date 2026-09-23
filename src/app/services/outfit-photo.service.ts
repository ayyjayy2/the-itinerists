import { Injectable, inject, signal, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, deleteDoc } from '@angular/fire/firestore';
import { newOutfitPhotoId } from '../utils/outfit-photos';

const MAX_PX  = 1200;
const QUALITY = 0.85;

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width >= height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
        else                 { width = Math.round(width * MAX_PX / height);  height = MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('toBlob failed')),
        'image/jpeg', QUALITY
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface UploadedPhoto { id: string; dataUrl: string }

/**
 * Owner-private outfit photos, one Firestore doc per photo at
 * `trips/{tripId}/outfitPhotos/{photoId}` with `ownerUid` so the security
 * rules gate read/write to the uploader alone. A day can hold several.
 */
@Injectable({ providedIn: 'root' })
export class OutfitPhotoService {
  private firestore = inject(Firestore);
  private ngZone    = inject(NgZone);
  private injector  = inject(Injector);
  private cancelled = false;
  private cache     = new Map<string, string>();

  uploading = signal(false);

  /** Compress and store one photo for a day; returns its new id and data URL. */
  async upload(tripId: string, date: string, uid: string, file: File): Promise<UploadedPhoto> {
    this.cancelled = false;
    this.uploading.set(true);
    try {
      const blob    = await compressImage(file);
      if (this.cancelled) throw new Error('cancelled');
      const dataUrl = await blobToDataUrl(blob);
      if (this.cancelled) throw new Error('cancelled');

      const id = newOutfitPhotoId(date, uid);
      await runInInjectionContext(this.injector, () =>
        setDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', id), { dataUrl, ownerUid: uid, date })
      );
      this.cache.set(`${tripId}/${id}`, dataUrl);
      return { id, dataUrl };
    } finally {
      this.ngZone.run(() => this.uploading.set(false));
    }
  }

  /** Read one of the current user's own photos by id (owner-private). */
  async getPhoto(tripId: string, id: string): Promise<string | null> {
    const cacheKey = `${tripId}/${id}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', id))
    );
    if (!snap.exists()) return null;
    const dataUrl = snap.data()['dataUrl'] as string;
    this.cache.set(cacheKey, dataUrl);
    return dataUrl;
  }

  /** Remove a photo doc the owner no longer wants. Best-effort. */
  async deletePhoto(tripId: string, id: string): Promise<void> {
    this.cache.delete(`${tripId}/${id}`);
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', id))
    ).catch(err => console.error('[OutfitPhotoService] deletePhoto failed:', err));
  }

  cancelUpload(): void {
    this.cancelled = true;
    this.uploading.set(false);
  }
}
