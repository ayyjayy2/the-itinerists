import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { OutfitEntry } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class OutfitsService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _outfits = signal<OutfitEntry[]>([]);
  readonly outfits = this._outfits.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'outfits'), snap => {
        this._outfits.set(snap.docs.map(d => d.data() as OutfitEntry));
      });
    });
  }

  private docId(date: string, user: string): string { return `${date}_${user}`; }

  async upsertOutfit(entry: OutfitEntry): Promise<void> {
    const id = this.docId(entry.date, entry.user);
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, 'outfits', id), entry)
    );
  }

  async deleteOutfit(date: string, user: string): Promise<void> {
    const id = this.docId(date, user);
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'outfits', id))
    );
  }

  async patchOutfitPhoto(date: string, user: string, photoUrl: string): Promise<void> {
    const id = this.docId(date, user);
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'outfits', id), { photoUrl })
    );
  }
}
