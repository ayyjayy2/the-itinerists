import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';
import { AvatarPickerComponent } from '../../shared/avatar-picker/avatar-picker.component';
import { canPickLayout, effectiveHomeLayout, HomeLayout } from '../../utils/layout';
import { passwordRules, isPasswordValid, passwordProblems } from '../../utils/password';
import { recoveryEmailErrorMessage } from '../../utils/email';
import { usernameProblem } from '../../utils/signup-form';
import { userMessage } from '../../utils/user-message';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, IconComponent, AvatarPickerComponent, AvatarGlyphComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private userService  = inject(UserService);
  private usersService = inject(UsersService);
  private authService  = inject(AuthService);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);

  firestoreUser = this.userService.firestoreUser;

  readonly takenEmojis = computed(() => {
    const myUid = this.firestoreUser()?.uid;
    return new Set(
      this.usersService.allUsers()
        .filter(u => u.uid !== myUid)
        .map(u => u.avatarEmoji)
    );
  });

  displayName = '';
  username    = '';
  avatarEmoji = '';
  color       = '';
  avatarLetterColor = '';

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';

  showUsernameModal = signal(false);
  showPasswordModal = signal(false);

  usernameSaving  = signal(false);
  usernameSuccess = signal(false);
  usernameError   = signal('');

  profileSaving  = signal(false);
  profileSuccess = signal(false);
  profileError   = signal('');

  passwordSaving  = signal(false);
  passwordSuccess = signal(false);
  passwordError   = signal('');

  recoveryEmail     = '';
  recoveryPass      = '';
  showRecoveryModal = signal(false);
  recoverySaving    = signal(false);
  recoverySuccess   = signal(false);
  recoveryError     = signal('');
  /** 'resend' when a link is already waiting on an address (one tap to send
   *  it again); 'form' to enter a new address and password. */
  recoveryMode      = signal<'resend' | 'form'>('form');

  readonly homeLayout = computed(() => effectiveHomeLayout(this.firestoreUser()));
  readonly canPickLayout = computed(() => canPickLayout(this.firestoreUser()));

  setLayout(layout: HomeLayout): void {
    void this.userService.updateHomeLayout(layout);
  }

  /** Current recovery email, or '' while the account still uses the synthetic address. */
  /** Address a verification link was just sent to (for the confirmation message). */
  recoverySentTo = '';

  /** A recovery email waiting for its link to be clicked. */
  get pendingRecoveryEmail(): string { return this.firestoreUser()?.pendingEmail ?? ''; }

  get currentRecoveryEmail(): string {
    const e = this.firestoreUser()?.authEmail ?? '';
    return e.endsWith('@the-itinerists.local') ? '' : e;
  }

  ngOnInit(): void {
    // Home's recovery nudge deep-links here with ?recovery=1.
    if (this.route.snapshot.queryParamMap.get('recovery')) this.openRecoveryModal();
    const u = this.firestoreUser();
    if (u) {
      this.displayName = u.displayName;
      this.username    = u.username;
      this.avatarEmoji = u.avatarEmoji;
      this.color       = u.color;
      this.avatarLetterColor = u.avatarLetterColor ?? '';
    }
  }

  openUsernameModal(): void {
    this.username = this.firestoreUser()?.username ?? '';
    this.usernameError.set('');
    this.usernameSuccess.set(false);
    this.showUsernameModal.set(true);
  }

  closeUsernameModal(): void { this.showUsernameModal.set(false); }

  openPasswordModal(): void {
    this.currentPassword = '';
    this.newPassword     = '';
    this.confirmPassword = '';
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    this.showPasswordModal.set(true);
  }

  closePasswordModal(): void { this.showPasswordModal.set(false); }

  openRecoveryModal(): void {
    this.recoveryEmail = '';
    this.recoveryPass  = '';
    this.recoveryError.set('');
    this.recoverySuccess.set(false);
    this.recoveryMode.set(this.pendingRecoveryEmail ? 'resend' : 'form');
    this.showRecoveryModal.set(true);
  }

  /** From resend mode: show the full form to enter another address. */
  useDifferentEmail(): void {
    this.recoveryError.set('');
    this.recoverySuccess.set(false);
    this.recoveryMode.set('form');
  }

  /** Send the waiting link again. Firebase treats this as a sensitive action
   *  and wants a fresh sign-in, so the password is asked for up front. */
  async resendRecoveryEmail(): Promise<void> {
    const email = this.pendingRecoveryEmail;
    if (!email || !this.recoveryPass) return;
    this.recoveryError.set('');
    this.recoverySuccess.set(false);
    this.recoverySaving.set(true);
    try {
      await this.authService.sendRecoveryEmail(email, this.recoveryPass);
      this.recoverySentTo = email;
      this.recoveryPass = '';
      this.recoverySuccess.set(true);
    } catch (err) {
      this.recoveryError.set(recoveryEmailErrorMessage(err));
    } finally {
      this.recoverySaving.set(false);
    }
  }

  closeRecoveryModal(): void { this.showRecoveryModal.set(false); }

  async saveRecoveryEmail(): Promise<void> {
    this.recoveryError.set('');
    this.recoverySuccess.set(false);
    const email = this.recoveryEmail.trim();
    if (!email || !this.recoveryPass) return;
    this.recoverySaving.set(true);
    try {
      await this.authService.addRecoveryEmail(this.recoveryPass, email);
      this.recoverySentTo = email;
      this.recoveryEmail = '';
      this.recoveryPass  = '';
      this.recoverySuccess.set(true);
    } catch (err) {
      this.recoveryError.set(recoveryEmailErrorMessage(err));
    } finally {
      this.recoverySaving.set(false);
    }
  }

  async saveUsername(): Promise<void> {
    const uid = this.firestoreUser()?.uid;
    const normalized = this.username.toLowerCase().trim();
    if (!uid) return;
    if (normalized === this.firestoreUser()?.username) { this.closeUsernameModal(); return; }
    const problem = usernameProblem(normalized);
    if (problem) { this.usernameError.set(problem); return; }
    this.usernameSaving.set(true);
    this.usernameError.set('');
    this.usernameSuccess.set(false);
    try {
      await this.authService.updateUsername(uid, normalized);
      this.usernameSuccess.set(true);
      setTimeout(() => { this.usernameSuccess.set(false); this.closeUsernameModal(); }, 1500);
    } catch (err: any) {
      this.usernameError.set(userMessage(err, 'Failed to update username.'));
    } finally {
      this.usernameSaving.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    const uid = this.firestoreUser()?.uid;
    if (!uid || !this.displayName.trim()) return;
    this.profileSaving.set(true);
    this.profileError.set('');
    this.profileSuccess.set(false);
    try {
      await this.authService.updateProfile(uid, {
        displayName: this.displayName.trim(),
        avatarEmoji: this.avatarEmoji,
        color:       this.color,
        avatarLetterColor: this.avatarLetterColor,
      });
      this.profileSuccess.set(true);
      setTimeout(() => this.profileSuccess.set(false), 3000);
    } catch {
      this.profileError.set('Failed to save profile. Please try again.');
    } finally {
      this.profileSaving.set(false);
    }
  }

  showLogoutConfirm = signal(false);

  // ── Delete account (self-service only; admins never delete accounts) ──
  showDeleteModal = signal(false);
  deletePass      = '';
  deleteSaving    = signal(false);
  deleteError     = signal('');

  openDeleteModal(): void {
    this.deletePass = '';
    this.deleteError.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void { this.showDeleteModal.set(false); }

  async confirmDeleteAccount(): Promise<void> {
    if (!this.deletePass) return;
    this.deleteError.set('');
    this.deleteSaving.set(true);
    try {
      await this.authService.deleteAccount(this.deletePass);
      this.leaveApp();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const wrongPassword = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(code);
      this.deleteError.set(wrongPassword
        ? 'Current password is incorrect.'
        : userMessage(err, 'Could not delete your account. Please try again.'));
    } finally {
      this.deleteSaving.set(false);
    }
  }

  /** Full load of the sign-in screen: clears every in-memory listener. */
  leaveApp(): void { window.location.assign('/login'); }

  /** Sign out, then load the sign-in screen fresh. A full load (not an in-app
   *  route change) clears every in-memory listener and can't be stalled by a
   *  page chunk from an older deploy. */
  async confirmLogout(): Promise<void> {
    this.showLogoutConfirm.set(false);
    try { await this.authService.logout(); }
    finally { window.location.assign('/login'); }
  }

  /** Live password-requirement checklist for the change-password form. */
  get passwordChecklist() {
    return passwordRules(this.newPassword);
  }

  async changePassword(): Promise<void> {
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    if (!isPasswordValid(this.newPassword)) {
      this.passwordError.set(passwordProblems(this.newPassword)); return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('Passwords do not match.'); return;
    }
    this.passwordSaving.set(true);
    try {
      await this.authService.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = '';
      this.newPassword     = '';
      this.confirmPassword = '';
      this.passwordSuccess.set(true);
      setTimeout(() => { this.passwordSuccess.set(false); this.closePasswordModal(); }, 1500);
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        this.passwordError.set('Current password is incorrect.');
      } else {
        this.passwordError.set('Failed to change password. Please try again.');
      }
    } finally {
      this.passwordSaving.set(false);
    }
  }
}
