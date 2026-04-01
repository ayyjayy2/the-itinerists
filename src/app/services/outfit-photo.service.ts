import { Injectable, inject, signal, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';

const MAX_PX  = 300;
const QUALITY = 0.4;

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

  private docKey(date: string, user: string) { return `${date}_${user}`; }

  async upload(file: File, date: string, userName: string): Promise<string> {
    this.cancelled = false;
    this.uploading.set(true);
    try {
      const blob    = await compressImage(file);
      if (this.cancelled) throw new Error('cancelled');
      const dataUrl = await blobToDataUrl(blob);
      if (this.cancelled) throw new Error('cancelled');

      const key = this.docKey(date, userName);
      await runInInjectionContext(this.injector, () =>
        setDoc(doc(this.firestore, 'outfitPhotos', key), { dataUrl })
      );
      this.cache.set(key, dataUrl);
      return dataUrl;
    } finally {
      this.ngZone.run(() => this.uploading.set(false));
    }
  }

  async getPhoto(date: string, userName: string): Promise<string | null> {
    const key = this.docKey(date, userName);
    if (this.cache.has(key)) return this.cache.get(key)!;
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'outfitPhotos', key))
    );
    if (!snap.exists()) return null;
    const dataUrl = snap.data()['dataUrl'] as string;
    this.cache.set(key, dataUrl);
    return dataUrl;
  }

  cancelUpload(): void {
    this.cancelled = true;
    this.uploading.set(false);
  }
}
