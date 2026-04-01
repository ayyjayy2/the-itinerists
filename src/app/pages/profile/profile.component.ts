import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

const EMOJI_OPTIONS = [
  '🌸','🌿','✨','🦋','🐘','🌼','🍑','🌺','🦊','🐬',
  '🌙','⭐','🎵','🌈','🦁','🐻','🌻','🍀','🦅','🐙',
];

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  readonly emojiOptions = EMOJI_OPTIONS;
  readonly colorOptions = ['#F4C2C2','#88C9A1','#D4B5F5','#F9E4B7','#F5B5D4','#B5D5F5','#F5D4B5','#B5F5D4'];

  firestoreUser = this.userService.firestoreUser;

  displayName = '';
  avatarEmoji = '';
  color       = '';

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';

  profileSaving  = signal(false);
  profileSuccess = signal(false);
  profileError   = signal('');

  passwordSaving  = signal(false);
  passwordSuccess = signal(false);
  passwordError   = signal('');

  ngOnInit(): void {
    const u = this.firestoreUser();
    if (u) {
      this.displayName = u.displayName;
      this.avatarEmoji = u.avatarEmoji;
      this.color       = u.color;
    }
  }

  selectEmoji(emoji: string): void { this.avatarEmoji = emoji; }
  selectColor(color: string): void  { this.color = color; }

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

  async changePassword(): Promise<void> {
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    if (this.newPassword.length < 6) {
      this.passwordError.set('New password must be at least 6 characters.'); return;
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
      setTimeout(() => this.passwordSuccess.set(false), 3000);
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
