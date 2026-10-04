import { signal } from '@angular/core';
import { isValidEmail } from './email';
import { passwordProblems } from './password';

/**
 * Field-level validation for the Create Account form.
 *
 * Rules (from the product ask):
 *  - every field is required; an empty field is flagged when the user taps away;
 *  - the email must be email-shaped. It is how the person signs in (accounts
 *    have no username since #352). Whether an email already has an account is
 *    deliberately NOT revealed here: Firebase reports it at registration and
 *    the form then shows a neutral "check your inbox" step;
 *  - the password must meet the policy; the confirmation is checked live as
 *    the user types, not only on blur.
 *
 * Errors only appear for fields the user has touched (or, for the
 * confirmation, as soon as it has any text), so a fresh form isn't a wall of
 * red. `touchAll()` surfaces everything at once on a submit attempt.
 */

export type SignupField = 'name' | 'email' | 'password' | 'confirm';

export interface SignupValues {
  name: string; email: string; password: string; confirm: string;
}

const FIELDS: SignupField[] = ['name', 'email', 'password', 'confirm'];

/** Usernames survive only as the sign-in name of accounts made before sign-up
 *  asked for an email; lookups lowercase them. */
export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const normalizeEmail    = (e: string) => e.trim().toLowerCase();

/** Format/required checks only — no server involved. '' when the field is fine. */
export function signupFieldError(field: SignupField, v: SignupValues): string {
  switch (field) {
    case 'name':
      return v.name.trim() ? '' : "Name can't be empty.";
    case 'email': {
      const e = v.email.trim();
      if (!e) return "Email can't be empty.";
      return isValidEmail(e) ? '' : 'Enter a valid email address.';
    }
    case 'password':
      if (!v.password) return "Password can't be empty.";
      return passwordProblems(v.password);
    case 'confirm':
      if (!v.confirm) return 'Please confirm your password.';
      return v.confirm === v.password ? '' : "Passwords don't match.";
  }
}

export class SignupFormState {
  private readonly touched = signal<ReadonlySet<SignupField>>(new Set());

  touch(field: SignupField): void {
    if (this.touched().has(field)) return;
    this.touched.update(t => new Set([...t, field]));
  }

  touchAll(): void {
    this.touched.set(new Set<SignupField>(FIELDS));
  }

  blur(field: SignupField): void {
    this.touch(field);
  }

  /** Message to show under the field right now, or ''. */
  error(field: SignupField, v: SignupValues): string {
    const live = field === 'confirm' && v.confirm.length > 0;   // mismatch shows as they type
    if (!live && !this.touched().has(field)) return '';
    return signupFieldError(field, v);
  }

  /** Short lines for the red box above the submit button: what still blocks
   *  creating the account, one per field, in form order. */
  problems(v: SignupValues): string[] {
    const out: string[] = [];
    if (signupFieldError('name', v)) out.push('Enter your name.');
    if (signupFieldError('email', v)) out.push('Enter a valid email address.');
    if (signupFieldError('password', v)) out.push("Password doesn't meet the requirements.");
    const c = signupFieldError('confirm', v);
    if (c) out.push(c === 'Please confirm your password.' ? 'Confirm your password.' : c);
    return out;
  }

  /** Everything passes the basic checks. */
  isValid(v: SignupValues): boolean {
    return FIELDS.every(f => !signupFieldError(f, v));
  }
}
