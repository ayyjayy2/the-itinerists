import { Injectable, inject, signal, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';

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

@Injectable({ providedIn: 'root' })
export class OutfitPhotoService {
  private firestore = inject(Firestore);
  private ngZone    = inject(NgZone);
  private injector  = inject(Injector);
  private cancelled = false;
  private cache     = new Map<string, string>();

  uploading = signal(false);

  private docKey(date: string, uid: string) { return `${date}_${uid}`; }

  /**
   * Upload the current user's outfit photo for a day. Stored owner-private at
   * `trips/{tripId}/outfitPhotos/{date}_{uid}` with `ownerUid` so the security
   * rules can gate read/write to the uploader alone.
   */
  async upload(tripId: string, date: string, uid: string, file: File): Promise<string> {
    this.cancelled = false;
    this.uploading.set(true);
    try {
      const blob    = await compressImage(file);
      if (this.cancelled) throw new Error('cancelled');
      const dataUrl = await blobToDataUrl(blob);
      if (this.cancelled) throw new Error('cancelled');

      const key = this.docKey(date, uid);
      await runInInjectionContext(this.injector, () =>
        setDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', key), { dataUrl, ownerUid: uid, date })
      );
      this.cache.set(`${tripId}/${key}`, dataUrl);
      return dataUrl;
    } finally {
      this.ngZone.run(() => this.uploading.set(false));
    }
  }

  /** Read the current user's own outfit photo for a day (owner-private). */
  async getPhoto(tripId: string, date: string, uid: string): Promise<string | null> {
    const key      = this.docKey(date, uid);
    const cacheKey = `${tripId}/${key}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'trips', tripId, 'outfitPhotos', key))
    );
    if (!snap.exists()) return null;
    const dataUrl = snap.data()['dataUrl'] as string;
    this.cache.set(cacheKey, dataUrl);
    return dataUrl;
  }

  cancelUpload(): void {
    this.cancelled = true;
    this.uploading.set(false);
  }
}
