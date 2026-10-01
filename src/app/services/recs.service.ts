import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { RecDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { TripEventsService } from './trip-events.service';
import { recAdded, recChanged, recRemoved } from '../utils/event-text';

@Injectable({ providedIn: 'root' })
export class RecsService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);
  private events      = inject(TripEventsService);

  /** The active trip id, but only while someone is signed in. Listeners opened
   *  while signed out are refused by the rules and never recover, so trip
   *  subscriptions follow the user as well as the trip. */
  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  private _recs = signal<RecDoc[]>([]);
  readonly recs = this._recs.asReadonly();

  /** False until the first snapshot for the active trip has arrived (pages
   *  hold their empty states until then, see LoadingComponent). */
  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => this.subscribe(this.signedInTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._recs.set([]); this._loaded.set(true); return; }
    this._loaded.set(false);
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'recs'), snap => {
        this._loaded.set(true);
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
    const full = { ...rec, id: ref.id } as RecDoc;
    await setDoc(ref, full);
    this.events.emit({ kind: 'rec', action: 'added', itemId: ref.id, path: '/recs', ...recAdded(full) });
  }

  /** Edit a rec's fields; the id, author and creation time stay as they were. */
  async updateRec(id: string, patch: Partial<Pick<RecDoc, 'category' | 'title' | 'description' | 'extra' | 'destination'>>): Promise<void> {
    const tid = this.requireTrip();
    const before = this._recs().find(r => r.id === id);
    await updateDoc(doc(this.firestore, 'trips', tid, 'recs', id), { ...patch });
    if (!before) return;
    const t = recChanged(before, { ...before, ...patch });
    if (t) this.events.emit({ kind: 'rec', action: 'changed', itemId: id, path: '/recs', ...t });
  }

  async deleteRec(id: string): Promise<void> {
    const tid = this.requireTrip();
    const before = this._recs().find(r => r.id === id);
    await deleteDoc(doc(this.firestore, 'trips', tid, 'recs', id));
    if (before) this.events.emit({ kind: 'rec', action: 'removed', itemId: id, path: '/recs', ...recRemoved(before) });
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
