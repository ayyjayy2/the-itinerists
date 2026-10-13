# Sign-in, recovery and sessions check

Run on **2026-10-13** for #405, from the review's SEC-03, against the staging project (`the-itinerists-staging`)
and the Firebase Auth settings of both projects. Nothing here touched production data.

## Firebase Auth settings (read from both projects)

| Setting | Staging | Production |
|---|---|---|
| Email enumeration protection | on | on |
| Password policy | not enforced | enforced, 8 characters minimum |
| "Your email was changed" notice to the old address | on | on |
| Password-reset email | on | on |
| App Check on Authentication | off | off (#354, after Berlin) |

Staging doesn't enforce the password policy, so password-strength checks only mean something on production.

## Live checks on staging

Run with the Firebase REST API, the same requests the app makes, as a staging test account. The reset was done to
the account's existing password, so nothing changed for it.

| Check | Result |
|---|---|
| Sign in with a wrong password for a real account | `INVALID_LOGIN_CREDENTIALS` |
| Sign in with an address that has no account | `INVALID_LOGIN_CREDENTIALS` (the same answer) |
| Ask for a reset link for a real account | OK |
| Ask for a reset link for an address with no account | OK (the same answer; no email is sent) |
| Use a reset link | OK |
| Use the same reset link again | refused (`INVALID_OOB_CODE`) |
| Use a made-up reset code | refused (`INVALID_OOB_CODE`) |
| Sessions from before a reset | cut off (the account's `tokensValidAfterTime` moves forward) |
| Log out in the app (`npm run test:staging`, "logging out ends the session") | no saved sign-in left in the browser; a reload stays signed out; Home, Finance and Profile send you to sign in; Back doesn't reopen the app |

Reset links expire after an hour (Firebase's fixed lifetime); that wasn't waited out.

## What the app says

- **Sign-in:** one message for a wrong email or a wrong password. When Firebase pauses sign-in after too many
  attempts, the app now says "Too many attempts. Please wait a few minutes" instead of "wrong password", which
  sent people round in circles. It says nothing about whether the account exists.
- **Forgot password:** the same answer for every address: "If an account uses m•••@gmail.com, a reset link is on its
  way." The old "No account uses that email" message is gone. It could only have shown if enumeration protection
  were switched off, but now it can't come back that way either.
- **Accounts that sign in with a username** (only those made before sign-up asked for an email) still show
  whether a username exists. The username lookup is public by design: one name at a time, never listable, and
  never holding a real email (see `docs/architecture.md`). New accounts don't have one.

## Changing a password or email

- **Password:** the app asks for the current password and re-authenticates before `updatePassword`.
- **Email:** `verifyBeforeUpdateEmail`, with the current password when the sign-in isn't recent. The new address has
  to click a link before anything changes, and Firebase emails the old address a notice with an undo link. The
  notice template is switched on in both projects. Receiving it wasn't tested, since the test accounts have no real inbox.

## Rate limits

Firebase Auth throttles repeated sign-in and reset attempts itself and answers `auth/too-many-requests`, which the
app now explains. The limits aren't configurable on the free plan and weren't hammered here. Server-side limits
and alerts come after Blaze (#357), and App Check on Authentication with #354.

## Tokens and logs

- The web app keeps its sign-in in the browser's IndexedDB (`firebaseLocalStorageDb`), as Firebase does by default.
- Error logs (`_appLogs`) keep the page path only, never the full address, plus the error message and a trimmed stack.
  The app never reads or logs ID or refresh tokens.
- Crashlytics on the iPhone gets the account id, never an email or token.
- Google Analytics sends paths only, with no automatic first page view (#404). Invite codes are taken out of the
  address bar.
- Reset and email-change links are Firebase's; the app never handles their codes.

## The iPhone app

It signs in with `indexedDBLocalPersistence` inside its own web view, so the session sits in the app's private
storage. Other apps can't read it, and iOS encrypts it on the device (from the first unlock after a restart, the default). **Recommendation:** that's fine for
TestFlight. Moving the session into the Keychain is only worth doing before the App Store if we want sessions to
survive an app reinstall or to be shared with an extension; neither is planned. The owner decides.

## Not covered here

- Clearing the **local trip data** on logout (the session itself is cleared): #406.
- Logout on the **installed web app and the iPhone app** on real devices: the iPhone release check, #424.
