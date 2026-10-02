import { Injectable, inject, Injector } from '@angular/core';
import { EmailConfirmService } from './email-confirm.service';
import {
  Auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  createUserWithEmailAndPassword,
  updateEmail,
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
  query,
  where,
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
import { PLACEHOLDER_DOMAIN, isPlaceholderEmail, isValidEmail } from '../utils/email';
import { usernameProblem, normalizeUsername } from '../utils/signup-form';
import { UserService } from './user.service';
import { TripEventsService } from './trip-events.service';

const EMAIL_DOMAIN = PLACEHOLDER_DOMAIN;

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

function randomCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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

  /** Sign in with either the username or the account's (verified) email —
   *  adding a recovery email never replaces the username. */
  async login(usernameOrEmail: string, password: string): Promise<void> {
    const id = usernameOrEmail.trim();
    if (isValidEmail(id)) {
      await signInWithEmailAndPassword(this.auth, id.toLowerCase(), password);
      return;
    }
    // Use the lookup the sign-in page started while the password was typed, if any.
    const key = normalizeUsername(id);
    const lookup = this.emailLookups.get(key) ?? this.resolveEmails(id);
    this.emailLookups.delete(key);
    const { authEmail, pendingEmail } = await lookup;
    try {
      await signInWithEmailAndPassword(this.auth, authEmail, password);
    } catch (err) {
      // If a verification link was clicked on another device, the Auth email
      // has moved on while our mirror hasn't; try the address we were waiting on.
      if (pendingEmail && pendingEmail !== authEmail) {
        await signInWithEmailAndPassword(this.auth, pendingEmail, password);
      } else {
        throw err;
      }
    }
  }

  /** Username → sign-in email lookups started before the person taps Sign in (one-shot). */
  private emailLookups = new Map<string, Promise<{ authEmail: string; pendingEmail?: string }>>();

  /**
   * Start resolving a username's sign-in email while the person is still on
   * the form (they moved to the password field), so tapping Sign in goes
   * straight to the password check: one round trip fewer on the critical path.
   */
  prefetchSignInEmail(usernameOrEmail: string): void {
    const id = usernameOrEmail.trim();
    if (!id || isValidEmail(id)) return;
    const key = normalizeUsername(id);
    if (!key || this.emailLookups.has(key)) return;
    this.emailLookups.set(key, this.resolveEmails(id));
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

  /** Claim usernames/{username} for this account. The rules refuse to
   *  overwrite an entry owned by someone else, so a race between two people
   *  choosing the same name is settled here, not by the pre-check. */
  private async claimUsername(username: string, entry: UsernameEntry): Promise<void> {
    try {
      await setDoc(this.usernameRef(username), entry);
    } catch (err) {
      if ((err as { code?: string })?.code === 'permission-denied') throw new Error('That username is already taken.');
      throw err;
    }
  }

  /** Write the username claim, the public profile and the private account doc
   *  in ONE batch: a single round trip, and all-or-nothing — if the name was
   *  taken meanwhile the whole batch is refused and the Auth account is undone. */
  private async writeNewAccount(cred: { user: { uid: string } & Parameters<typeof deleteUser>[0] }, userDoc: FirestoreUser, authEmail: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.set(this.usernameRef(userDoc.username), { uid: userDoc.uid, authEmail } satisfies UsernameEntry);
    batch.set(doc(this.firestore, 'users', userDoc.uid), userDoc);
    batch.set(this.accountRef(userDoc.uid), { authEmail } satisfies PrivateAccount);
    try {
      await batch.commit();
    } catch (err) {
      await deleteUser(cred.user).catch(() => {/* best effort */});
      if ((err as { code?: string })?.code === 'permission-denied') throw new Error('That username is already taken.');
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

  /** Both addresses on record for a username: the sign-in address and any pending recovery email. */
  private async resolveEmails(username: string): Promise<{ authEmail: string; pendingEmail?: string }> {
    const uname = normalizeUsername(username);
    try {
      const entry = await this.lookupUsername(uname);
      return { authEmail: entry?.authEmail || toEmail(uname), pendingEmail: entry?.pendingEmail || undefined };
    } catch { return { authEmail: toEmail(uname) }; }
  }

  /** Signup check: is this username already claimed? (usernames are public handles) */
  async usernameExists(username: string): Promise<boolean> {
    return (await this.lookupUsername(username)) !== null;
  }

  /**
   * Pre-auth lookup: the email this username's Auth account actually uses.
   * Falls back to the synthetic mapping when the entry is missing or the
   * lookup fails (e.g. offline) — identical to pre-recovery-email behavior.
   */
  async resolveAuthEmail(username: string): Promise<string> {
    const uname = normalizeUsername(username);
    try {
      const entry = await this.lookupUsername(uname);
      if (entry?.authEmail) return entry.authEmail;
    } catch { /* fall through to synthetic */ }
    return toEmail(uname);
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
    username: string,
    password: string,
    color: string,
    letterColor = '',
    email = '',
  ): Promise<void> {
    // Resolve & validate the invite (code → trip).
    const tripId = await this.validateInviteCode(inviteCode);
    if (!tripId) throw new Error('This invite code is invalid or has expired.');

    const inviteRef  = doc(this.firestore, 'trips', tripId, 'invites', inviteCode);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invalid invite code.');
    const raw = inviteSnap.data() as Partial<InviteCode>;
    const usedBy = Array.isArray(raw.usedBy) ? raw.usedBy : [];

    const uname = normalizeUsername(username);
    { const problem = usernameProblem(uname); if (problem) throw new Error(problem); }
    if (await this.lookupUsername(uname)) throw new Error('That username is already taken.');

    // The Auth account is created with the person's real email (unique across
    // accounts, and where password resets go). Legacy accounts used a synthetic
    // username address instead.
    const authEmail = email.toLowerCase().trim() || toEmail(uname);
    const cred = await this.createAuthAccount(authEmail, password);
    const uid  = cred.user.uid;
    const now  = Date.now();

    const userDoc: FirestoreUser = {
      uid,
      displayName:  displayName.trim(),
      username:     uname,
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
    await updateDoc(inviteRef, { usedBy: [...usedBy, uid] });

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
    username: string,
    password: string,
    color: string,
    email: string,
    letterColor = '',
  ): Promise<void> {
    const uname = normalizeUsername(username);
    { const problem = usernameProblem(uname); if (problem) throw new Error(problem); }
    if (await this.lookupUsername(uname)) throw new Error('That username is already taken.');

    // The Auth account is created with the person's real email: unique across
    // accounts (two "nick"s can't share one), and where password resets go.
    const authEmail = email.toLowerCase().trim();
    const cred = await this.createAuthAccount(authEmail, password);
    const uid  = cred.user.uid;
    const now  = Date.now();

    const userDoc: FirestoreUser = {
      uid,
      displayName: displayName.trim(),
      username:    uname,
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

  async updateUsername(uid: string, newUsername: string): Promise<void> {
    const normalized = normalizeUsername(newUsername);
    { const problem = usernameProblem(normalized); if (problem) throw new Error(problem); }

    const user = this.auth.currentUser;
    if (!user) throw new Error('No authenticated user.');
    const current = this.userService.firestoreUser();
    if (!current || current.uid !== uid) throw new Error('No authenticated user.');
    if (current.username === normalized) return;

    const taken = await this.lookupUsername(normalized);
    if (taken && taken.uid !== uid) throw new Error('That username is already taken.');

    // Legacy accounts sign in through a synthetic username address, so that
    // address must follow the username. An account with a real email keeps it.
    let authEmail = current.authEmail || user.email || toEmail(current.username);
    if (isPlaceholderEmail(user.email)) {
      authEmail = toEmail(normalized);
      await updateEmail(user, authEmail);
      await setDoc(this.accountRef(uid), { authEmail }, { merge: true });
    }

    // Claim the new name, switch the profile over, then release the old name.
    const entry: UsernameEntry = { uid, authEmail };
    if (current.pendingEmail) entry.pendingEmail = current.pendingEmail;
    await this.claimUsername(normalized, entry);
    await updateDoc(doc(this.firestore, 'users', uid), { username: normalized });
    await deleteDoc(this.usernameRef(current.username)).catch(() => {/* best effort */});
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user.');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  }

  /**
   * Self-serve reset. Accepts a username (resolved via users.authEmail) or a
   * recovery email entered directly. Returns the (real) email the link was
   * sent to, or null when the account has no recovery email (synthetic
   * address — undeliverable).
   */
  async sendPasswordReset(usernameOrEmail: string): Promise<string | null> {
    const input = usernameOrEmail.toLowerCase().trim();
    const email = input.includes('@') ? input : await this.resolveAuthEmail(input);
    if (email.endsWith(EMAIL_DOMAIN)) return null;
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
    await setDoc(this.accountRef(user.uid), { pendingEmail: email }, { merge: true });
    const username = this.userService.firestoreUser()?.username;
    if (username) await updateDoc(this.usernameRef(username), { pendingEmail: email }).catch(() => {/* index may lag */});
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
    await deleteDoc(doc(this.firestore, 'users', user.uid));

    await deleteUser(user);
    this.tripContext.clearActiveTrip();
  }

  async disableUser(uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { isDisabled: true });
  }

  readonly avatarColors = AVATAR_COLORS;
}
