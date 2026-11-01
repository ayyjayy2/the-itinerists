import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountPromptService } from '../../services/account-prompt.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { EyeButtonDirective } from '../eye-button.directive';
import { signupFieldError } from '../../utils/signup-form';
import { userMessage } from '../../utils/user-message';

/**
 * "Create your account" for a guest (#610): opened when they try to add or
 * change something. An email and a password turn their guest sign-in into an
 * account, keeping the same trips, so they can carry on straight away.
 */
@Component({
  selector: 'app-account-sheet',
  imports: [FormsModule, IconComponent, EyeButtonDirective],
  templateUrl: './account-sheet.component.html',
  styleUrl: './account-sheet.component.scss',
})
export class AccountSheetComponent {
  protected prompt = inject(AccountPromptService);
  private auth = inject(AuthService);

  email = '';
  password = '';
  showPassword = signal(false);
  busy = signal(false);
  error = signal('');
  /** Shown after the account is made, until the sheet is closed. */
  done = signal(false);
  private tried = signal(false);

  fieldError(field: 'email' | 'password'): string {
    if (!this.tried()) return '';
    return signupFieldError(field, { name: 'x', email: this.email, password: this.password, confirm: this.password });
  }

  async create(): Promise<void> {
    this.tried.set(true);
    this.error.set('');
    if (this.fieldError('email') || this.fieldError('password') || this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.upgradeGuest(this.email, this.password);
      this.done.set(true);
      this.password = '';
    } catch (err) {
      this.error.set(userMessage(err, "Couldn't create your account. Check your connection and try again."));
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    this.prompt.open.set(false);
    this.error.set('');
    this.tried.set(false);
    this.done.set(false);
  }
}
