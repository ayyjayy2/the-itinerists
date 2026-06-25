import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, Unsubscribe } from '@angular/fire/firestore';
import { OutfitEntry } from '../models/trip.models';
import { TripContextService } from './trip-context.service';

@Injectable({ providedIn: 'root' })
export class OutfitsService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);

  private _outfits = signal<OutfitEntry[]>([]);
  readonly outfits = this._outfits.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => this.subscribe(this.tripContext.activeTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._outfits.set([]); return; }
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'outfits'), snap => {
        this._outfits.set(snap.docs.map(d => d.data() as OutfitEntry));
      });
    });
  }

  private docId(date: string, user: string): string { return `${date}_${user}`; }

  async upsertOutfit(entry: OutfitEntry): Promise<void> {
    const tid = this.requireTrip();
    const id = this.docId(entry.date, entry.user);
    const data = Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined)
    );
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, 'trips', tid, 'outfits', id), data)
    );
  }

  async deleteOutfit(date: string, user: string): Promise<void> {
    const tid = this.requireTrip();
    const id = this.docId(date, user);
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'trips', tid, 'outfits', id))
    );
  }

  async patchOutfitPhoto(date: string, user: string, photoUrl: string): Promise<void> {
    const tid = this.requireTrip();
    const id = this.docId(date, user);
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'trips', tid, 'outfits', id), { photoUrl })
    );
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
