import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { effectiveHomeLayout, HomeLayout } from '../../utils/layout';
import { passwordRules, isPasswordValid, passwordProblems } from '../../utils/password';

const EMOJI_OPTIONS = [
  '🌸','🌿','✨','🦋','🐘','🌼','🍑','🌺','🦊','🐬',
  '🌙','⭐','🎵','🌈','🦁','🐻','🌻','🍀','🦅','🐙',
];

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private userService  = inject(UserService);
  private usersService = inject(UsersService);
  private authService  = inject(AuthService);
  private router       = inject(Router);

  readonly emojiOptions = EMOJI_OPTIONS;
  readonly colorOptions = ['#F4C2C2','#88C9A1','#D4B5F5','#F9E4B7','#F5B5D4','#B5D5F5','#F5D4B5','#B5F5D4'];

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

  readonly homeLayout = computed(() => effectiveHomeLayout(this.firestoreUser()));
  /** Layout experiments are Alayna-only. Gate on uid too so a username change
   *  can never hide the picker. Do not remove without her explicit say-so. */
  private readonly LAYOUT_PICKER_UID = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';
  readonly canPickLayout = computed(() => {
    const u = this.firestoreUser();
    return u?.username === 'alayna' || u?.uid === this.LAYOUT_PICKER_UID;
  });

  setLayout(layout: HomeLayout): void {
    void this.userService.updateHomeLayout(layout);
  }

  /** Current recovery email, or '' while the account still uses the synthetic address. */
  get currentRecoveryEmail(): string {
    const e = this.firestoreUser()?.authEmail ?? '';
    return e.endsWith('@the-itinerists.local') ? '' : e;
  }

  ngOnInit(): void {
    const u = this.firestoreUser();
    if (u) {
      this.displayName = u.displayName;
      this.username    = u.username;
      this.avatarEmoji = u.avatarEmoji;
      this.color       = u.color;
    }
  }

  selectEmoji(emoji: string): void {
    if (this.takenEmojis().has(emoji)) return;
    this.avatarEmoji = emoji;
  }
  selectColor(color: string): void  { this.color = color; }

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
    this.showRecoveryModal.set(true);
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
      this.recoveryEmail = '';
      this.recoveryPass  = '';
      this.recoverySuccess.set(true);
      setTimeout(() => { this.recoverySuccess.set(false); this.closeRecoveryModal(); }, 1500);
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        this.recoveryError.set('Current password is incorrect.');
      } else if (err?.code === 'auth/email-already-in-use') {
        this.recoveryError.set('That email is already attached to another account.');
      } else if (err?.code === 'auth/invalid-email') {
        this.recoveryError.set('That email address doesn\'t look valid.');
      } else {
        this.recoveryError.set('Could not save the recovery email. Please try again.');
      }
    } finally {
      this.recoverySaving.set(false);
    }
  }

  async saveUsername(): Promise<void> {
    const uid = this.firestoreUser()?.uid;
    const normalized = this.username.toLowerCase().trim();
    if (!uid || !normalized) return;
    if (normalized === this.firestoreUser()?.username) { this.closeUsernameModal(); return; }
    this.usernameSaving.set(true);
    this.usernameError.set('');
    this.usernameSuccess.set(false);
    try {
      await this.authService.updateUsername(uid, normalized);
      this.usernameSuccess.set(true);
      setTimeout(() => { this.usernameSuccess.set(false); this.closeUsernameModal(); }, 1500);
    } catch (err: any) {
      this.usernameError.set(err?.message ?? 'Failed to update username.');
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

  async confirmLogout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
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
