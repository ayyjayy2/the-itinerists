# Tools & services

Everything the app, the dashboards and the build depend on, as of 2026-10-02. One
row per tool: what it does for us, what it costs, and where it is wired in. Update
this file whenever a service is added or removed (the privacy policy at
`src/app/pages/privacy/privacy.component.ts` must say the same things).

## The app itself

| Tool | Version | What it does | Where |
|---|---|---|---|
| **Angular** | 20 | The web app: standalone components, signals, lazy routes. Moved from 19 (out of support) on 2026-10-02; 21 waits for AngularFire | `src/app/` |
| **Angular service worker** (PWA) | 20 | Installable web app, offline shell, cached assets | `ngsw-config.json`, `public/manifest.webmanifest` |
| **Capacitor** | 8 (Swift Package Manager, no CocoaPods) | Native iOS shell around the same web build | `ios/`, `capacitor.config.ts`, `npm run ios:run` |
| **Leaflet** | 1.9 | The trip map | `src/app/pages/map/`, `src/app/shared/day-map-card/` |
| **RxJS** | 7 | Streams from Firebase into signals | throughout |
| **AngularFire** (`@angular/fire`) | 20.1 | Firebase for Angular; every Firebase call in the app goes through it. It brings its own Firebase JS SDK 11.10; `overrides` pins `rxfire` to 6.1.0 so rxfire uses that same copy, not the top-level `firebase` 12 (used by the rules tests). No release supports Angular 21 yet | `src/app/app.config.ts`, the services |
| **tz-lookup** | 6 | Coordinates → IANA time zone, for a trip leg's zone when it is saved | `src/app/services/geocode.service.ts`, `src/app/utils/zones.ts` (Intl-only zone math) |

## Firebase (project `trip-planner-ayyjayy2`, Spark plan until Blaze)

| Service | What it does | Cost | Where |
|---|---|---|---|
| **Authentication** | Email + password sign-in (username → synthetic email), password reset, email change. Sender: `noreply@theitinerists.com` | Free, unlimited | `src/app/services/auth.service.ts`, `user.service.ts` |
| **Firestore** | Every document: users, trips and their subcollections, invites, geocache, the `_activity` event log, the `_appLogs` error log, `_pulse` prefs, the per-account daily limit counters `_quotas/{uid}/kinds/{photos|trips}` (`src/app/utils/quota.ts`; 50 outfit photos and 20 new trips per 24 hours), and on staging the API console's `_apiConsoleAccess` / `_apiConsole` | Free tier; see Launch Plan → Storage & costs | `src/app/services/*.service.ts`, rules in `firestore.rules` (tests: `npm run test:rules`) |
| **Cloud Storage** | Outfit photos (1,600 px + 300 px thumbnail), owner-only. **Code done, switched off** (`OUTFIT_PHOTO_STORAGE_ENABLED = false`): the bucket only exists on Blaze | Free tier | `src/app/services/outfit-photo.service.ts`, `storage.rules`, `scripts/set-storage-cors.js`, `scripts/migrate-outfit-photos.js` |
| **Hosting** | theitinerists.com (+ the-itinerists.web.app), the demo site, and `/pulse/` | Free tier | `firebase.json` (headers, CSP), `public/` |
| **App Check** | Proves requests come from the real app; **enforced** on Firestore and Storage. reCAPTCHA v3 on the web, a debug token on the iOS shell (App Attest later) | Free | `src/app/app.config.ts`, `.env` keys |
| **Google Analytics 4** | Screen views, user id, properties platform / timezone / trip_id, events trip_created / trip_joined / invite_shared. Web only; property G-EZQ46BTZY7 | Free | `src/app/services/analytics.service.ts`, `app.config.ts` |
| **Crashlytics** | Crashes and non-fatals from the iOS app, tagged with the uid. Live since 2026-09-30. Web stays on `_appLogs` | Free | `src/app/services/crash-reporter.service.ts`, `error-logger.service.ts`, Xcode "Upload dSYMs" phase, `scripts/fetch-ios-config.js` |
| **Local emulators** | Firestore + Storage emulators for the rules tests (needs a JDK: `PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`) | Free | `test/firestore-rules.test.mjs`, `test/storage-rules.test.mjs` |

## Outside APIs the app calls

| Service | What it does | Cost / key | Where |
|---|---|---|---|
| **Open-Meteo** | Weather for trip destinations on Home | Free, no key | `src/app/services/weather.service.ts` |
| **Nominatim** (OpenStreetMap) | Place names → coordinates; results cached in Firestore `geocache`. Also gives a saved trip leg its coordinates and zone | Free, no key, 1 req/s etiquette | `src/app/pages/map/map.component.ts`, `day-map-card`, `services/geocode.service.ts` |
| **OpenStreetMap tiles** | Map imagery under Leaflet | Free | `map.component.ts` |
| **Frankfurter** | Currency conversion rates for Finance | Free, no key | `src/app/services/exchange-rate.service.ts` |
| **Google Fonts** | Nunito and Caprasimo | Free | `src/index.html`, `public/pulse/index.html` |
| **timeapi.io** | API console only (the app doesn't call it): every IANA zone, and one zone's local time, offset and daylight saving | Free, no key | staging CSP in `firebase.json`; request list in the owner's HQ artifact |
| **Open-Meteo geocoding** | API console only: a city's time zone, country and coordinates ("Port_Moresby" is sent as "Port Moresby" by `public/api-console/normalize.mjs`) | Free, no key | staging CSP in `firebase.json` |
| **Google reCAPTCHA v3** | Behind App Check on the web | Free | `app.config.ts` |

All of these are listed in the hosting Content-Security-Policy in `firebase.json`; a new
host must be added there or the browser blocks it.

## Our own instruments

| Tool | What it does | Where |
|---|---|---|
| **Event log** (`_activity`) | One row per app open, page view and 2-minute ping while visible: uid, trip, page, local hour, zone, platform, version. Written by the app, never edited | `src/app/services/usage.service.ts`, `src/app/utils/usage.ts` |
| **Pulse** | Owner-only live dashboard at theitinerists.com/pulse/, outside the Angular app. Trips by phase, online now, people per hour / day, hour of day on each person's clock or a zone, pages, people, return rate, visits, around the trip, platform + versions. Filters: range (today → year), Hide (me / test trips / test accounts), multi-select trips, zone. Test lists live in `_pulse/prefs` | `public/pulse/` (`pulse.mjs`, `stats.mjs` + `npm run test:pulse`, `zones.mjs`), design: `docs/superpowers/specs/2026-09-30-usage-analytics-design.md` and `...-pulse-filters-and-cards-design.md` |
| **API console** | Staging only, at the-itinerists-staging.web.app/api-console/index.html: Swagger UI with every Firestore path, the sign-in calls and the outside APIs, pre-filled with your account and trip. Opens only for staging accounts the owner approves (`_apiConsoleAccess/{uid}`); the request list lives in `_apiConsole/spec`, never in this public repo (its source, an OpenAPI file and a Postman collection are in the owner's HQ artifact). The page reads Firestore over REST (no Firestore SDK), keeps the last request list in the browser for instant return visits (cleared if access is revoked), and Swagger UI is cached for a day. Left out of the production and demo builds | `public/api-console/`, `swagger-ui-dist` (vendored at build), `scripts/api-console.js` |
| **Write log** (`_writes`) | One row per change a person makes on a trip: uid, trip, kind, action, time. No content. Appended by `TripEventsService` beside each trip event; history before 2026-10-01 seeded by `scripts/backfill-writes.js`. Pulse charts "Things written" and "Sign-ups" (from users' creation dates) | `src/app/services/trip-events.service.ts`, `firestore.rules` |
| **Error log** (`_appLogs`) | JS, HTTP and Firebase errors from the web app with a random session id | `src/app/services/error-logger.service.ts` |
| **Trip event feed** (`trips/{id}/events`) | What changed on a trip; feeds the bell and Updates | `src/app/services/trip-events.service.ts`, spec `docs/superpowers/specs/2026-09-30-trip-events-and-push-design.md` |
| **Demo build** | The app with in-memory stand-ins for Firebase, for screenshots and the demo site | `src/demo/`, `tsconfig.demo.json`, `npm run start:demo` / `deploy:demo` |
| **Version stamp** | `APP_VERSION` + build number (git commit count) in the app and the Xcode project | `scripts/set-version.js` (runs on install and build) |

## Scripts (`scripts/`, run with `node`)

| Script | Purpose |
|---|---|
| `gen-env.js` | `.env` → `src/environments/*.ts` and `public/pulse/config.mjs` (all gitignored) |
| `set-version.js` | Writes `src/version.ts`; `--ios` also stamps the Xcode project |
| `gen-zones.js` | Regenerates `public/pulse/zones.mjs` (zone → city, US state, country) from `@vvo/tzdb` |
| `gen-zone-codes.mjs` | Regenerates `public/api-console/zone-codes/` (each time zone code → the zones that show it, from the app's own code rules, checked in January and July) for the API console's "Time zones by code" lookup. Run after changing a code table, or once a year |
| `gen-airports.js` | Regenerates `public/data/airports.json` (IATA → zone, 5,500 airports from OpenFlights + overrides such as BER); the app loads it lazily so each flight time is read in its airport's zone |
| `backfill-trip-zones.js` | One-off: gives existing trip legs a `timeZone` (and coordinates) via Nominatim + tz-lookup; dry run by default, `--run` writes |
| `fetch-ios-config.js` | Writes `ios/App/App/GoogleService-Info.plist` from the Firebase Management API (gitignored) |
| `set-storage-cors.js`, `migrate-outfit-photos.js` | After Blaze: bucket CORS; move inline photos to Storage |
| `seed-admin.js`, `sync-seed.js`, `create-test-member.js`, `mark-test-accounts.js` | Seeding and test data |
| `api-console.js` | Staging API console: `grant` / `revoke <username|email>`, `list`, `publish <openapi.json>`. Refuses non-staging keys |
| `reset-password.js`, `gen-reset-link.js`, `migrate-account-privacy.js` | Account admin |
| `check-balances.js`, `compare-to-spreadsheet.js`, `fix-makaela-entries.js`, `apply-v6-fixes.js` | One-off finance checks and fixes |
| `stats.js` *(gitignored)* | Read-only headcount of real users and trips; feeds the private Headcount artifact. Never commit its output |
| `verify-outfit-storage.local.mjs` *(gitignored)* | Playwright check of the photo upload path, signed in as the `photoprobe` test account |

Admin scripts need `scripts/serviceAccountKey.json` (gitignored) and check that its
project is `trip-planner-ayyjayy2` before doing anything.

## Build, test and ship

| Tool | What for | How |
|---|---|---|
| **Node** 25 / npm | Everything above | `npm install` |
| **Angular CLI** | Build, dev server (`:4200`), demo (`:4400`) | `npm run build`, `npm start` |
| **Karma + Jasmine** | Unit tests (about 400 specs) | `npm test`, `npm run test:ci` |
| **Node test runner** | Pulse aggregations (18 tests) | `npm run test:pulse` |
| **@firebase/rules-unit-testing** | Firestore and Storage rules (174 + 12 checks) | `npm run test:rules` |
| **Playwright** (`@playwright/test`) | End-to-end tests of the beta flows on the demo build (sign-up, create trip, expense, itinerary event, invite), phone viewport in Chromium | `npm run test:e2e` (`e2e/`, `playwright.config.ts`; `e2e/serve.mjs` serves the demo build in CI) |
| **Staging checks** (`e2e-staging/`, Playwright) | The after-deploy checklist against the real staging site, as two seeded test accounts: sign-in, live updates between them, every page, an expense, invites, offline sync, browser caching, the API console, 16px fields. Signs each account in once (`auth.setup.ts`, sessions in git-ignored `e2e-staging/.auth/`); `cleanup.ts` removes anything tagged `[check]` | `npm run test:staging` (`playwright.staging.config.ts`; `STAGING_URL=` for a preview channel). Not in CI: it needs the staging passwords |
| **Firebase CLI** | Deploys: `firebase deploy --only hosting:the-itinerists`, `--only firestore:rules`, `--only storage` | authenticated as the owner |
| **firebase-admin**, **google-auth-library** | Admin scripts | with the service-account key |
| **sharp** | Photo resizing in the migration script | dev dependency |
| **Swagger UI** (`swagger-ui-dist` 5.33.1) | The API console's request runner, copied into `api-console/vendor/` at build time (no CDN, so the CSP stays as it is) | dev dependency; `angular.json` assets |
| **@vvo/tzdb** | Zone names table for Pulse | dev dependency |
| **Xcode** 26 | iOS build, simulator, archive for TestFlight | `npm run ios:open` |
| **GitHub** (`ayyjayy2/the-itinerists`) | Code, pull requests | `gh` CLI |
| **Staging** (`the-itinerists-staging`) | A second Firebase project: own Firestore, accounts and hosting at https://the-itinerists-staging.web.app. Same rules and indexes as production. No App Check, no Analytics, no Pulse. Every master commit that passes CI deploys there automatically; production stays a manual deploy. Seeded with the demo's Chiang Mai trip and four test accounts (`node scripts/seed-staging.js`, passwords in `scripts/staging-accounts.local.json`) | `src/environments/environment.staging.ts`, `ng build --configuration staging`, `npm run deploy:staging`, `.github/workflows/deploy-staging.yml` |
| **GitHub Actions** | CI on every pull request and push to master: unit tests, Pulse tests, production build, rules tests (emulators), Playwright end-to-end on the demo build. Master requires the `test` job green to merge | `.github/workflows/ci.yml` |
| **Hostinger** | Registrar for theitinerists.com; DNS points at Firebase Hosting | bought 2026-09-29 |

## Outside the repo

| Tool | What for |
|---|---|
| **Itinerists HQ** (private Claude artifact) | One place for Launch plan (phases, storage & costs, making money, PRD), Headcount (users, usage, timeline, poll), a copy of User flow, and Technical docs: Design System, Architecture, API guide (with the OpenAPI file and Postman collection for the API console) and Security guide |
| **User Flow** and **Design System** (private Claude artifacts) | The flow diagram and wireframes; the design system built from the code. HQ keeps copies |
| **Postman, Insomnia, Bruno** (optional, free) | Run the API console's requests outside the browser: copy the collection from HQ → API guide |
| **Google Forms** | Berlin alpha feedback survey (laynajay2 account) |
| **Instagram** | The story poll; marketing reels in phase 2 |
| **Firebase console** | Needs the alaynajohnston12 account |

## Planned, not yet in use

RevenueCat + Apple in-app purchase (+ Stripe on the web) for Trip Pass / Keep / Plus;
Cloud Functions (entitlements, trip deletion job, push fan-out); Firebase Cloud Messaging
for push; a Capacitor App Check plugin for App Attest; Firebase Analytics plugin for the
iOS shell; Brevo or Mailchimp for the updates list; Booking.com / Expedia / GetYourGuide /
Viator / Kiwi partner links. See Itinerists HQ → Launch plan and `TODO.md`.
