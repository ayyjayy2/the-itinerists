import { Injectable, inject, Injector, runInInjectionContext, signal, effect } from '@angular/core';
import {
  Firestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot,
  arrayUnion, increment, Unsubscribe,
} from '@angular/fire/firestore';
import { UserService } from './user.service';
import { TripContextService } from './trip-context.service';
import { AuthService } from './auth.service';
import { TripDoc, TripMember, UserTripsDoc, FirestoreUser } from '../models/trip.models';

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
  private activeTripUnsub?: Unsubscribe;

  private restoring = false;

  constructor() {
    // Keep `activeTrip` in sync with whichever trip is currently active.
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
    this.activeTripUnsub?.(); this.activeTripUnsub = undefined;
    if (!tripId) { this._activeTrip.set(null); return; }
    runInInjectionContext(this.injector, () => {
      this.activeTripUnsub = onSnapshot(doc(this.firestore, 'trips', tripId), snap => {
        this._activeTrip.set(snap.exists() ? (snap.data() as TripDoc) : null);
      });
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

  // ── helpers ──────────────────────────────────────────────────────────────────

  private memberRef(tripId: string, uid: string) {
    return doc(this.firestore, 'trips', tripId, 'members', uid);
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
