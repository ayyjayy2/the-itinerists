import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, addDoc, serverTimestamp, Unsubscribe } from '@angular/fire/firestore';
import { TripEvent, TripEventKind, TripEventAction } from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { CollapseTracker, eventsForMe, unseenEvents } from '../utils/trip-events';
import { AudienceSpec } from '../utils/event-text';

export interface TripEventInput {
  kind: TripEventKind;
  action: TripEventAction;
  itemId: string;
  path: string;
  summary: string;
  audience: AudienceSpec;
  targetUid?: string;
  /** Set by callers when the affected person is a tester; the actor's own flag is added here. */
  test?: boolean;
}

/**
 * The trip's event feed (`trips/{id}/events`): what the bell and the Updates
 * page show, and what the push fan-out (Cloud Function, later) reads.
 *
 * Depends only on Firestore, the trip context and the user, so TripService
 * and every data service can inject it without a cycle. Writes are
 * fire-and-forget: a failed event must never block the change it describes.
 */
@Injectable({ providedIn: 'root' })
export class TripEventsService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);

  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  private _events = signal<TripEvent[]>([]);
  /** Newest first. */
  readonly events = this._events.asReadonly();
  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  private unsub?: Unsubscribe;
  private collapse = new CollapseTracker();

  constructor() {
    effect(() => this.subscribe(this.signedInTripId()));
  }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    this.collapse.reset();
    if (!tripId) { this._events.set([]); this._loaded.set(true); return; }
    this._loaded.set(false);
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'events'), snap => {
        this._loaded.set(true);
        this._events.set(
          snap.docs.map(d => d.data() as TripEvent).sort((a, b) => b.timestamp - a.timestamp),
        );
      });
    });
  }

  /** Events aimed at the signed-in person, newest first (own actions excluded). */
  forMe(): TripEvent[] {
    const uid = this.userService.currentUser()?.uid ?? '';
    return eventsForMe(this._events(), uid);
  }

  /** Events for the signed-in person newer than their high-water mark. */
  unseen(lastSeenAt: number): TripEvent[] {
    const uid = this.userService.currentUser()?.uid ?? '';
    return unseenEvents(this._events(), uid, lastSeenAt);
  }

  /**
   * Record one change. Edits by the same person to the same item within five
   * minutes update the previous event instead of adding a new line; a removal
   * always starts fresh and ends the item's story.
   * `tripId` is for actions on a trip that is not the active one (join, leave).
   */
  emit(input: TripEventInput, tripId?: string): void {
    const tid = tripId ?? this.tripContext.activeTripId();
    const me  = this.userService.currentUser();
    const uid = me?.uid;
    if (!tid || !me || !uid) return;
    const now = Date.now();
    const test = !!(input.test || this.userService.firestoreUser()?.isTest);
    const reuse = input.action === 'removed' ? null : this.collapse.reuse(uid, input.kind, input.itemId, now);
    runInInjectionContext(this.injector, () => {
      if (reuse) {
        updateDoc(doc(this.firestore, 'trips', tid, 'events', reuse), {
          action: input.action, summary: input.summary, audience: input.audience, timestamp: now, test,
        }).catch(err => console.warn('[TripEvents] update failed:', err));
        this.collapse.remember(uid, input.kind, input.itemId, reuse, now);
        return;
      }
      const ref = doc(collection(this.firestore, 'trips', tid, 'events'));
      const event: TripEvent = {
        id: ref.id, kind: input.kind, action: input.action,
        actorUid: uid, actorName: me.name,
        itemId: input.itemId, summary: input.summary, path: input.path,
        audience: input.audience, timestamp: now, test,
        ...(input.targetUid ? { targetUid: input.targetUid } : {}),
      };
      setDoc(ref, event).catch(err => console.warn('[TripEvents] write failed:', err));
      // The owner's dashboard counts "things written per day" from `_writes`:
      // kind and action only, never the summary or the item (see firestore.rules).
      addDoc(collection(this.firestore, '_writes'), { uid, tripId: tid, kind: input.kind, action: input.action, at: serverTimestamp() })
        .catch(() => { /* analytics never blocks the change it describes */ });
      if (input.action === 'removed') this.collapse.forget(uid, input.kind, input.itemId);
      else this.collapse.remember(uid, input.kind, input.itemId, ref.id, now);
    });
  }
}
