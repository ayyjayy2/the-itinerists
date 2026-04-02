import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, deleteDoc } from '@angular/fire/firestore';
import { RecDoc } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class RecsService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _recs = signal<RecDoc[]>([]);
  readonly recs = this._recs.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'recs'), snap => {
        this._recs.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as RecDoc))
            .sort((a, b) => a.createdAt - b.createdAt)
        );
      });
    });
  }

  async addRec(rec: Omit<RecDoc, 'id'>): Promise<void> {
    const ref = doc(collection(this.firestore, 'recs'));
    await setDoc(ref, { ...rec, id: ref.id });
  }

  async deleteRec(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'recs', id));
  }
}
