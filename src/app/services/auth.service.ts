import { Injectable, inject, Injector } from '@angular/core';
import { EmailConfirmService } from './email-confirm.service';
import {
  Auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  createUserWithEmailAndPassword,
  verifyBeforeUpdateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  arrayUnion,
  increment,
  deleteDoc,
  writeBatch,
} from '@angular/fire/firestore';
import {
  FirestoreUser, InviteCode, InviteIndexEntry, TripMember, PrivateAccount, UsernameEntry,
} from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { TripService } from './trip.service';
import { BACKGROUND_COLORS } from '../utils/avatar-contrast';
import { PLACEHOLDER_DOMAIN, isPlaceholderEmail, isValidEmail, usernameSignInAddress } from '../utils/email';
import { normalizeUsername } from '../utils/signup-form';
import { UserService } from './user.service';
import { randomCode } from '../utils/invite-code';
import { TripEventsService } from './trip-events.service';

const EMAIL_DOMAIN = PLACEHOLDER_DOMAIN;

/** Every new account needs a real email: the form checks it, this backs it up, and so do the rules. */
export function requireSignupEmail(email: string | null | undefined): void {
  if (!isValidEmail((email ?? '').trim())) throw new Error('Enter a valid email address.');
}

function toEmail(username: string): string {
  return `${username.toLowerCase().trim()}${EMAIL_DOMAIN}`;
}

/** Firebase Auth error codes → plain words for the sign-up forms. */
function describeAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-email')        return new Error('That email address doesn\'t look right.');
  if (code === 'auth/weak-password')        return new Error('That password is too weak.');
  if (code === 'auth/operation-not-allowed') return new Error('That email needs to be verified first — check the inbox for the link we sent.');
  return err instanceof Error ? err : new Error('Something went wrong. Please try again.');
}

/**
 * Registration hit an email that already has an account. The UI must not say
 * so (that would confirm who has an account); instead a password-reset email
 * has been sent to the address and the form shows a neutral "check your
 * inbox" step, so the real owner can get back in and anyone else learns nothing.
 */
export class EmailInUseError extends Error {
  constructor(readonly email: string) { super('check-inbox'); }
}

/**
 * Someone typed a username for an account that signs in with its email.
 * Usernames stopped being a sign-in name in #352: the public username index
 * no longer holds anyone's real address, so it can't be turned into one.
 */
export class UseEmailToSignInError extends Error {
  constructor() { super("Use your email address. Usernames can't be used to sign in anymore."); }
}

const AVATAR_COLORS = BACKGROUND_COLORS;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth        = inject(Auth);
  private firestore   = inject(Firestore);
  private tripContext = inject(TripContextService);
  private injector    = inject(Injector);   // TripService is resolved lazily: it injects AuthService itself
  private userService = inject(UserService);
  private events      = inject(TripEventsService);

  /**
   * Sign in with the account's email. Accounts made before sign-up asked for
   * an email still sign in with their username, which maps to a placeholder
   * address (username@the-itinerists.local) that reveals nothing.
   */
  async login(emailOrUsername: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, await this.signInEmail(emailOrUsername), password);
  }

  /** The address to hand Firebase Auth for what the person typed. */
  private async signInEmail(emailOrUsername: string): Promise<string> {
    const id = emailOrUsername.trim();
    if (isValidEmail(id)) return id.toLowerCase();
    const address = usernameSignInAddress(id, await this.lookupUsername(id).catch(() => null));
    if (address === 'use-email') throw new UseEmailToSignInError();
    return address;
  }

  // ── Username index / private account helpers ─────────────────────────────

  private usernameRef(username: string) { return doc(this.firestore, 'usernames', normalizeUsername(username)); }
  private accountRef(uid: string)       { return doc(this.firestore, 'users', uid, 'private', 'account'); }

  /** usernames/{username}, or null when nobody has claimed it. */
  async lookupUsername(username: string): Promise<UsernameEntry | null> {
    const uname = normalizeUsername(username);
    if (!uname) return null;
    const snap = await getDoc(this.usernameRef(uname));
    return snap.exists() ? (snap.data() as UsernameEntry) : null;
  }

  /** Write the profile and the private account doc in ONE batch: a single
   *  round trip, and all-or-nothing — if it's refused the Auth account is undone.
   *  New accounts have no username (#352): they sign in with their email. */
  private async writeNewAccount(cred: { user: { uid: string } & Parameters<typeof deleteUser>[0] }, userDoc: FirestoreUser, authEmail: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.set(doc(this.firestore, 'users', userDoc.uid), userDoc);
    batch.set(this.accountRef(userDoc.uid), { authEmail } satisfies PrivateAccount);
    try {
      await batch.commit();
    } catch (err) {
      await deleteUser(cred.user).catch(() => {/* best effort */});
      throw err;
    }
  }

  /** Create the Firebase Auth account. An address that already has an account
   *  is never reported to the screen (see EmailInUseError). */
  private async createAuthAccount(email: string, password: string) {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      // Gentle confirmation: the link goes out, but sign-up never waits on it or fails over it.
      void this.injector.get(EmailConfirmService).send();
      return cred;
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/email-already-in-use') {
        await sendPasswordResetEmail(this.auth, email).catch(() => {/* best effort */});
        throw new EmailInUseError(email);
      }
      throw describeAuthError(err);
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /**
   * Register a new user via a trip invite, then auto-join that trip (TP-11).
   * The invite code resolves to a tripId through `/inviteIndex`; on success the
   * user becomes a member of the invited trip and it is made active.
   */
  async register(
    inviteCode: string,
    displayName: string,
    avatarEmoji: string,
    password: string,
    color: string,
    letterColor = '',
    email = '',
  ): Promise<void> {
    requireSignupEmail(email);
    // Resolve & validate the invite (code → trip).
    const tripId = await this.validateInviteCode(inviteCode);
    if (!tripId) throw new Error('This invite code is invalid or has expired.');

    const inviteRef  = doc(this.firestore, 'trips', tripId, 'invites', inviteCode);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invalid invite code.');

    // The Auth account is created with the person's real email: how they sign
    // in, and where password resets go. Legacy accounts used a synthetic
    // username address instead.
    const authEmail = email.toLowerCase().trim();
    const cred = await this.createAuthAccount(authEmail, password);
    const uid  = cred.user.uid;
    const now  = Date.now();

    const userDoc: FirestoreUser = {
      uid,
      displayName:  displayName.trim(),
      avatarEmoji,
      color,
      avatarLetterColor: letterColor,
      isAdmin:      false,
      isDisabled:   false,
      createdAt:    now,
    };
    await this.writeNewAccount(cred, userDoc, authEmail);

    // Join the invited trip: member doc + trips index + member count + usedBy.
    const member: TripMember = {
      uid, role: 'member',
      displayName: userDoc.displayName,
      avatarEmoji, color, avatarLetterColor: letterColor, joinedAt: now,
      inviteCode,
    };
    await setDoc(doc(this.firestore, 'trips', tripId, 'members', uid), member);
    await setDoc(
      doc(this.firestore, 'userTrips', uid),
      { tripIds: arrayUnion(tripId), lastActiveTrip: tripId },
      { merge: true },
    );
    await updateDoc(doc(this.firestore, 'trips', tripId), { memberCount: increment(1) });
    await updateDoc(inviteRef, { usedBy: arrayUnion(uid) });

    // Best-effort activity log: the new member joined (TP-18).
    const logRef = doc(collection(this.firestore, 'trips', tripId, 'activityLog'));
    await setDoc(logRef, {
      id: logRef.id, action: 'member_added',
      targetUid: uid, targetName: userDoc.displayName,
      performedByUid: uid, performedByName: userDoc.displayName,
      timestamp: now,
    }).catch(err => console.warn('[AuthService] activity log failed:', err));
    this.events.emit({ kind: 'member', action: 'joined', itemId: '', path: '/trip-settings', summary: 'joined the trip', audience: 'all' }, tripId);

    this.tripContext.switchTrip(tripId);
  }

  /**
   * Register a brand-new user with no invite code (open self-serve signup, TP-25).
   * Creates the Firebase Auth account + Firestore profile and signs them in, but
   * does NOT join or create any trip — onboarding sends them to `/get-started`.
   */
  async registerStandalone(
    displayName: string,
    avatarEmoji: string,
    password: string,
    color: string,
    email: string,
    letterColor = '',
  ): Promise<void> {
    requireSignupEmail(email);

    // The Auth account is created with the person's real email: unique across
    // accounts, how they sign in, and where password resets go.
    const authEmail = email.toLowerCase().trim();
    const cred = await this.createAuthAccount(authEmail, password);
    const uid  = cred.user.uid;
    const now  = Date.now();

    const userDoc: FirestoreUser = {
      uid,
      displayName: displayName.trim(),
      avatarEmoji,
      color,
      avatarLetterColor: letterColor,
      isAdmin:     false,
      isDisabled:  false,
      createdAt:   now,
    };
    await this.writeNewAccount(cred, userDoc, authEmail);
  }

  /** Close an invite: the code and its link stop working immediately. Owner-only by the rules. */
  async revokeInviteCode(tripId: string, code: string): Promise<void> {
    const c = code.trim().toUpperCase();
    await deleteDoc(doc(this.firestore, 'trips', tripId, 'invites', c));
    await deleteDoc(doc(this.firestore, 'inviteIndex', c)).catch(() => {/* index may already be gone */});
  }

  /**
   * Generate a trip-scoped invite (TP-11). Writes the invite under the trip and
   * a `/inviteIndex/{code}` entry so the join flow can resolve it without
   * scanning every trip. Returns the code.
   */
  async generateInviteCode(createdByUid: string, tripId: string): Promise<string> {
    // One live invite per trip: a new one retires whatever came before it, so
    // an old code or link that got passed around can't keep admitting people.
    const previous = await getDocs(collection(this.firestore, 'trips', tripId, 'invites'));
    for (const d of previous.docs) await this.revokeInviteCode(tripId, d.id);

    const code      = randomCode();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const invite: InviteCode = {
      code, tripId,
      createdBy: createdByUid,
      createdAt: Date.now(),
      expiresAt,
      usedBy:    [],
    };
    const index: InviteIndexEntry = { tripId, expiresAt };
    await setDoc(doc(this.firestore, 'trips', tripId, 'invites', code), invite);
    await setDoc(doc(this.firestore, 'inviteIndex', code), index);
    return code;
  }

  /**
   * Resolve an invite code to its tripId if it exists and hasn't expired,
   * else `null`. Reads the global `/inviteIndex` (TP-11).
   */
  async validateInviteCode(code: string): Promise<string | null> {
    const snap = await getDoc(doc(this.firestore, 'inviteIndex', code.trim().toUpperCase()));
    if (!snap.exists()) return null;
    const entry = snap.data() as InviteIndexEntry;
    if (!entry.expiresAt || entry.expiresAt < Date.now()) return null;
    return entry.tripId;
  }

  async updateProfile(uid: string, updates: Partial<Pick<FirestoreUser, 'displayName' | 'avatarEmoji' | 'color' | 'avatarLetterColor'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { ...updates });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user.');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  }

  /**
   * Self-serve reset by email. A username still works for the accounts that
   * sign in with one; those have no deliverable address, so this returns null
   * and the page explains how to get help. Returns the address the link went to.
   */
  async sendPasswordReset(emailOrUsername: string): Promise<string | null> {
    const email = await this.signInEmail(emailOrUsername);
    if (isPlaceholderEmail(email)) return null;
    await sendPasswordResetEmail(this.auth, email);
    return email;
  }

  /**
   * Attach a real recovery email: reauth, swap the Auth account email, mirror
   * it to users/{uid}.authEmail (which username login resolves against).
   * The Firestore write is retried once — a lasting mismatch would break
   * username login for this user.
   */
  /**
   * Attach a real recovery email the verify-first way: Firebase emails a link
   * to the new address and only switches the account's email once it's
   * clicked (required while email-enumeration protection is on). Until then
   * the address is recorded as `pendingEmail`; UserService mirrors it into
   * `authEmail` the next time the app sees the confirmed change.
   */
  async addRecoveryEmail(currentPassword: string, newEmail: string): Promise<void> {
    await this.sendRecoveryEmail(newEmail, currentPassword);
  }

  /**
   * (Re)send the verification link for a recovery email. Firebase treats this
   * as a sensitive action: it goes through without a password only when the
   * user signed in recently, otherwise it throws `auth/requires-recent-login`
   * and the caller should ask for the password and try again with it.
   */
  async sendRecoveryEmail(newEmail: string, currentPassword?: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('Not signed in.');
    const email = newEmail.toLowerCase().trim();
    if (currentPassword) {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
    }
    await verifyBeforeUpdateEmail(user, email, { url: `${window.location.origin}/profile`, handleCodeInApp: false });
    // Private to this person; the public username index never holds a real address.
    await setDoc(this.accountRef(user.uid), { pendingEmail: email }, { merge: true });
  }

  /**
   * Delete the signed-in user's own account. Only the person themselves can do
   * this (admins remove members from trips, never accounts). Order matters:
   *   1. re-authenticate — Firebase refuses to delete a stale session;
   *   2. leave every trip via TripService.leaveTrip: an owned trip passes to
   *      the longest-standing member, a trip they were alone on is deleted,
   *      and their per-trip data (flights, outfits, packing) goes with them;
   *   3. remove the per-user docs (expenses, trip index, profile);
   *   4. delete the Auth user last — after that nothing else is permitted.
   */
  async deleteAccount(currentPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('Not signed in.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));

    const tripService = this.injector.get(TripService);
    const trips = await tripService.getUserTrips(user.uid);
    for (const trip of trips) await tripService.leaveTrip(trip.id);

    const gone = (path: string) => deleteDoc(doc(this.firestore, path, user.uid)).catch(() => {/* may not exist */});
    await gone('userExpenses');
    await gone('userTrips');
    const username = this.userService.firestoreUser()?.username;
    if (username) await deleteDoc(this.usernameRef(username)).catch(() => {/* may not exist */});
    await deleteDoc(this.accountRef(user.uid)).catch(() => {/* may not exist */});
    // Daily-limit counters: the rules let a counter go once its window has passed.
    for (const kind of ['photos', 'trips']) {
      await deleteDoc(doc(this.firestore, '_quotas', user.uid, 'kinds', kind)).catch(() => {/* still counting, or none */});
    }
    await deleteDoc(doc(this.firestore, 'users', user.uid));

    await deleteUser(user);
    this.tripContext.clearActiveTrip();
  }

  readonly avatarColors = AVATAR_COLORS;
}
