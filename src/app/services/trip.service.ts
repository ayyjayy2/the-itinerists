import { Injectable, inject, Injector, runInInjectionContext, signal, computed, effect } from '@angular/core';
import {
  Firestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot,
  arrayUnion, arrayRemove, increment, Unsubscribe,
} from '@angular/fire/firestore';
import { UserService } from './user.service';
import { TripContextService } from './trip-context.service';
import { AuthService } from './auth.service';
import {
  TripDoc, TripMember, UserTripsDoc, FirestoreUser, ActivityLogEntry, ActivityAction,
} from '../models/trip.models';

/** Fields collected by the Create Trip form (TP-13). */
export interface CreateTripInput {
  name: string;
  destination: string;
  destinationPlaceId?: string;
  destinationCoords?: { lat: number; lng: number };
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  currency: string;    // ISO code, e.g. "USD"
  coverPhotoUrl?: string;
}

/**
 * Owns the lifecycle of trips: create, list, join, switch, archive.
 *
 * Writes the `/trips/{tripId}`, `/trips/{tripId}/members/{uid}` and
 * `/userTrips/{uid}` documents introduced by the multi-trip model (TP-5), and
 * drives the active trip through {@link TripContextService} (TP-6).
 *
 * Invite-code resolution lives in {@link AuthService} (code → tripId via
 * `/inviteIndex`); {@link joinByCode} resolves a code for an already-signed-in
 * user and routes through {@link joinTrip} (TP-11).
 */
@Injectable({ providedIn: 'root' })
export class TripService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private userService = inject(UserService);
  private tripContext = inject(TripContextService);
  private authService = inject(AuthService);

  /** Live document for the active trip (null when none is selected). */
  private _activeTrip = signal<TripDoc | null>(null);
  readonly activeTrip = this._activeTrip.asReadonly();

  /** Live member list for the active trip. */
  private _activeMembers = signal<TripMember[]>([]);
  readonly activeMembers = this._activeMembers.asReadonly();

  /** Live activity log for the active trip, newest first (TP-18). */
  private _activeActivity = signal<ActivityLogEntry[]>([]);
  readonly activeActivity = this._activeActivity.asReadonly();

  /** Pages the current user has hidden on the active trip (TP-15 page toggles). */
  readonly hiddenPages = computed<string[]>(() => {
    const uid = this.userService.firestoreUser()?.uid;
    const me  = this._activeMembers().find(m => m.uid === uid);
    return me?.hiddenPages ?? [];
  });

  private activeUnsubs: Unsubscribe[] = [];
  private restoring = false;

  constructor() {
    // Keep `activeTrip` + `activeMembers` in sync with whichever trip is active.
    effect(() => this.watchActiveTrip(this.tripContext.activeTripId()));

    // On login, restore the user's last active trip when none is set locally
    // (e.g. a fresh device/browser) — spec §3.2 (TP-14).
    effect(() => {
      const user = this.userService.firestoreUser();
      if (user) this.maybeRestoreActiveTrip(user.uid);
    });
  }

  /** If no trip is active locally, adopt the user's lastActiveTrip (or their first trip). */
  private async maybeRestoreActiveTrip(uid: string): Promise<void> {
    if (this.tripContext.activeTripId() || this.restoring) return;
    this.restoring = true;
    try {
      const snap = await runInInjectionContext(this.injector, () =>
        getDoc(doc(this.firestore, 'userTrips', uid)));
      if (!snap.exists()) return;
      const idx = snap.data() as UserTripsDoc;
      const target = idx.lastActiveTrip ?? idx.tripIds?.[0];
      if (target && !this.tripContext.activeTripId()) {
        this.tripContext.switchTrip(target);
      }
    } finally {
      this.restoring = false;
    }
  }

  private watchActiveTrip(tripId: string | null): void {
    this.activeUnsubs.forEach(u => u());
    this.activeUnsubs = [];
    if (!tripId) {
      this._activeTrip.set(null); this._activeMembers.set([]); this._activeActivity.set([]);
      return;
    }
    runInInjectionContext(this.injector, () => {
      this.activeUnsubs.push(
        onSnapshot(doc(this.firestore, 'trips', tripId), snap => {
          this._activeTrip.set(snap.exists() ? (snap.data() as TripDoc) : null);
        }),
        onSnapshot(collection(this.firestore, 'trips', tripId, 'members'), snap => {
          this._activeMembers.set(
            snap.docs.map(d => d.data() as TripMember).sort((a, b) => a.joinedAt - b.joinedAt),
          );
        }),
        onSnapshot(collection(this.firestore, 'trips', tripId, 'activityLog'), snap => {
          this._activeActivity.set(
            snap.docs.map(d => d.data() as ActivityLogEntry).sort((a, b) => b.timestamp - a.timestamp),
          );
        }),
      );
    });
  }

  /** Create a trip, make the current user its owner, switch to it. Returns the new tripId. */
  async createTrip(input: CreateTripInput): Promise<string> {
    const user = this.requireUser();
    return runInInjectionContext(this.injector, async () => {
      const tripRef = doc(collection(this.firestore, 'trips'));
      const tripId  = tripRef.id;
      const now     = Date.now();

      const trip: TripDoc = {
        id: tripId,
        name: input.name.trim(),
        destination: input.destination.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        currency: input.currency,
        createdBy: user.uid,
        createdAt: now,
        memberCount: 1,
      };
      // Only write optional fields when present — Firestore rejects `undefined`.
      if (input.destinationPlaceId) trip.destinationPlaceId = input.destinationPlaceId;
      if (input.destinationCoords)  trip.destinationCoords  = input.destinationCoords;
      if (input.coverPhotoUrl)      trip.coverPhotoUrl      = input.coverPhotoUrl;
      await setDoc(tripRef, trip);

      await setDoc(this.memberRef(tripId, user.uid), this.memberSnapshot(user, 'owner', now));
      await this.indexTrip(user.uid, tripId);

      this.tripContext.switchTrip(tripId);
      return tripId;
    });
  }

  /** Read every trip the given user belongs to (archived included — the UI separates them). */
  async getUserTrips(uid: string): Promise<TripDoc[]> {
    return runInInjectionContext(this.injector, async () => {
      const idxSnap = await getDoc(doc(this.firestore, 'userTrips', uid));
      const tripIds = idxSnap.exists() ? ((idxSnap.data() as UserTripsDoc).tripIds ?? []) : [];
      const snaps = await Promise.all(
        tripIds.map(id => runInInjectionContext(this.injector, () => getDoc(doc(this.firestore, 'trips', id)))),
      );
      return snaps.filter(s => s.exists()).map(s => s.data() as TripDoc);
    });
  }

  /** Add the current user to an existing trip as a member and switch to it. */
  async joinTrip(tripId: string): Promise<void> {
    const user = this.requireUser();
    await runInInjectionContext(this.injector, async () => {
      const now = Date.now();
      await setDoc(this.memberRef(tripId, user.uid), this.memberSnapshot(user, 'member', now));
      await updateDoc(doc(this.firestore, 'trips', tripId), { memberCount: increment(1) });
      await this.indexTrip(user.uid, tripId);
      this.logActivity(tripId, 'member_added', user, user); // self-join
      this.tripContext.switchTrip(tripId);
    });
  }

  /**
   * Join a trip from an invite code, for an already-signed-in user (TP-11).
   * Resolves the code → tripId, joins (if not already a member), and records
   * the user in the invite's `usedBy`. Returns the joined tripId.
   */
  async joinByCode(code: string): Promise<string> {
    const user      = this.requireUser();
    const trimmed   = code.trim().toUpperCase();
    const tripId    = await this.authService.validateInviteCode(trimmed);
    if (!tripId) throw new Error('This invite code is invalid or has expired.');

    await runInInjectionContext(this.injector, async () => {
      const alreadyMember = (await getDoc(this.memberRef(tripId, user.uid))).exists();
      if (!alreadyMember) {
        await this.joinTrip(tripId);
      } else {
        this.tripContext.switchTrip(tripId);
      }
      // Record usage on the invite doc (idempotent via arrayUnion).
      await updateDoc(doc(this.firestore, 'trips', tripId, 'invites', trimmed),
        { usedBy: arrayUnion(user.uid) });
    });
    return tripId;
  }

  /** Generate a trip-scoped invite code for the given trip. Returns the code. */
  async generateInvite(tripId: string): Promise<string> {
    const user = this.requireUser();
    return this.authService.generateInviteCode(user.uid, tripId);
  }

  /** Switch the active trip (updates the context immediately, persists lastActiveTrip). */
  async switchTrip(tripId: string): Promise<void> {
    const user = this.requireUser();
    this.tripContext.switchTrip(tripId);
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, 'userTrips', user.uid), { lastActiveTrip: tripId }, { merge: true }),
    );
  }

  /** Mark a trip archived (default) or restore it. */
  async archiveTrip(tripId: string, archived = true): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'trips', tripId), { archived }),
    );
  }

  /** Edit a trip's core details (any member). Only defined fields are written. */
  async updateTrip(tripId: string, patch: Partial<Pick<TripDoc,
    'name' | 'destination' | 'startDate' | 'endDate' | 'currency'>>): Promise<void> {
    const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(data).length === 0) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'trips', tripId), data),
    );
  }

  /** Remove another member from a trip (the owner can't be removed). */
  async removeMember(tripId: string, uid: string): Promise<void> {
    const actor = this.requireUser();
    await runInInjectionContext(this.injector, async () => {
      const snap = await getDoc(this.memberRef(tripId, uid));
      const target = snap.exists() ? (snap.data() as TripMember) : null;
      if (target?.role === 'owner') {
        throw new Error('The trip owner cannot be removed.');
      }
      await deleteDoc(this.memberRef(tripId, uid));
      await updateDoc(doc(this.firestore, 'userTrips', uid), { tripIds: arrayRemove(tripId) })
        .catch(() => {/* tolerate a missing index doc */});
      await updateDoc(doc(this.firestore, 'trips', tripId), { memberCount: increment(-1) });
      this.logActivity(tripId, 'member_removed',
        { uid, displayName: target?.displayName ?? 'A member' }, actor);
    });
  }

  /**
   * Leave the active trip voluntarily. Removes the current user's membership,
   * decrements the count, and switches to another of the user's trips (or clears
   * the active trip if none remain). Returns the new active tripId (or null).
   */
  async leaveTrip(tripId: string): Promise<string | null> {
    const user = this.requireUser();
    return runInInjectionContext(this.injector, async () => {
      this.logActivity(tripId, 'member_left', user, user); // log before we lose access on switch
      await deleteDoc(this.memberRef(tripId, user.uid));
      await updateDoc(doc(this.firestore, 'trips', tripId), { memberCount: increment(-1) });

      // Drop it from the user's index and pick a replacement active trip.
      const idxRef  = doc(this.firestore, 'userTrips', user.uid);
      const idxSnap = await getDoc(idxRef);
      const remaining = (idxSnap.exists() ? (idxSnap.data() as UserTripsDoc).tripIds ?? [] : [])
        .filter(id => id !== tripId);
      const next = remaining[0] ?? null;
      await setDoc(idxRef, { tripIds: remaining, lastActiveTrip: next ?? null }, { merge: true });

      if (next) this.tripContext.switchTrip(next);
      else      this.tripContext.clearActiveTrip();
      return next;
    });
  }

  /** Persist the current user's hidden-pages list for a trip (TP-15 page toggles). */
  async setHiddenPages(tripId: string, hiddenPages: string[]): Promise<void> {
    const user = this.requireUser();
    await runInInjectionContext(this.injector, () =>
      updateDoc(this.memberRef(tripId, user.uid), { hiddenPages }),
    );
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private memberRef(tripId: string, uid: string) {
    return doc(this.firestore, 'trips', tripId, 'members', uid);
  }

  /**
   * Append a best-effort entry to the trip's activity log (TP-18). Fire-and-forget:
   * a failed log write must never block the member action that triggered it.
   */
  private logActivity(
    tripId: string,
    action: ActivityAction,
    target: { uid: string; displayName: string },
    performedBy: { uid: string; displayName: string },
  ): void {
    const ref = doc(collection(this.firestore, 'trips', tripId, 'activityLog'));
    const entry: ActivityLogEntry = {
      id: ref.id, action,
      targetUid: target.uid, targetName: target.displayName,
      performedByUid: performedBy.uid, performedByName: performedBy.displayName,
      timestamp: Date.now(),
    };
    setDoc(ref, entry).catch(err => console.warn('[TripService] activity log failed:', err));
  }

  private memberSnapshot(user: FirestoreUser, role: TripMember['role'], now: number): TripMember {
    return {
      uid: user.uid,
      role,
      displayName: user.displayName,
      avatarEmoji: user.avatarEmoji,
      color: user.color,
      joinedAt: now,
    };
  }

  /** Append the trip to the user's trips index and mark it as last active. */
  private indexTrip(uid: string, tripId: string): Promise<void> {
    return setDoc(
      doc(this.firestore, 'userTrips', uid),
      { tripIds: arrayUnion(tripId), lastActiveTrip: tripId },
      { merge: true },
    );
  }

  private requireUser(): FirestoreUser {
    const user = this.userService.firestoreUser();
    if (!user) throw new Error('Must be signed in to manage trips.');
    return user;
  }
}
