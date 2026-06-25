import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
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
} from '@angular/fire/firestore';
import { FirestoreUser, InviteCode } from '../models/trip.models';

const EMAIL_DOMAIN = '@trip-planner.local';

function toEmail(username: string): string {
  return `${username.toLowerCase().trim()}${EMAIL_DOMAIN}`;
}

function randomCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const AVATAR_COLORS = [
  '#B5D5F5', '#88C9A1', '#F9E4B7', '#F5B5D4',
  '#D4B5F5', '#F5D4B5', '#B5F5D4', '#F4C2C2',
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);

  async login(username: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, toEmail(username), password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async register(
    inviteCode: string,
    displayName: string,
    avatarEmoji: string,
    username: string,
    password: string,
    color: string,
  ): Promise<void> {
    // Validate invite code
    const inviteRef  = doc(this.firestore, 'invites', inviteCode);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invalid invite code.');
    const raw = inviteSnap.data() as any;
    const invite: InviteCode = {
      ...raw,
      usedBy: Array.isArray(raw.usedBy) ? raw.usedBy : [],
    };
    if (invite.expiresAt < Date.now()) throw new Error('This invite code has expired.');

    // Check username uniqueness
    const usersRef  = collection(this.firestore, 'users');
    const usernameQ = query(usersRef, where('username', '==', username.toLowerCase().trim()));
    const existing  = await getDocs(usernameQ);
    if (!existing.empty) throw new Error('That username is already taken.');

    // Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(this.auth, toEmail(username), password);
    const uid  = cred.user.uid;

    // Write Firestore user profile
    const userDoc: FirestoreUser = {
      uid,
      displayName:  displayName.trim(),
      username:     username.toLowerCase().trim(),
      avatarEmoji,
      color,
      isAdmin:      false,
      isDisabled:   false,
      createdAt:    Date.now(),
    };
    await setDoc(doc(this.firestore, 'users', uid), userDoc);

    // Record who used this invite code (write normalized array to handle legacy docs)
    await updateDoc(inviteRef, { usedBy: [...invite.usedBy, uid] });
  }

  async generateInviteCode(createdByUid: string): Promise<string> {
    const code = randomCode();
    const invite: InviteCode = {
      code,
      createdBy: createdByUid,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      usedBy:    [],
    };
    await setDoc(doc(this.firestore, 'invites', code), invite);
    return code;
  }

  async validateInviteCode(code: string): Promise<boolean> {
    const snap = await getDoc(doc(this.firestore, 'invites', code));
    if (!snap.exists()) return false;
    const raw = snap.data() as any;
    return raw.expiresAt > Date.now();
  }

  async updateProfile(uid: string, updates: Partial<Pick<FirestoreUser, 'displayName' | 'avatarEmoji' | 'color'>>): Promise<void> {
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

    // Update Firebase Auth email
    const user = this.auth.currentUser;
    if (!user) throw new Error('No authenticated user.');
    await updateEmail(user, toEmail(normalized));

    // Update Firestore
    await updateDoc(doc(this.firestore, 'users', uid), { username: normalized });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user.');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  }

  async disableUser(uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { isDisabled: true });
  }

  readonly avatarColors = AVATAR_COLORS;
}
