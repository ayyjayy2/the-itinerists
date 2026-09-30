/**
 * Demo-build stand-in for `@angular/fire/storage`: objects live in a Map for
 * the life of the tab, nothing is uploaded anywhere. Implements exactly the
 * surface OutfitPhotoService uses.
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

export class Storage {
  maxUploadRetryTime    = 0;
  maxOperationRetryTime = 0;
  readonly objects = new Map<string, Blob>();
}
export { Storage as FirebaseStorage };

export interface StorageReference { storage: Storage; fullPath: string }
export interface UploadMetadata { contentType?: string }

export function getStorage(_app?: unknown): Storage { return new Storage(); }
export function provideStorage(factory: () => Storage): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: Storage, useFactory: factory }]);
}

export function ref(storage: Storage, path: string): StorageReference {
  return { storage, fullPath: path };
}
export async function uploadBytes(r: StorageReference, data: Blob, _meta?: UploadMetadata): Promise<void> {
  r.storage.objects.set(r.fullPath, data);
}
export async function getBlob(r: StorageReference): Promise<Blob> {
  const blob = r.storage.objects.get(r.fullPath);
  if (!blob) throw Object.assign(new Error(`demo storage: no object at ${r.fullPath}`), { code: 'storage/object-not-found' });
  return blob;
}
export async function deleteObject(r: StorageReference): Promise<void> {
  r.storage.objects.delete(r.fullPath);
}
