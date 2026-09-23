import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  createUserWithEmailAndPassword,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
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
} from '@angular/fire/firestore';
import {
  FirestoreUser, InviteCode, InviteIndexEntry, TripMember,
} from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { BACKGROUND_COLORS } from '../utils/avatar-contrast';
import { PLACEHOLDER_DOMAIN, isPlaceholderEmail } from '../utils/email';

const EMAIL_DOMAIN = PLACEHOLDER_DOMAIN;

function toEmail(username: string): string {
  return `${username.toLowerCase().trim()}${EMAIL_DOMAIN}`;
}

/** Firebase Auth error codes → plain words for the sign-up forms. */
function describeAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/email-already-in-use') return new Error('That email already has an account. Sign in instead, or use "Forgot password?".');
  if (code === 'auth/invalid-email')        return new Error('That email address doesn\'t look right.');
  if (code === 'auth/weak-password')        return new Error('That password is too weak.');
  return err instanceof Error ? err : new Error('Something went wrong. Please try again.');
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

  async login(username: string, password: string): Promise<void> {
    const email = await this.resolveAuthEmail(username);
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Pre-auth lookup: the email this username's Auth account actually uses.
   * Falls back to the synthetic mapping when the doc/field is missing or the
   * lookup fails (e.g. offline) — identical to pre-recovery-email behavior.
   */
  async resolveAuthEmail(username: string): Promise<string> {
    const uname = username.toLowerCase().trim();
    try {
      const q    = query(collection(this.firestore, 'users'), where('username', '==', uname));
      const snap = await getDocs(q);
      const authEmail = snap.docs[0]?.data()['authEmail'] as string | undefined;
      if (authEmail) return authEmail;
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

    // Check username uniqueness
    const usersRef  = collection(this.firestore, 'users');
    const usernameQ = query(usersRef, where('username', '==', username.toLowerCase().trim()));
    const existing  = await getDocs(usernameQ);
    if (!existing.empty) throw new Error('That username is already taken.');

    // Create the Auth account with the person's real email (unique across
    // accounts, and where password resets go). Legacy accounts used a synthetic
    // username address instead.
    const authEmail = email.toLowerCase().trim() || toEmail(username);
    let cred;
    try { cred = await createUserWithEmailAndPassword(this.auth, authEmail, password); }
    catch (err) { throw describeAuthError(err); }
    const uid  = cred.user.uid;
    const now  = Date.now();

    // Write Firestore user profile
    const userDoc: FirestoreUser = {
      uid,
      displayName:  displayName.trim(),
      username:     username.toLowerCase().trim(),
      avatarEmoji,
      color,
      avatarLetterColor: letterColor,
      isAdmin:      false,
      isDisabled:   false,
      createdAt:    now,
      authEmail,
    };
    await setDoc(doc(this.firestore, 'users', uid), userDoc);

    // Join the invited trip: member doc + trips index + member count + usedBy.
    const member: TripMember = {
      uid, role: 'member',
      displayName: userDoc.displayName,
      avatarEmoji, color, avatarLetterColor: letterColor, joinedAt: now,
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
    const uname = username.toLowerCase().trim();

    // Username uniqueness (runs unauthenticated — users is publicly readable).
    const usernameQ = query(collection(this.firestore, 'users'), where('username', '==', uname));
    if (!(await getDocs(usernameQ)).empty) throw new Error('That username is already taken.');

    // The Auth account is created with the person's real email: unique across
    // accounts (two "nick"s can't share one), and where password resets go.
    const authEmail = email.toLowerCase().trim();
    let cred;
    try { cred = await createUserWithEmailAndPassword(this.auth, authEmail, password); }
    catch (err) { throw describeAuthError(err); }
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
      authEmail,
    };
    await setDoc(doc(this.firestore, 'users', uid), userDoc);
  }

  /**
   * Generate a trip-scoped invite (TP-11). Writes the invite under the trip and
   * a `/inviteIndex/{code}` entry so the join flow can resolve it without
   * scanning every trip. Returns the code.
   */
  async generateInviteCode(createdByUid: string, tripId: string): Promise<string> {
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
    const normalized = newUsername.toLowerCase().trim();

    // Check uniqueness
    const usersRef  = collection(this.firestore, 'users');
    const q         = query(usersRef, where('username', '==', normalized));
    const existing  = await getDocs(q);
    if (!existing.empty && existing.docs[0].id !== uid) {
      throw new Error('That username is already taken.');
    }

    const user = this.auth.currentUser;
    if (!user) throw new Error('No authenticated user.');

    // Legacy accounts sign in through a synthetic username address, so that
    // address must follow the username. An account with a real email keeps it.
    const updates: Partial<FirestoreUser> = { username: normalized };
    if (isPlaceholderEmail(user.email)) {
      const synthetic = toEmail(normalized);
      await updateEmail(user, synthetic);
      updates.authEmail = synthetic;
    }
    await updateDoc(doc(this.firestore, 'users', uid), updates);
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
  async addRecoveryEmail(currentPassword: string, newEmail: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('Not signed in.');
    const email = newEmail.toLowerCase().trim();
    const cred  = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updateEmail(user, email);
    const ref = doc(this.firestore, 'users', user.uid);
    try {
      await updateDoc(ref, { authEmail: email });
    } catch {
      await updateDoc(ref, { authEmail: email }); // one retry, then surface
    }
  }

  async disableUser(uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { isDisabled: true });
  }

  readonly avatarColors = AVATAR_COLORS;
}
