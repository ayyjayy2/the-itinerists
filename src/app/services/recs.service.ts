import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { RecDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';

@Injectable({ providedIn: 'root' })
export class RecsService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);

  private _recs = signal<RecDoc[]>([]);
  readonly recs = this._recs.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => this.subscribe(this.tripContext.activeTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._recs.set([]); return; }
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'recs'), snap => {
        this._recs.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as RecDoc))
            .sort((a, b) => a.createdAt - b.createdAt)
        );
      });
    });
  }

  async addRec(rec: Omit<RecDoc, 'id'>): Promise<void> {
    const tid = this.requireTrip();
    const ref = doc(collection(this.firestore, 'trips', tid, 'recs'));
    await setDoc(ref, { ...rec, id: ref.id });
  }

  /** Edit a rec's fields; the id, author and creation time stay as they were. */
  async updateRec(id: string, patch: Partial<Pick<RecDoc, 'category' | 'title' | 'description' | 'extra' | 'destination'>>): Promise<void> {
    const tid = this.requireTrip();
    await updateDoc(doc(this.firestore, 'trips', tid, 'recs', id), { ...patch });
  }

  async deleteRec(id: string): Promise<void> {
    const tid = this.requireTrip();
    await deleteDoc(doc(this.firestore, 'trips', tid, 'recs', id));
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
