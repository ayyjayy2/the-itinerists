import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { AccommodationDoc } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class StaysService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _stays = signal<AccommodationDoc[]>([]);
  readonly stays = this._stays.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'stays'), snap => {
        this._stays.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as AccommodationDoc))
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        );
      });
    });
  }

  async addStay(stay: Omit<AccommodationDoc, 'id'>): Promise<void> {
    const ref = doc(collection(this.firestore, 'stays'));
    await setDoc(ref, { ...stay, id: ref.id });
  }

  async updateStay(id: string, updates: Partial<AccommodationDoc>): Promise<void> {
    await updateDoc(doc(this.firestore, 'stays', id), { ...updates });
  }

  async deleteStay(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'stays', id));
  }
}
