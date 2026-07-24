# Password Reset + Signup Checklist + Account Pins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve password reset via optional real recovery email (plus an admin script fallback), password requirements shown upfront on signup, and Home pins stored on the account so personalization follows the user across devices.

**Architecture:** No backend. The Auth account's email becomes the real recovery email when one is added; username login keeps working via a pre-auth Firestore lookup (`users.authEmail`). Firebase's hosted reset page does the actual reset. Pins move from `localStorage` to `users/{uid}.homePins` with a one-time in-code migration.

**Tech Stack:** Angular 19 (standalone components, signals), @angular/fire (Auth + Firestore), Jasmine/Karma (`npm run test:ci`), firebase-admin (Node script).

**Spec:** `docs/superpowers/specs/2026-07-24-password-reset-design.md`

**Conventions used throughout:**
- Run tests with: `npm run test:ci` (headless, all specs). Expected failures/passes noted per step.
- Commit per task using the repo's flow: branch from master, conventional-commit message ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. (One feature branch for the whole plan is fine; commit after each task.)
- The dev server needs `src/version.ts` and `src/environments/environment.ts` — both generated; if missing run `node scripts/set-version.js` and `npm run gen-env`.

---

### Task 1: Model fields + email-masking util

**Files:**
- Modify: `src/app/models/trip.models.ts:11-20` (FirestoreUser)
- Create: `src/app/utils/email.ts`
- Test: `src/app/utils/email.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/utils/email.spec.ts
import { maskEmail } from './email';

describe('maskEmail', () => {
  it('masks the local part, keeping first char and domain', () => {
    expect(maskEmail('makaela@gmail.com')).toBe('m•••@gmail.com');
  });

  it('handles a one-char local part', () => {
    expect(maskEmail('a@b.co')).toBe('a•••@b.co');
  });

  it('returns input unchanged when there is no @', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });
});
```

- [ ] **Step 2: Run tests, verify the new specs fail**

Run: `npm run test:ci` — Expected: 3 FAILs, "Cannot find module './email'" (or similar).

- [ ] **Step 3: Implement**

```ts
// src/app/utils/email.ts
/** 'makaela@gmail.com' → 'm•••@gmail.com' (for confirmation messages). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return `${email[0]}•••${email.slice(at)}`;
}
```

In `src/app/models/trip.models.ts`, extend `FirestoreUser` (after `createdAt`):

```ts
export interface FirestoreUser {
  uid: string;
  displayName: string;
  username: string;
  avatarEmoji: string;
  color: string;
  isAdmin: boolean;
  isDisabled?: boolean;
  createdAt: number;   // unix ms
  /** Email the Auth account signs in with. Absent → synthetic username@the-itinerists.local. */
  authEmail?: string;
  /** Pinned Home shortcuts (page paths). Absent → default set. */
  homePins?: string[];
}
```

- [ ] **Step 4: Run tests, verify all pass** — `npm run test:ci`, expected `TOTAL: 42 SUCCESS`.

- [ ] **Step 5: Commit** — `feat(auth): FirestoreUser authEmail/homePins fields + maskEmail util`

---

### Task 2: Username → authEmail resolution in AuthService

**Files:**
- Modify: `src/app/services/auth.service.ts` (login at line ~52; add method + import)

- [ ] **Step 1: Add `resolveAuthEmail` and use it in `login`**

In `src/app/services/auth.service.ts`, add `sendPasswordResetEmail` to the `@angular/fire/auth` import list (used in Task 3), then:

```ts
  /**
   * Pre-auth lookup: the email this username's Auth account actually uses.
   * Falls back to the synthetic mapping when the doc/field is missing or the
   * lookup fails (e.g. offline) — identical to pre-recovery-email behavior.
   */
  async resolveAuthEmail(username: string): Promise<string> {
    const uname = username.toLowerCase().trim();
    try {
      const q    = query(collection(this.firestore, 'users'), where('username', '==', uname));
      const snap = await getDocs(q);
      const authEmail = snap.docs[0]?.data()['authEmail'] as string | undefined;
      if (authEmail) return authEmail;
    } catch { /* fall through to synthetic */ }
    return toEmail(uname);
  }
```

Replace the body of `login`:

```ts
  async login(username: string, password: string): Promise<void> {
    const email = await this.resolveAuthEmail(username);
    await signInWithEmailAndPassword(this.auth, email, password);
  }
```

- [ ] **Step 2: Verify** — `npm run test:ci` still all-pass; `npx ng build` succeeds.

- [ ] **Step 3: Manual check** — dev server: log out, sign in by username (account with no `authEmail` → synthetic fallback path). Must succeed exactly as before.

- [ ] **Step 4: Commit** — `feat(auth): resolve username to authEmail at login`

---

### Task 3: sendPasswordReset + addRecoveryEmail in AuthService

**Files:**
- Modify: `src/app/services/auth.service.ts`

- [ ] **Step 1: Add both methods** (below `changePassword`, line ~231):

```ts
  /**
   * Self-serve reset. Returns the (real) email the link was sent to, or null
   * when the account has no recovery email (synthetic address — undeliverable).
   */
  async sendPasswordReset(username: string): Promise<string | null> {
    const email = await this.resolveAuthEmail(username);
    if (email.endsWith(EMAIL_DOMAIN)) return null;
    await sendPasswordResetEmail(this.auth, email);
    return email;
  }

  /**
   * Attach a real recovery email: reauth, swap the Auth account email, mirror
   * it to users/{uid}.authEmail (which username login resolves against).
   * The Firestore write is retried once — a lasting mismatch would break
   * username login for this user.
   */
  async addRecoveryEmail(currentPassword: string, newEmail: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error('Not signed in.');
    const email = newEmail.toLowerCase().trim();
    const cred  = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updateEmail(user, email);
    const ref = doc(this.firestore, 'users', user.uid);
    try {
      await updateDoc(ref, { authEmail: email });
    } catch {
      await updateDoc(ref, { authEmail: email }); // one retry, then surface
    }
  }
```

- [ ] **Step 2: Verify** — `npm run test:ci` all-pass; `npx ng build` succeeds.

- [ ] **Step 3: Commit** — `feat(auth): sendPasswordReset + addRecoveryEmail`

---

### Task 4: Forgot-password page + route + login link

**Files:**
- Create: `src/app/pages/forgot-password/forgot-password.component.ts` (inline template/styles — page is small)
- Modify: `src/app/app.routes.ts` (public route after `login`)
- Modify: `src/app/pages/login/login.component.html` (link)
- Test: `src/app/pages/forgot-password/forgot-password.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/pages/forgot-password/forgot-password.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';

describe('ForgotPasswordComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['sendPasswordReset']);
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  it('shows the masked email after a successful send', async () => {
    auth.sendPasswordReset.and.resolveTo('makaela@gmail.com');
    const { comp } = create();
    comp.username = 'makaela';
    await comp.submit();
    expect(comp.sentTo()).toBe('m•••@gmail.com');
    expect(comp.noRecovery()).toBeFalse();
  });

  it('shows the no-recovery message when reset returns null', async () => {
    auth.sendPasswordReset.and.resolveTo(null);
    const { comp } = create();
    comp.username = 'makaela';
    await comp.submit();
    expect(comp.noRecovery()).toBeTrue();
    expect(comp.sentTo()).toBe('');
  });

  it('shows an error when the send fails', async () => {
    auth.sendPasswordReset.and.rejectWith(new Error('boom'));
    const { comp } = create();
    comp.username = 'makaela';
    await comp.submit();
    expect(comp.error()).toContain('Something went wrong');
  });
});
```

- [ ] **Step 2: Run tests, verify the new specs fail** — module not found.

- [ ] **Step 3: Implement the component**

```ts
// src/app/pages/forgot-password/forgot-password.component.ts
import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BrandComponent } from '../../shared/brand/brand.component';
import { maskEmail } from '../../utils/email';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, BrandComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <app-brand />
        <h2>Reset your password</h2>

        @if (sentTo()) {
          <p class="info">Reset link sent to <strong>{{ sentTo() }}</strong>.
            Follow it to choose a new password, then sign in here.</p>
        } @else if (noRecovery()) {
          <p class="info">No recovery email is on file for this username —
            ask an admin to reset your password.</p>
        } @else {
          <p class="hint">Enter your username. If a recovery email is on file,
            we'll send a reset link there.</p>
          <form (ngSubmit)="submit()">
            <div class="form-group">
              <label>Username</label>
              <input [(ngModel)]="username" name="username" autocomplete="username" required />
            </div>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <button type="submit" class="primary" [disabled]="loading() || !username.trim()">
              {{ loading() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        }

        <p class="alt"><a routerLink="/login">Back to sign in</a></p>
      </div>
    </div>
  `,
  styleUrl: '../login/login.component.scss',
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);

  username   = '';
  loading    = signal(false);
  error      = signal('');
  sentTo     = signal('');
  noRecovery = signal(false);

  async submit(): Promise<void> {
    if (!this.username.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const email = await this.authService.sendPasswordReset(this.username);
      if (email === null) this.noRecovery.set(true);
      else this.sentTo.set(maskEmail(email));
    } catch {
      this.error.set('Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
```

Note: `styleUrl` reuses the login page stylesheet for the card look. If class names differ once rendered (check in browser), copy the login page's wrapper class names into the template — do not fork the SCSS.

- [ ] **Step 4: Add the route** — in `src/app/app.routes.ts` directly after the `login` entry:

```ts
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
```

- [ ] **Step 5: Add the login-page link** — in `src/app/pages/login/login.component.html`, directly after the password `form-group` `</div>` (the one containing the eye button, ~line 77):

```html
        <p class="forgot"><a routerLink="/forgot-password">Forgot password?</a></p>
```

`RouterLink` is already imported by the login component. Add to `login.component.scss`:

```scss
.forgot { text-align: right; margin: -0.4rem 0 0; font-size: 0.85rem;
  a { color: var(--primary, #4a9c6d); text-decoration: none; } }
```

- [ ] **Step 6: Run tests** — `npm run test:ci`, all pass (39 + 3 + 3 = 45).

- [ ] **Step 7: Manual check** — dev server: `/login` shows the link; `/forgot-password` renders; entering your own username (no recovery email) shows the ask-an-admin message.

- [ ] **Step 8: Commit** — `feat(auth): forgot-password page with recovery-email reset`

---

### Task 5: Signup — policy validation + live checklist

**Files:**
- Modify: `src/app/pages/signup/signup.component.ts`
- Modify: `src/app/pages/signup/signup.component.html` (password form-group, ~line 65-80)
- Modify: `src/app/pages/signup/signup.component.scss`

- [ ] **Step 1: Wire the policy into the component.** In `signup.component.ts`:

Add import: `import { passwordRules, isPasswordValid, passwordProblems } from '../../utils/password';`

Add getter (near other getters/fields):

```ts
  /** Live password-requirement checklist for the template. */
  get passwordChecklist() {
    return passwordRules(this.password);
  }
```

Replace the weak check in `submit()` (line ~56):

```ts
    if (!isPasswordValid(this.password)) { this.error.set(passwordProblems(this.password)); return; }
```

(Deletes the `this.password.length < 6` line.)

- [ ] **Step 2: Checklist markup.** In `signup.component.html`, inside the Password form-group, immediately after the `input-wrap` `</div>` (after the eye-button block, ~line 78) — same pattern as `join.component.html:123-129`, but shown even before typing so nobody is blindsided:

```html
          <ul class="pw-rules">
            @for (rule of passwordChecklist; track rule.label) {
              <li [class.met]="rule.met">{{ rule.met ? '✓' : '○' }} {{ rule.label }}</li>
            }
          </ul>
```

Also update the password input's `placeholder` to `At least 8 characters` if it still says 6.

- [ ] **Step 3: Styles.** Append to `signup.component.scss` (copy of `join.component.scss:189-205`):

```scss
.pw-rules {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  font-size: 0.8rem;
  line-height: 1.5;

  li {
    color: var(--muted, #8a8a8a);
    transition: color 0.15s ease;

    &.met {
      color: var(--primary, #4a9c6d);
      font-weight: 600;
    }
  }
}
```

- [ ] **Step 4: Verify** — `npm run test:ci` all pass; dev server `/signup`: checklist visible under the password field from the start, items flip ✓ as requirements are met, submitting a weak password names what's missing.

- [ ] **Step 5: Commit** — `fix(signup): enforce password policy with upfront live checklist`

---

### Task 6: registerStandalone — authEmail + optional recovery email; signup field

**Files:**
- Modify: `src/app/services/auth.service.ts:139-167` (registerStandalone)
- Modify: `src/app/pages/signup/signup.component.ts` + `.html` (optional field)

- [ ] **Step 1: Extend `registerStandalone`.** Add trailing optional param and `authEmail` on the doc; attach the recovery email after profile creation (account is freshly signed in — no reauth needed):

```ts
  async registerStandalone(
    displayName: string,
    avatarEmoji: string,
    username: string,
    password: string,
    color: string,
    recoveryEmail?: string,
  ): Promise<void> {
    const uname = username.toLowerCase().trim();

    // Username uniqueness (runs unauthenticated — users is publicly readable).
    const usernameQ = query(collection(this.firestore, 'users'), where('username', '==', uname));
    if (!(await getDocs(usernameQ)).empty) throw new Error('That username is already taken.');

    const cred = await createUserWithEmailAndPassword(this.auth, toEmail(uname), password);
    const uid  = cred.user.uid;
    const now  = Date.now();

    const userDoc: FirestoreUser = {
      uid,
      displayName: displayName.trim(),
      username:    uname,
      avatarEmoji,
      color,
      isAdmin:     false,
      isDisabled:  false,
      createdAt:   now,
      authEmail:   toEmail(uname),
    };
    await setDoc(doc(this.firestore, 'users', uid), userDoc);

    // Optional recovery email — best-effort; a failure must not lose the new account.
    const recovery = recoveryEmail?.toLowerCase().trim();
    if (recovery) {
      try {
        await updateEmail(cred.user, recovery);
        await updateDoc(doc(this.firestore, 'users', uid), { authEmail: recovery });
      } catch (err) {
        console.error('[Auth] recovery email not attached (add it later in Profile):', err);
      }
    }
  }
```

- [ ] **Step 2: Signup field.** In `signup.component.ts` add field `recoveryEmail = '';` and pass it as the sixth argument to `registerStandalone(...)`. In `signup.component.html`, after the Confirm Password form-group:

```html
        <div class="form-group">
          <label>Recovery email <span class="optional">(recommended)</span></label>
          <input type="email" [(ngModel)]="recoveryEmail" name="recoveryEmail"
                 placeholder="you@example.com" autocomplete="email" />
          <p class="hint">The only way to reset a forgotten password yourself.</p>
        </div>
```

Add to `signup.component.scss`:

```scss
.optional { font-weight: 400; color: var(--muted, #8a8a8a); font-size: 0.85em; }
.hint { margin: 0.35rem 0 0; font-size: 0.8rem; color: var(--muted, #8a8a8a); }
```

- [ ] **Step 3: Verify** — `npm run test:ci` all pass; `npx ng build` succeeds.

- [ ] **Step 4: Commit** — `feat(signup): optional recovery email + authEmail on new accounts`

---

### Task 7: Profile — recovery email section

**Files:**
- Modify: `src/app/pages/profile/profile.component.ts`
- Modify: `src/app/pages/profile/profile.component.html` (new section next to the change-password card)

- [ ] **Step 1: Component logic.** In `profile.component.ts` add fields + method (mirror the existing `changePassword()` pattern at line ~154 — same loading/error/success signal style used there):

```ts
  recoveryEmail   = '';
  recoveryPass    = '';
  recoveryBusy    = signal(false);
  recoveryError   = signal('');
  recoverySuccess = signal('');

  /** Current recovery email, or '' when the account still uses the synthetic address. */
  get currentRecoveryEmail(): string {
    const e = this.userService.firestoreUser()?.authEmail ?? '';
    return e.endsWith('@the-itinerists.local') ? '' : e;
  }

  async saveRecoveryEmail(): Promise<void> {
    const email = this.recoveryEmail.trim();
    if (!email || !this.recoveryPass) return;
    this.recoveryBusy.set(true);
    this.recoveryError.set('');
    this.recoverySuccess.set('');
    try {
      await this.authService.addRecoveryEmail(this.recoveryPass, email);
      this.recoverySuccess.set('Recovery email saved.');
      this.recoveryEmail = '';
      this.recoveryPass  = '';
    } catch (err: any) {
      this.recoveryError.set(
        err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : err?.code === 'auth/email-already-in-use'
            ? 'That email is already attached to another account.'
            : 'Could not save the recovery email. Please try again.');
    } finally {
      this.recoveryBusy.set(false);
    }
  }
```

(`userService` and `authService` are already injected in this component; verify names match the file's existing fields.)

- [ ] **Step 2: Markup.** In `profile.component.html`, add a card directly after the change-password card, following its exact structural classes (read the surrounding markup and reuse its card/form-group/button classes):

```html
      <section class="card">
        <h3>Recovery email</h3>
        @if (currentRecoveryEmail) {
          <p class="hint">Current: <strong>{{ currentRecoveryEmail }}</strong>. Saving a new one replaces it.</p>
        } @else {
          <p class="hint">Add a real email so you can reset a forgotten password yourself.</p>
        }
        <div class="form-group">
          <label>Email</label>
          <input type="email" [(ngModel)]="recoveryEmail" name="recoveryEmail" autocomplete="email" />
        </div>
        <div class="form-group">
          <label>Current password</label>
          <input type="password" [(ngModel)]="recoveryPass" name="recoveryPass" autocomplete="current-password" />
        </div>
        @if (recoveryError()) { <p class="error">{{ recoveryError() }}</p> }
        @if (recoverySuccess()) { <p class="success">{{ recoverySuccess() }}</p> }
        <button (click)="saveRecoveryEmail()" [disabled]="recoveryBusy() || !recoveryEmail.trim() || !recoveryPass">
          {{ recoveryBusy() ? 'Saving…' : 'Save recovery email' }}
        </button>
      </section>
```

- [ ] **Step 3: Verify** — `npm run test:ci` all pass; dev server Profile page renders the section; wrong current password shows the specific error.

- [ ] **Step 4: Commit** — `feat(profile): add/change recovery email`

---

### Task 8: Home pins on the account

**Files:**
- Create: `src/app/utils/pins.ts`
- Test: `src/app/utils/pins.spec.ts`
- Modify: `src/app/services/user.service.ts` (add `updateHomePins`; add `updateDoc` to the firestore import)
- Modify: `src/app/pages/home/home.component.ts:48-80` (pins block)

- [ ] **Step 1: Write the failing test**

```ts
// src/app/utils/pins.spec.ts
import { effectivePins, DEFAULT_HOME_PINS } from './pins';
import { FirestoreUser } from '../models/trip.models';

const base: FirestoreUser = {
  uid: 'u1', displayName: 'A', username: 'a', avatarEmoji: '🌸',
  color: '#fff', isAdmin: false, createdAt: 0,
};

describe('effectivePins', () => {
  it('returns the defaults when there is no user', () => {
    expect(effectivePins(null)).toEqual(DEFAULT_HOME_PINS);
  });

  it('returns the defaults when the user has no homePins', () => {
    expect(effectivePins(base)).toEqual(DEFAULT_HOME_PINS);
  });

  it('returns the saved pins when present (including empty = all unpinned)', () => {
    expect(effectivePins({ ...base, homePins: ['/map'] })).toEqual(['/map']);
    expect(effectivePins({ ...base, homePins: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, verify the new specs fail** — module not found.

- [ ] **Step 3: Implement the util**

```ts
// src/app/utils/pins.ts
import { FirestoreUser } from '../models/trip.models';

/** 3 fit a phone-width row. */
export const DEFAULT_HOME_PINS = ['/itinerary', '/finance', '/packing'];

/** Account pins, or the defaults when none are saved. `[]` is a valid saved state. */
export function effectivePins(user: FirestoreUser | null): string[] {
  return user?.homePins ?? DEFAULT_HOME_PINS;
}
```

- [ ] **Step 4: UserService write method.** In `user.service.ts`, add `updateDoc` to the `@angular/fire/firestore` import, and add:

```ts
  /** Persist Home pins on the account (personalization follows the user across devices). */
  async updateHomePins(pins: string[]): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { homePins: pins }));
  }
```

- [ ] **Step 5: Rework the Home pins block.** Replace `home.component.ts` lines 48-80 with:

```ts
  // ── Pinned quick-shortcuts (stored on the account — follows the user) ──────
  private readonly LEGACY_PINS_KEY = 'tripplanner_home_pins';
  readonly pinnablePages = [
    { path: '/itinerary',      label: 'Itinerary',   icon: 'itinerary' },
    { path: '/flights',        label: 'Flights',     icon: 'flights' },
    { path: '/accommodations', label: 'Stays',       icon: 'stays' },
    { path: '/transportation', label: 'Transportation', icon: 'car' },
    { path: '/finance',        label: 'Finance',     icon: 'finance' },
    { path: '/expenses',       label: 'My Expenses', icon: 'expenses' },
    { path: '/recs',           label: 'Recs',        icon: 'recs' },
    { path: '/packing',        label: 'Packing',     icon: 'packing' },
    { path: '/outfits',        label: 'Outfits',     icon: 'outfits' },
    { path: '/map',            label: 'Map',         icon: 'map' },
    { path: '/profile',        label: 'Profile',     icon: 'profile' },
  ];
  readonly pins = computed(() => effectivePins(this.userService.firestoreUser()));
  pinEdit = signal(false);
  readonly pinnedTiles = computed(() => {
    const set = new Set(this.pins());
    return this.pinnablePages.filter(p => set.has(p.path));
  });
  togglePinEdit(): void { this.pinEdit.update(v => !v); }
  isPinned(path: string): boolean { return this.pins().includes(path); }
  togglePin(path: string): void {
    const cur  = this.pins();
    const next = cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path];
    void this.userService.updateHomePins(next);
  }
  /** One-time: carry device-local pins (pre-account era) onto the account. */
  private migrateLegacyPins(): void {
    try {
      const raw = localStorage.getItem(this.LEGACY_PINS_KEY);
      if (!raw) return;
      const user = this.userService.firestoreUser();
      if (user && user.homePins === undefined) {
        void this.userService.updateHomePins(JSON.parse(raw));
      }
      localStorage.removeItem(this.LEGACY_PINS_KEY);
    } catch { /* ignore bad local data */ }
  }
```

Wiring notes for this step:
- Add imports to `home.component.ts` if absent: `computed` from `@angular/core`, `effectivePins` from `../../utils/pins`, and confirm `UserService` is injected (the component already uses user data; find the existing `userService` field name and match it).
- Call `this.migrateLegacyPins()` at the end of the constructor (or in `ngOnInit` if the component has one). It's safe to call on every load: the localStorage key is deleted on first run.
- `pins` was a writable signal before and is a `computed` now — Firestore's snapshot listener (already live in UserService) echoes `updateHomePins` back into `firestoreUser`, so the UI updates without local state. With the persistent cache this is effectively instant, including offline.

- [ ] **Step 6: Run tests** — `npm run test:ci`, all pass.

- [ ] **Step 7: Manual check** — dev server: Home shows 3 default pins → Edit → toggle one → reload: sticks. DevTools: `localStorage.getItem('tripplanner_home_pins')` is null. The `users/{uid}` doc (Network tab or a second browser profile) carries `homePins`.

- [ ] **Step 8: Commit** — `feat(home): store pins on the account for cross-device personalization`

---

### Task 9: Admin fallback script

**Files:**
- Create: `scripts/reset-password.js`

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * reset-password.js — admin fallback for accounts without a recovery email.
 *
 * Usage: node scripts/reset-password.js <username> <temp-password>
 *
 * Requires scripts/serviceAccountKey.json for THIS project
 * (trip-planner-ayyjayy2). The temp password must meet the server policy
 * (min 8, upper + lower + number) or Identity Platform rejects it.
 */
const admin = require('firebase-admin');
const path  = require('path');

const [username, tempPassword] = process.argv.slice(2);
if (!username || !tempPassword) {
  console.error('Usage: node scripts/reset-password.js <username> <temp-password>');
  process.exit(1);
}

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });

async function main() {
  const db   = admin.firestore();
  const snap = await db.collection('users')
    .where('username', '==', username.toLowerCase().trim()).limit(1).get();
  if (snap.empty) { console.error(`No user with username "${username}".`); process.exit(1); }

  const { uid, authEmail } = snap.docs[0].data();
  await admin.auth().updateUser(uid, { password: tempPassword });
  console.log(`✓ Password reset for ${username} (uid ${uid}, signs in via ${authEmail ?? 'synthetic email'}).`);
  console.log('  Share the temp password out-of-band; they should change it in Profile.');
  await admin.app().delete();
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
```

- [ ] **Step 2: Syntax check** — `node --check scripts/reset-password.js` → no output.

(Live run needs the current-project service-account key, which isn't on disk yet — the script errors clearly against the old-project key. Do not commit any key.)

- [ ] **Step 3: Commit** — `feat(scripts): admin password-reset fallback`

---

### Task 10: Full verification + ship

- [ ] **Step 1: Full suite** — `npm run test:ci` → all pass (48 expected: 39 + 3 email + 3 forgot + 3 pins). `npx ng build` → succeeds.

- [ ] **Step 2: End-to-end manual loop (the one that matters):**
  1. Profile → add a real inbox you control as recovery email (re-enter password).
  2. Sign out → `/forgot-password` → your username → check the inbox → follow the link → set a new password (note the hosted page enforces the same policy).
  3. Sign in by username with the new password. Then sign in from a second browser profile: pins + profile identical (account data across devices).

- [ ] **Step 3: Rules check (deferred)** — `npm run test:rules` needs Java (not installed). The owner-only `authEmail`/`homePins` write is covered by the existing `userId == uid()` update rule; add a rules-test case when the emulator runs again.

- [ ] **Step 4: PR** — push the feature branch, `gh pr create`, squash-merge per repo convention.
