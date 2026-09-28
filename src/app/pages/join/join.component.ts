import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarPickerComponent } from '../../shared/avatar-picker/avatar-picker.component';
import { passwordRules } from '../../utils/password';
import { SignupFormState, SignupField, SignupValues, EMAIL_EXISTS } from '../../utils/signup-form';
import { userMessage } from '../../utils/user-message';
import { LocalCacheService } from '../../services/local-cache.service';

@Component({
  selector: 'app-join',
  imports: [BrandComponent, IconComponent, CommonModule, FormsModule, RouterLink, AvatarPickerComponent],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss'
})
export class JoinComponent implements OnInit {
  private authService = inject(AuthService);
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private localCache  = inject(LocalCacheService);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;

  inviteCode    = '';
  codeValid     = signal<boolean | null>(null); // null = checking
  codeError     = signal('');

  displayName   = '';
  avatarEmoji   = '🌸';
  avatarLetterColor = '';
  email         = '';
  username      = '';
  password      = '';
  confirmPass   = '';
  color         = '#F4C2C2';

  showPassword  = signal(false);

  /** Per-field validation + server uniqueness checks (see utils/signup-form). */
  readonly form = new SignupFormState({
    usernameExists: u => this.authService.usernameExists(u),
    emailExists:    e => this.authService.emailExists(e),
  });
  readonly EMAIL_EXISTS = EMAIL_EXISTS;

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
  loading       = signal(false);
  error         = signal('');
  step          = signal<'validating' | 'form' | 'invalid'>('validating');

  async ngOnInit(): Promise<void> {
    this.inviteCode = this.route.snapshot.queryParams['code'] ?? '';

    // Already signed in? Resolve the code and join the trip directly (TP-11).
    if (this.inviteCode && this.userService.hasUser()) {
      this.step.set('validating');
      try {
        await this.tripService.joinByCode(this.inviteCode);
        this.router.navigate(['/home']);
        return;
      } catch (err: any) {
        if (this.localCache.recoverIfBroken(err)) return;
        this.step.set('invalid');
        this.codeError.set(userMessage(err, 'This invite code is invalid or has expired.'));
        return;
      }
    }

    if (this.inviteCode) {
      this.validateCode();
    } else {
      this.step.set('form'); // manual code entry
    }
  }

  async validateCode(): Promise<void> {
    this.step.set('validating');
    try {
      const tripId = await this.authService.validateInviteCode(this.inviteCode.trim().toUpperCase());
      if (tripId) {
        this.step.set('form');
      } else {
        this.step.set('invalid');
        this.codeError.set('This invite code is invalid or has already been used.');
      }
    } catch (err) {
      if (this.localCache.recoverIfBroken(err)) return;
      this.step.set('invalid');
      this.codeError.set('Could not validate the invite code. Please try again.');
    }
  }

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
      await this.authService.register(
        this.inviteCode.trim().toUpperCase(),
        this.displayName.trim(),
        this.avatarEmoji,
        this.username.trim(),
        this.password,
        this.color,
        this.avatarLetterColor,
        this.email.trim(),
      );
      this.router.navigate(['/home']);
    } catch (err: any) {
      if (this.localCache.recoverIfBroken(err)) return;
      this.error.set(userMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
