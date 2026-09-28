import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, EmailInUseError } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarPickerComponent } from '../../shared/avatar-picker/avatar-picker.component';
import { passwordRules } from '../../utils/password';
import { SignupFormState, SignupField, SignupValues } from '../../utils/signup-form';
import { userMessage } from '../../utils/user-message';
import { LocalCacheService } from '../../services/local-cache.service';

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
  private localCache  = inject(LocalCacheService);

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

  /** Per-field validation + server uniqueness checks (see utils/signup-form). */
  readonly form = new SignupFormState({
    usernameExists: u => this.authService.usernameExists(u),
  });
  /** Set when registration found the email already on an account: the form is
   *  replaced by a neutral "check your inbox" step (see EmailInUseError). */
  readonly checkInbox = signal('');

  values(): SignupValues {
    return { name: this.displayName, username: this.username, email: this.email,
             password: this.password, confirm: this.confirmPass };
  }
  fieldError(field: SignupField): string { return this.form.error(field, this.values()); }
  onBlur(field: SignupField): void { void this.form.blur(field, this.values()); }
  get canSubmit(): boolean { return this.form.isValid(this.values()); }

  /** Set once the user has tried to submit; from then on the red box above the
   *  button lists what still blocks the account, live, until it's all fixed. */
  readonly submitAttempted = signal(false);
  get blockers(): string[] { return this.submitAttempted() ? this.form.problems(this.values()) : []; }
  loading      = signal(false);
  error        = signal('');

  /** Live password-requirement checklist for the template. */
  get passwordChecklist() {
    return passwordRules(this.password);
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.form.touchAll();
    this.submitAttempted.set(true);
    if (!this.canSubmit) return;   // the fields and the box above the button show what's wrong

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
      if (err instanceof EmailInUseError) { this.checkInbox.set(err.email); return; }
      if (this.localCache.recoverIfBroken(err)) return;
      this.error.set(userMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
