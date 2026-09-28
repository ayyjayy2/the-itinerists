import { signal } from '@angular/core';
import { isValidEmail } from './email';
import { passwordProblems } from './password';

/**
 * Field-level validation for the Create Account and Join forms.
 *
 * Rules (from the product ask):
 *  - every field is required; an empty field is flagged when the user taps away;
 *  - username must be unique (checked against the server on blur) and follow
 *    the username policy; email must be email-shaped. Whether an email already
 *    has an account is deliberately NOT revealed here — Firebase reports it at
 *    registration and the form then shows a neutral "check your inbox" step;
 *  - the password must meet the policy; the confirmation is checked live as
 *    the user types, not only on blur.
 *
 * Errors only appear for fields the user has touched (or, for the
 * confirmation, as soon as it has any text), so a fresh form isn't a wall of
 * red. `touchAll()` surfaces everything at once on a submit attempt.
 */
export type SignupField = 'name' | 'username' | 'email' | 'password' | 'confirm';

export interface SignupValues {
  name: string; username: string; email: string; password: string; confirm: string;
}

export interface SignupLookups {
  usernameExists(username: string): Promise<boolean>;
}

export const USERNAME_TAKEN = 'That username is taken.';

export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const normalizeEmail    = (e: string) => e.trim().toLowerCase();

/** Username policy, shared by signup, join and Change Username: 3–20 chars of
 *  lowercase letters, digits, dots, underscores or hyphens (input is lowercased). */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export function usernameProblem(raw: string): string {
  const u = normalizeUsername(raw);
  if (!u) return "Username can't be empty.";
  if (/\s/.test(u)) return "Username can't contain spaces.";
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9._-]+$/.test(u)) return 'Use only letters, numbers, dots, underscores and hyphens.';
  return '';
}

/** Format/required checks only — no server involved. '' when the field is fine. */
export function signupFieldError(field: SignupField, v: SignupValues): string {
  switch (field) {
    case 'name':
      return v.name.trim() ? '' : "Name can't be empty.";
    case 'username':
      return usernameProblem(v.username);
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
  private readonly touched        = signal<ReadonlySet<SignupField>>(new Set());
  private readonly takenUsernames = signal<ReadonlySet<string>>(new Set());

  constructor(private readonly lookups: SignupLookups) {}

  touch(field: SignupField): void {
    if (this.touched().has(field)) return;
    this.touched.update(t => new Set([...t, field]));
  }

  touchAll(): void {
    this.touched.set(new Set<SignupField>(['name', 'username', 'email', 'password', 'confirm']));
  }

  /** Mark the field touched; for the username also ask the server whether it's taken. */
  async blur(field: SignupField, v: SignupValues): Promise<void> {
    this.touch(field);
    if (field !== 'username' || signupFieldError(field, v)) return;   // nothing to look up
    const u = normalizeUsername(v.username);
    if (await this.lookups.usernameExists(u)) this.takenUsernames.update(s => new Set([...s, u]));
  }

  /** Message to show under the field right now, or ''. */
  error(field: SignupField, v: SignupValues): string {
    const live = field === 'confirm' && v.confirm.length > 0;   // mismatch shows as they type
    if (!live && !this.touched().has(field)) return '';
    const basic = signupFieldError(field, v);
    if (basic) return basic;
    if (field === 'username' && this.usernameTaken(v)) return USERNAME_TAKEN;
    return '';
  }

  usernameTaken(v: SignupValues): boolean { return this.takenUsernames().has(normalizeUsername(v.username)); }

  /** Short lines for the red box above the submit button: what still blocks
   *  creating the account, one per field, in form order. */
  problems(v: SignupValues): string[] {
    const out: string[] = [];
    if (signupFieldError('name', v)) out.push('Enter your name.');
    const u = signupFieldError('username', v);
    if (u) out.push(u === "Username can't be empty." ? 'Choose a username.' : u);
    else if (this.usernameTaken(v)) out.push(USERNAME_TAKEN);
    if (signupFieldError('email', v)) out.push('Enter a valid email address.');
    if (signupFieldError('password', v)) out.push("Password doesn't meet the requirements.");
    const c = signupFieldError('confirm', v);
    if (c) out.push(c === 'Please confirm your password.' ? 'Confirm your password.' : c);
    return out;
  }

  /** Everything passes the basic checks and nothing we've looked up is taken. */
  isValid(v: SignupValues): boolean {
    const fields: SignupField[] = ['name', 'username', 'email', 'password', 'confirm'];
    return fields.every(f => !signupFieldError(f, v)) && !this.usernameTaken(v);
  }
}
