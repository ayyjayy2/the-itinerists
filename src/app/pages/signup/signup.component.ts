import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';

const EMOJI_OPTIONS = [
  '🌸','🌿','✨','🦋','🐘','🌼','🍑','🌺','🦊','🐬',
  '🌙','⭐','🎵','🌈','🦁','🐻','🌻','🍀','🦅','🐙',
];

/**
 * Open self-serve signup (TP-25): creates a brand-new account with no invite,
 * then hands off to `/get-started` to set up or join a first trip.
 */
@Component({
  selector: 'app-signup',
  imports: [BrandComponent, IconComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router      = inject(Router);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;

  readonly emojiOptions = EMOJI_OPTIONS;
  readonly colorOptions = ['#F4C2C2','#88C9A1','#D4B5F5','#F9E4B7','#F5B5D4','#B5D5F5','#F5D4B5','#B5F5D4'];

  displayName = '';
  avatarEmoji = '🌸';
  username    = '';
  password    = '';
  confirmPass = '';
  color       = '#F4C2C2';

  showPassword = signal(false);
  loading      = signal(false);
  error        = signal('');

  selectEmoji(emoji: string): void { this.avatarEmoji = emoji; }
  selectColor(color: string): void { this.color = color; }

  async submit(): Promise<void> {
    this.error.set('');

    if (!this.displayName.trim()) { this.error.set('Please enter your name.'); return; }
    if (!this.username.trim())    { this.error.set('Please choose a username.'); return; }
    if (this.password.length < 6) { this.error.set('Password must be at least 6 characters.'); return; }
    if (this.password !== this.confirmPass) { this.error.set('Passwords do not match.'); return; }

    this.loading.set(true);
    try {
      await this.authService.registerStandalone(
        this.displayName.trim(),
        this.avatarEmoji,
        this.username.trim(),
        this.password,
        this.color,
      );
      await this.userService.waitForUser();
      this.router.navigate(['/get-started']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
