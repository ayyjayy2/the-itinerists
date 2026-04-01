# Security Notes

## What's been done (IRE-09)

### 1. Firebase client config out of source control
`environment.ts` and `environment.prod.ts` are gitignored and generated locally from `.env` via `npm run gen-env`. See **First-time setup** below.

> Firebase client API keys are public project identifiers by design — they're always visible in the browser bundle. Real access control comes from Firestore Security Rules and App Check. That said, keeping them out of git history prevents credential-scraping bots from mining public repos.

---

### 2. HTTPS enforcement + security headers
`firebase.json` now sets the following response headers on every route:

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Tells browsers to always use HTTPS for this domain for 1 year — no fallback to HTTP ever. `preload` opts into browser preload lists. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing; browsers must honor the declared `Content-Type`. |
| `X-Frame-Options` | `DENY` | Blocks the app from being embedded in iframes — prevents clickjacking. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Cross-origin requests only send the origin (not path/query), so Firebase/API services don't see full internal URLs. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables browser feature APIs the app doesn't use. |
| `Content-Security-Policy` | (see firebase.json) | Allowlists where scripts, styles, images, and network requests may originate. Prevents XSS escalation even if injected markup somehow reached the DOM. |

Firebase Hosting enforces HTTPS at the infrastructure level regardless — these headers add the browser-side enforcement layer on top.

---

### 3. Firebase App Check (restricts direct database access)
App Check uses reCAPTCHA v3 (invisible — no checkboxes) to cryptographically attest that requests are coming from a real instance of the app, not from curl, scripts, or bots.

**How it works:** on each Firestore request, the Firebase SDK automatically attaches a short-lived App Check token signed by Google. When enforcement is enabled in the Firebase Console, any request *without* a valid token is rejected before it even reaches Security Rules.

**To activate:**
1. Register a reCAPTCHA v3 site key at https://www.google.com/recaptcha/admin (select "v3", add your Firebase Hosting domain)
2. Enable enforcement in Firebase Console → App Check → Apps → your web app → Enforce
3. Add the site key to `.env`: `RECAPTCHA_SITE_KEY=your-site-key`
4. Run `npm run gen-env` to regenerate environment files

If `RECAPTCHA_SITE_KEY` is absent, `gen-env.js` warns and App Check is simply skipped (the app still works, just without DB request attestation).

---

### 4. Input sanitization at write boundaries
All user-submitted strings are trimmed and string arrays are cleaned before any Firestore write. Enforced centrally in `data.service.ts` and `expenses.service.ts` via `sanitizeStrings()` in `src/app/utils/sanitize.ts` — components don't need to remember to do it.

---

### 5. Structured error logging + write spike detection
`src/app/services/error-logger.service.ts` provides two things:

**Error logging** — `AppErrorHandler` overrides Angular's default `ErrorHandler` and routes all uncaught exceptions through the logger. Firebase write failures (`.catch()` blocks) are also routed here. Each log entry written to Firestore `_appLogs` includes:
- `type`: `js_error` | `http_error` | `firebase_error` | `write_spike`
- `message` + truncated `stack` (500 chars)
- `timestamp` (ISO 8601 UTC)
- `url` (page path at time of error)
- `sessionId` (random UUID per browser session — no PII, just for correlating events)

**Write spike detection** — every Firestore write calls `trackWrite()`, which maintains a rolling 60-second window of write timestamps. If a single session exceeds 45 writes/minute (threshold set above normal heavy usage from laptop + phone), a `write_spike` log is written. This surfaces in the Firebase Console under `_appLogs` and can indicate a bot, a runaway loop, or someone probing the app.

**Logs are write-only from the client** — `firestore.rules` allows `create` on `_appLogs` but denies `read`, `update`, and `delete`. View them in the Firebase Console or via Admin SDK.

---

## Current gaps (future work)

### Firestore Security Rules — still open
Rules are currently `allow read, write: if true` for all collections except `_appLogs`. Anyone who knows the project ID can read and overwrite all trip data. **This is the highest-priority remaining gap.**

**Planned fix (IRE-10):** Add Google OAuth via Firebase Auth, pre-authorize the friend group's emails, lock rules to `request.auth.token.email in ['alayna@...', ...]`.

### No authentication
User selection is purely a UI affordance. There's no identity verification. Auth comes alongside the rules fix above.

### Rate limiting
Not applicable to the current architecture (client-side SPA, no backend routes). The external APIs (Open-Meteo, Nominatim) are already call-limited by caching. Write spike detection above serves a similar purpose for Firestore.

### Server-side validation
All validation is client-side. A malformed write from outside the app would succeed (Firestore has no schema enforcement). Acceptable for a closed friend-group app; addressable via Security Rules field validation once auth is added.

---

## Sensitive files (never commit)
- `.env` — Firebase client config + reCAPTCHA site key
- `scripts/serviceAccountKey.json` — Firebase Admin SDK service account key (download from Firebase Console → Project Settings → Service Accounts)

## First-time setup after cloning
```bash
cp .env.example .env
# Fill in Firebase values + optionally RECAPTCHA_SITE_KEY
npm run gen-env    # writes src/environments/environment.ts + environment.prod.ts
```

## Deploy Firestore rules
```bash
firebase deploy --only firestore:rules
```
