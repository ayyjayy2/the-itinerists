import { Injectable, signal, inject, computed, Injector, runInInjectionContext } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, updateDoc, setDoc, Unsubscribe } from '@angular/fire/firestore';
import { TripUser, FirestoreUser, PrivateAccount } from '../models/trip.models';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map, merge } from 'rxjs';
import { authEmailPatch, isPlaceholderEmail } from '../utils/email';
import { TripContextService } from './trip-context.service';
import { CrashReporterService } from './crash-reporter.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private crash = inject(CrashReporterService);
  private auth      = inject(Auth);
  private firestore = inject(Firestore);
  private injector  = inject(Injector);
  private tripContext = inject(TripContextService);

  private _firestoreUser   = signal<FirestoreUser | null>(null);
  private _authInitialized = signal(false);
  private _userLoadError   = signal<Error | null>(null);
  private unsubs: Unsubscribe[] = [];

  readonly firestoreUser   = this._firestoreUser.asReadonly();
  readonly authInitialized = this._authInitialized.asReadonly();

  readonly currentUser = computed<TripUser | null>(() => {
    const u = this._firestoreUser();
    if (!u) return null;
    return { uid: u.uid, name: u.displayName, color: u.color, avatarEmoji: u.avatarEmoji, avatarLetterColor: u.avatarLetterColor };
  });

  readonly isAdmin = computed(() => this._firestoreUser()?.isAdmin ?? false);

  hasUser(): boolean { return this._firestoreUser() !== null; }

  readonly authReadyPromise: Promise<void>;
  private readonly currentUser$ = toObservable(this.currentUser);
  private readonly userLoadError$ = toObservable(this._userLoadError);

  // Rejects if the profile listener errors (e.g. rules/App Check denial) — callers
  // show their error state instead of spinning forever on a user that never comes.
  waitForUser(): Promise<TripUser> {
    return firstValueFrom(
      merge(
        this.currentUser$.pipe(filter((u): u is TripUser => u !== null)),
        this.userLoadError$.pipe(
          filter((e): e is Error => e !== null),
          map(e => { throw e; }),
        ),
      )
    );
  }

  /** Persist the home/nav layout choice on the account. */
  async updateHomeLayout(layout: 'A' | 'B' | 'C'): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { homeLayout: layout }));
  }

  /** Stamp one trip's bell high-water mark — clears that trip's badge on every device,
   *  and leaves other trips' updates unseen until the person switches to them. */
  async markActivitySeen(tripId: string | null | undefined): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid || !tripId) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { [`lastSeenByTrip.${tripId}`]: Date.now() }));
  }

  /** Persist the personal nav/tab order on the account. */
  async updateNavOrder(paths: string[]): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { navOrder: paths }));
  }

  /** Persist Home pins on the account (personalization follows the user across devices). */
  async updateHomePins(pins: string[]): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { homePins: pins }));
  }

  constructor() {
    let resolveReady!: () => void;
    this.authReadyPromise = new Promise(res => (resolveReady = res));
    let initialized = false;

    runInInjectionContext(this.injector, () => {
      authState(this.auth).subscribe(firebaseUser => {
        void this.crash.setUser(firebaseUser?.uid ?? null);
        this.tripContext.bindUser(firebaseUser?.uid ?? null);
        if (!firebaseUser) {
          this.unsubs.forEach(u => u()); this.unsubs = [];
          this._firestoreUser.set(null);
          if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          return;
        }

        // The profile (users/{uid}) is what members can see; the private
        // account doc (sign-in email, pending recovery email) is readable by
        // this person only. They're merged into one FirestoreUser for the app.
        let profile: FirestoreUser | null = null;
        let account: PrivateAccount = {};
        const emit = () => {
          if (!profile || profile.isDisabled) { this._firestoreUser.set(null); return; }
          this._firestoreUser.set({ ...profile, ...account });
        };
        this.unsubs.forEach(u => u()); this.unsubs = [];
        runInInjectionContext(this.injector, () => {
          const uid = firebaseUser.uid;
          this.unsubs.push(onSnapshot(doc(this.firestore, 'users', uid, 'private', 'account'), snap => {
            account = snap.exists() ? (snap.data() as PrivateAccount) : {};
            if (profile) emit();
            // A verified email changes the Auth email outside the app; record it
            // privately. If this account used to sign in with a username, its
            // public index entry drops the old placeholder address, so the sign-in
            // page tells them to use their email (#352). It never holds the real one.
            const patch = authEmailPatch(firebaseUser.email, account);
            if (patch && profile) {
              setDoc(doc(this.firestore, 'users', uid, 'private', 'account'), patch, { merge: true })
                .catch(err => console.error('[UserService] authEmail sync failed:', err));
              if (profile.username && !isPlaceholderEmail(patch.authEmail)) {
                setDoc(doc(this.firestore, 'usernames', profile.username), { uid })
                  .catch(err => console.error('[UserService] username index sync failed:', err));
              }
            }
          }, err => console.error(`[UserService] users/${uid}/private listener error:`, err)));

          this.unsubs.push(onSnapshot(doc(this.firestore, 'users', uid), snap => {
            profile = snap.exists() ? (snap.data() as FirestoreUser) : null;
            emit();
            this._userLoadError.set(null);
            if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          }, err => {
            // A denied listen (rules, App Check) otherwise fails silently and the
            // listener stops — surface it so waitForUser() rejects and guards unblock.
            console.error(`[UserService] users/${firebaseUser.uid} listener error:`, err);
            this._firestoreUser.set(null);
            this._userLoadError.set(err);
            if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          }));
        });
      });
    });
  }
}
