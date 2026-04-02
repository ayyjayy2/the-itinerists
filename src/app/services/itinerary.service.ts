import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { ItineraryItemDoc } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class ItineraryService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _items     = signal<ItineraryItemDoc[]>([]);
  private _dayLabels = signal<Record<string, string>>({});

  readonly items     = this._items.asReadonly();
  readonly dayLabels = this._dayLabels.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'itinerary'), snap => {
        this._items.set(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItineraryItemDoc)));
      });
    });
  }

  loadDayLabels(uid: string): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(doc(this.firestore, 'itineraryPrefs', uid), snap => {
        this._dayLabels.set(snap.exists() ? (snap.data()['dayLabels'] ?? {}) : {});
      });
    });
  }

  async saveDayLabel(uid: string, date: string, label: string): Promise<void> {
    await setDoc(doc(this.firestore, 'itineraryPrefs', uid),
      { dayLabels: { [date]: label } }, { merge: true });
  }

  async addItem(item: Omit<ItineraryItemDoc, 'id'>): Promise<void> {
    const ref = doc(collection(this.firestore, 'itinerary'));
    await setDoc(ref, { ...item, id: ref.id });
  }

  async updateItem(id: string, updates: Partial<ItineraryItemDoc>): Promise<void> {
    await updateDoc(doc(this.firestore, 'itinerary', id), { ...updates });
  }

  async deleteItem(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'itinerary', id));
  }

  /** Updates sortOrder for all items in a day after a drag-drop. */
  async reorderDay(items: ItineraryItemDoc[]): Promise<void> {
    await Promise.all(
      items.map((item, i) => updateDoc(doc(this.firestore, 'itinerary', item.id), { sortOrder: i }))
    );
  }
}
