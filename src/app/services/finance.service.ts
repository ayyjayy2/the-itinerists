import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { FinanceEntryDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';

const PAID_PREFIX = 'tripplanner_paid_items_'; // per-trip: paid state shouldn't bleed across trips

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);

  private _entries   = signal<FinanceEntryDoc[]>([]);
  private _paidItems = signal<Set<string>>(new Set());

  readonly entries   = this._entries.asReadonly();
  readonly paidItems = this._paidItems.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => {
      const tripId = this.tripContext.activeTripId();
      this.subscribe(tripId);
      this._paidItems.set(this.loadPaid(tripId));
    });
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._entries.set([]); return; }
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'finance'), snap => {
        this._entries.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as FinanceEntryDoc))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
      });
    });
  }

  async addEntry(entry: Omit<FinanceEntryDoc, 'id'>): Promise<void> {
    const tid = this.requireTrip();
    const ref = doc(collection(this.firestore, 'trips', tid, 'finance'));
    await setDoc(ref, { ...entry, id: ref.id });
  }

  async updateEntry(id: string, updates: Partial<FinanceEntryDoc>): Promise<void> {
    const tid = this.requireTrip();
    const data = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await updateDoc(doc(this.firestore, 'trips', tid, 'finance', id), data);
  }

  async deleteEntry(id: string): Promise<void> {
    const tid = this.requireTrip();
    await deleteDoc(doc(this.firestore, 'trips', tid, 'finance', id));
  }

  togglePaidItem(key: string): void {
    const tid = this.tripContext.activeTripId();
    if (!tid) return;
    const s = new Set(this._paidItems());
    s.has(key) ? s.delete(key) : s.add(key);
    this._paidItems.set(s);
    localStorage.setItem(PAID_PREFIX + tid, JSON.stringify([...s]));
  }

  private loadPaid(tripId: string | null): Set<string> {
    if (!tripId) return new Set();
    try {
      const raw = localStorage.getItem(PAID_PREFIX + tripId);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
