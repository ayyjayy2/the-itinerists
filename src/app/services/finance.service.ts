import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, Unsubscribe } from '@angular/fire/firestore';
import { FinanceEntryDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { TripService } from './trip.service';
import { TripEventsService } from './trip-events.service';
import { financeAdded, financeChanged, financeRemoved } from '../utils/event-text';
import { markId, paidKey, parsePaidKey, ticksToShare } from '../utils/paid-marks';
import { reminderText } from '../utils/pay-links';

// Where ticks lived before they were shared with the trip (#448); moved to the trip once, then removed.
const PAID_PREFIX = 'tripplanner_paid_items_';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private events      = inject(TripEventsService);

  /** The active trip id, but only while someone is signed in. Listeners opened
   *  while signed out are refused by the rules and never recover, so trip
   *  subscriptions follow the user as well as the trip. */
  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  private _entries   = signal<FinanceEntryDoc[]>([]);
  private _paidItems = signal<Set<string>>(new Set());
  /** When each pay-back reminder was last sent (#532), by pair "{from}_{to}" uids. */
  private _reminders = signal<ReadonlyMap<string, number>>(new Map());
  readonly reminders = this._reminders.asReadonly();

  readonly entries   = this._entries.asReadonly();
  readonly paidItems = this._paidItems.asReadonly();

  /** False until the first snapshot for the active trip has arrived (pages
   *  hold their empty states until then, see LoadingComponent). */
  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  private unsub?: Unsubscribe;
  private unsubPaid?: Unsubscribe;
  private unsubReminders?: Unsubscribe;

  constructor() {
    effect(() => {
      const tripId = this.signedInTripId();
      this.subscribe(tripId);
      this.subscribePaid(tripId);
      this.subscribeReminders(tripId);
    });
  }

  /**
   * "Paid" ticks are shared with the trip (#448): one record per debt item
   * under trips/{id}/payments, live for everyone. On the first snapshot, ticks
   * this device saved before they were shared are moved to the trip, once.
   */
  private subscribePaid(tripId: string | null): void {
    this.unsubPaid?.(); this.unsubPaid = undefined;
    this._paidItems.set(new Set());
    if (!tripId) return;
    let first = true;
    runInInjectionContext(this.injector, () => {
      this.unsubPaid = onSnapshot(collection(this.firestore, 'trips', tripId, 'payments'), snap => {
        const shared = new Set(snap.docs.map(d => d.data() as { from: string; to: string; itemId: string })
          .map(m => paidKey(m.from, m.to, m.itemId)));
        this._paidItems.set(shared);
        if (first) { first = false; void this.moveDeviceTicks(tripId, shared); }
      }, err => console.warn('[FinanceService] paid marks:', err.message));
    });
  }

  private async moveDeviceTicks(tripId: string, shared: ReadonlySet<string>): Promise<void> {
    let local: string[] = [];
    try { local = JSON.parse(localStorage.getItem(PAID_PREFIX + tripId) ?? '[]'); } catch { /* none */ }
    const toShare = ticksToShare(local, shared);
    try {
      await Promise.all(toShare.map(key => this.writeMark(tripId, key)));
      localStorage.removeItem(PAID_PREFIX + tripId);
    } catch (err) {
      console.warn('[FinanceService] moving ticks to the trip failed; will retry next time:', (err as Error).message);
    }
  }

  private writeMark(tripId: string, key: string): Promise<void> {
    const parts = parsePaidKey(key);
    const uid = this.userService.currentUser()?.uid;
    if (!parts || !uid) return Promise.resolve();
    return runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, 'trips', tripId, 'payments', markId(key)), { ...parts, markedBy: uid, at: serverTimestamp() }));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._entries.set([]); this._loaded.set(true); return; }
    this._loaded.set(false);
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'finance'), snap => {
        this._loaded.set(true);
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
    const full = { ...entry, id: ref.id } as FinanceEntryDoc;
    await setDoc(ref, full);
    const t = financeAdded(full, this.userService.currentUser()?.name ?? '', this.currency(), this.tripService.activeMembers());
    this.events.emit({ kind: 'finance', action: 'added', itemId: ref.id, path: '/finance', ...t });
  }

  async updateEntry(id: string, updates: Partial<FinanceEntryDoc>): Promise<void> {
    const tid = this.requireTrip();
    const data = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    const before = this._entries().find(e => e.id === id);
    await updateDoc(doc(this.firestore, 'trips', tid, 'finance', id), data);
    if (!before) return;
    const t = financeChanged(before, { ...before, ...data } as FinanceEntryDoc, this.currency(), this.tripService.activeMembers());
    if (t) this.events.emit({ kind: 'finance', action: 'changed', itemId: id, path: '/finance', ...t });
  }

  async deleteEntry(id: string): Promise<void> {
    const tid = this.requireTrip();
    const before = this._entries().find(e => e.id === id);
    await deleteDoc(doc(this.firestore, 'trips', tid, 'finance', id));
    if (!before) return;
    const t = financeRemoved(before, this.currency(), this.tripService.activeMembers());
    this.events.emit({ kind: 'finance', action: 'removed', itemId: id, path: '/finance', ...t });
  }

  private currency(): string { return this.tripService.activeTrip()?.currency || 'USD'; }

  /** Tick or untick one debt item for the whole trip. Shows at once; the shared record follows. */
  togglePaidItem(key: string): void {
    const tid = this.tripContext.activeTripId();
    if (!tid) return;
    const wasPaid = this._paidItems().has(key);
    const next = new Set(this._paidItems());
    wasPaid ? next.delete(key) : next.add(key);
    this._paidItems.set(next);
    const write = wasPaid
      ? runInInjectionContext(this.injector, () => deleteDoc(doc(this.firestore, 'trips', tid, 'payments', markId(key))))
      : this.writeMark(tid, key);
    write.catch(err => {
      console.warn('[FinanceService] paid tick failed:', (err as Error).message);
      const undo = new Set(this._paidItems());
      wasPaid ? undo.add(key) : undo.delete(key);
      this._paidItems.set(undo);
    });
  }

  /** Tick every one of these debt items paid that isn't yet: settling up with someone after paying them (#532). */
  markAllPaid(keys: readonly string[]): void {
    for (const key of keys) if (!this._paidItems().has(key)) this.togglePaidItem(key);
  }

  private subscribeReminders(tripId: string | null): void {
    this.unsubReminders?.(); this.unsubReminders = undefined;
    this._reminders.set(new Map());
    if (!tripId) return;
    runInInjectionContext(this.injector, () => {
      this.unsubReminders = onSnapshot(collection(this.firestore, 'trips', tripId, 'reminders'), snap => {
        this._reminders.set(new Map(snap.docs.map(d => [d.id, (d.data()['at']?.toMillis?.() as number | undefined) ?? Date.now()])));
      }, err => console.warn('[FinanceService] reminders:', err.message));
    });
  }

  /**
   * "Remind" (#532): a gentle line on the bell of someone who owes me, worded
   * from their side ("Don't forget to pay Maya: $40"). The rules allow one a
   * day for each pair; the bell line follows only once that's recorded.
   */
  async remind(to: { uid: string }, amount: number): Promise<void> {
    const tid = this.requireTrip();
    const me = this.userService.currentUser();
    if (!me?.uid) throw new Error('Sign in to send a reminder.');
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, 'trips', tid, 'reminders', `${me.uid}_${to.uid}`), { from: me.uid, to: to.uid, at: serverTimestamp() }));
    this.events.emit({
      kind: 'finance', action: 'reminded', itemId: `remind-${to.uid}`, path: '/finance', targetUid: to.uid,
      summary: reminderText(me.name, amount, this.currency()), audience: [to.uid],
    }, tid);
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
