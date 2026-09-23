import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarPickerComponent } from '../../shared/avatar-picker/avatar-picker.component';
import { passwordRules, isPasswordValid, passwordProblems } from '../../utils/password';
import { isValidEmail } from '../../utils/email';

/**
 * Open self-serve signup (TP-25): creates a brand-new account with no invite,
 * then hands off to `/get-started` to set up or join a first trip.
 */
@Component({
  selector: 'app-signup',
  imports: [BrandComponent, IconComponent, CommonModule, FormsModule, RouterLink, AvatarPickerComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router      = inject(Router);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;

  displayName = '';
  avatarEmoji = '🌸';
  avatarLetterColor = '';
  username    = '';
  password    = '';
  confirmPass = '';
  email = '';
  color       = '#F4C2C2';

  showPassword = signal(false);
  loading      = signal(false);
  error        = signal('');

  /** Live password-requirement checklist for the template. */
  get passwordChecklist() {
    return passwordRules(this.password);
  }

  async submit(): Promise<void> {
    this.error.set('');

    if (!this.displayName.trim()) { this.error.set('Please enter your name.'); return; }
    if (!this.username.trim())    { this.error.set('Please choose a username.'); return; }
    if (!isValidEmail(this.email)) { this.error.set('Please enter a valid email address.'); return; }
    if (!isPasswordValid(this.password)) { this.error.set(passwordProblems(this.password)); return; }
    if (this.password !== this.confirmPass) { this.error.set('Passwords do not match.'); return; }

    this.loading.set(true);
    try {
      await this.authService.registerStandalone(
        this.displayName.trim(),
        this.avatarEmoji,
        this.username.trim(),
        this.password,
        this.color,
        this.email.trim(),
        this.avatarLetterColor,
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
