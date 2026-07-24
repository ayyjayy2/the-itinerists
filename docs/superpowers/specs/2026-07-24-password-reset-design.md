# Password Reset — Design

**Date:** 2026-07-24
**Status:** Approved (Alayna)

## Problem

Accounts sign in with a username mapped to a synthetic email
(`username@the-itinerists.local`). Synthetic addresses can't receive mail, so
Firebase's built-in password-reset flow has nowhere to send its link. A user
who forgets their password is locked out (this happened to Makaela; she made a
new account).

## Decisions

- **Both reset paths:** self-serve via an optional real recovery email, plus an
  admin-run script as fallback for accounts without one.
- **Username login keeps working** after a recovery email is added; the login
  page resolves username → email via Firestore. Accepted trade-off: recovery
  emails are readable through the app's Firestore API pre-login (public `users`
  read, gated by App Check). Fine for a friends-group app.
- **All account data lives in the account** (Firebase Auth + Firestore), never
  device-local, so everything works across devices.
- No backend/Cloud Functions — the project has none and this design needs none.

## 1. Data model

`users/{uid}` gains one field:

| Field | Value |
|---|---|
| `authEmail` | The email the Auth account actually uses. Synthetic (`username@the-itinerists.local`) by default; the real recovery email once one is added. |

Existing docs without `authEmail` are treated as synthetic (fallback in code —
no migration needed).

## 2. Login (username-first, unchanged UX)

Login page flow:

1. Query `users` where `username == input` (public read, works pre-auth).
2. Sign in with the doc's `authEmail`; if no doc or no field, fall back to the
   synthetic mapping (today's behavior).

The login field itself is unchanged — friends keep typing usernames.

## 3. Adding a recovery email

Two entry points:

- **Profile page** — "Recovery email" section: enter email + current password.
  App reauthenticates (`reauthenticateWithCredential` with the current
  `authEmail`), updates the Auth account email to the real address, then writes
  `authEmail` to the user's Firestore doc. Both updates happen together; if the
  Firestore write fails, retry before surfacing an error (a mismatch breaks
  username login for that user).
- **Signup** — optional "Recovery email (recommended)" field with one line
  explaining it's the only way to self-serve a forgotten password. When
  provided, the account is created with the synthetic email first (keeps the
  existing username-uniqueness flow), then immediately updated as above.

Email-change verification setting: use direct `updateEmail` after fresh
reauthentication (requires email-enumeration protection to stay off, its
current state) so `authEmail` in Firestore can be updated in the same breath.

## 3b. Password requirements shown upfront (signup)

The server enforces a password policy (min 8 chars, upper + lower + number,
from #101), and the join and profile pages already show a live ✓/○ requirement
checklist while typing — but the standalone signup page was missed and only
errors after submit. Fix as part of this work: the signup page shows the same
live checklist as small print under the password field, reusing
`utils/password.ts` and the join page's checklist markup/styles, so nobody is
blindsided after inventing a password. (Firebase's hosted reset page enforces
the same policy server-side for the forgot-password flow.)

## 4. Forgot-password page

Route `/forgot-password`, linked from login ("Forgot password?"). Public
(unguarded), same visual style as login.

1. User enters their username.
2. App looks up `authEmail`.
3. **Real email on file:** call `sendPasswordResetEmail`, show
   "Reset link sent to m•••@gmail.com" (masked). Firebase's hosted page
   handles the actual reset; the new password then works everywhere.
4. **Synthetic email / no account:** show "No recovery email is on file for
   this username — ask an admin to reset your password." (Same message for
   unknown usernames; no meaningful enumeration risk since usernames are
   already publicly queryable.)

## 5. Admin fallback — `scripts/reset-password.js`

Same pattern as the seed scripts: Admin SDK + `scripts/serviceAccountKey.json`,
credentials/config via `scripts/read-env.js`. Usage:

```
node scripts/reset-password.js <username> <temp-password>
```

Looks up the user (Firestore username → uid), sets the password via
`admin.auth().updateUser`. Prints confirmation, never logs the password.

**Prerequisite:** a service-account key for `trip-planner-ayyjayy2` — the key
currently on disk belongs to the old `ireland-stpatricks` project. Download a
fresh key from Firebase console when first needed.

## 6. Security rules

No new rules. Existing `users` rules already fit: public read (needed for the
pre-auth lookup), owners may update their own doc (covers `authEmail`), and
privileged fields (`isAdmin`, `isDisabled`) stay locked. One addition to
verify in rules tests: a user cannot update another user's `authEmail`
(follows from `userId == uid()`).

## 7. Testing

- **Unit:** username→email resolution (doc found / missing field / no doc);
  forgot-password component states (sent, no-recovery-email, unknown user);
  email masking; signup password checklist renders and tracks the policy.
- **Manual:** full loop with a real inbox — add recovery email on Profile,
  sign out, forgot-password, click emailed link, set new password, sign in by
  username on a second browser profile (cross-device check).
- **Rules** (when Java/emulator available): `authEmail` writable only by owner.

## Out of scope

- Changing/removing a recovery email post-hoc beyond overwriting it in Profile.
- Email verification flows, real email as login identifier, notification email.
- Migrating the login page's `users` read to a dedicated lookup collection.
