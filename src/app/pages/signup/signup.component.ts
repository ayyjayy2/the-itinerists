import { Location } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService, EmailInUseError } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { EyeButtonDirective } from '../../shared/eye-button.directive';
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
  imports: [BrandComponent, IconComponent, EyeButtonDirective, CommonModule, FormsModule, RouterLink, AvatarPickerComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router      = inject(Router);
  private localCache  = inject(LocalCacheService);
  private route       = inject(ActivatedRoute);
  private location    = inject(Location);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;

  displayName = '';
  avatarEmoji = '🌸';
  avatarLetterColor = '';
  password    = '';
  confirmPass = '';
  email = '';
  color       = '#F4C2C2';

  /** Optional. Filled → the new account joins that trip straight away;
   *  empty → Get started (set up a trip, or do it later). A friend's invite
   *  link lands here with ?code= already filled in. */
  inviteCode     = '';
  /** The code an invite link brought, to tell it from a typed one (Pulse's invite rate, #609). */
  private linkCode = '';
  inviteError    = signal('');
  inviteChecking = signal(false);

  ngOnInit(): void {
    // From the join page (navigation state), or an older ?code= link, whose code
    // is then taken out of the address bar (analytics and history keep URLs).
    const fromJoin = (this.location.getState() as { inviteCode?: string } | null)?.inviteCode ?? '';
    const fromLink = this.route.snapshot.queryParamMap.get('code') ?? '';
    if (fromLink) this.location.replaceState('/signup');
    const code = (fromJoin || fromLink).trim().toUpperCase();
    if (code) { this.inviteCode = code; this.linkCode = code; void this.checkInviteCode(); }
  }

  /** Validate the code on blur (and on arrival from a link). */
  async checkInviteCode(): Promise<void> {
    const code = this.inviteCode.trim().toUpperCase();
    this.inviteCode = code;
    this.inviteError.set('');
    if (!code) return;
    this.inviteChecking.set(true);
    try {
      const tripId = await this.authService.validateInviteCode(code, code === this.linkCode ? 'link' : 'code');
      if (!tripId) this.inviteError.set('This invite code is invalid or has expired.');
    } catch {
      this.inviteError.set("Couldn't check that code. Check your connection and try again.");
    } finally {
      this.inviteChecking.set(false);
    }
  }

  showPassword = signal(false);
  showConfirm  = signal(false);   // each password field has its own eye

  /** Per-field validation (see utils/signup-form). */
  readonly form = new SignupFormState();
  /** Set when registration found the email already on an account: the form is
   *  replaced by a neutral "check your inbox" step (see EmailInUseError). */
  readonly checkInbox = signal('');

  values(): SignupValues {
    return { name: this.displayName, email: this.email, password: this.password, confirm: this.confirmPass };
  }
  fieldError(field: SignupField): string { return this.form.error(field, this.values()); }
  onBlur(field: SignupField): void { this.form.blur(field); }
  get canSubmit(): boolean { return this.form.isValid(this.values()) && !this.inviteError() && !this.inviteChecking(); }

  /** Set once the user has tried to submit; from then on the red box above the
   *  button lists what still blocks the account, live, until it's all fixed. */
  readonly submitAttempted = signal(false);
  get blockers(): string[] {
    if (!this.submitAttempted()) return [];
    const list = this.form.problems(this.values());
    if (this.inviteError()) list.push('Fix or clear the invite code.');
    return list;
  }
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
      const code = this.inviteCode.trim().toUpperCase();
      if (code) {
        // Joins the invited trip as part of registration → straight to Home.
        await this.authService.register(
          code, this.displayName.trim(), this.avatarEmoji,
          this.password, this.color, this.avatarLetterColor, this.email.trim(),
        );
        await this.userService.waitForUser();
        this.router.navigate(['/home']);
      } else {
        await this.authService.registerStandalone(
          this.displayName.trim(),
          this.avatarEmoji,
          this.password,
          this.color,
          this.email.trim(),
          this.avatarLetterColor,
        );
        await this.userService.waitForUser();
        this.router.navigate(['/get-started']);
      }
    } catch (err: any) {
      if (err instanceof EmailInUseError) { this.checkInbox.set(err.email); return; }
      if (this.localCache.recoverIfBroken(err)) return;
      this.error.set(userMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
