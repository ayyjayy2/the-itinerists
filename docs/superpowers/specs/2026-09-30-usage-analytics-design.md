# Usage analytics — design

_2026-09-30. Approved in conversation; three PRs, shipped in order the same day._

## Goal

Alayna wants to see how the app is used, starting today while the Berlin trip is live and
continuing long-term: how many people use it per hour and per day, at what hours (in their
own time zones), on which pages, and per trip. Everything must be free.

Two sources, because each covers what the other cannot:

1. **Our own event log in Firestore** — live, per-trip, per-user, per-zone. In our hands the
   moment rules and hosting deploy. This is the Berlin view.
2. **Google Analytics 4 via Firebase Analytics** — free, adds retention, geography, devices,
   engagement time and Explorations. Standard reports lag about a day; Realtime is instant.

Everyone on the Berlin trip uses the web/PWA build, so nothing waits on the iOS shell.

## PR 1 — event log (`feat/activity-events`)

### Collection `_activity/{autoId}`

One document per event. Written by a new `UsageService` (`src/app/services/usage.service.ts`;
the name `activity` is taken by the per-trip activity log).

| Field | Type | Meaning |
|---|---|---|
| `uid` | string | the signed-in user |
| `tripId` | string or null | active trip at the time |
| `type` | `'session'` `'page'` `'ping'` | see below |
| `page` | string | route path with no ids, e.g. `/itinerary` |
| `at` | timestamp | `serverTimestamp()` |
| `localHour` | number 0–23 | hour on the user's clock |
| `tz` | string | IANA zone, e.g. `Europe/Berlin` |
| `tzOffsetMin` | number | `-Date.getTimezoneOffset()` |
| `platform` | `'web'` `'pwa'` `'ios'` | Capacitor → ios; `display-mode: standalone` → pwa; else web |
| `sessionId` | string | `crypto.randomUUID()` per app open |
| `appVersion` | string | `APP_VERSION` from `src/version.ts` |

Events:
- `session` — once, when the user is known after app open.
- `page` — on every `NavigationEnd` while signed in. Route params and query strings are
  stripped; `/trips/new` stays as is since it has no id.
- `ping` — every 5 minutes while `document.visibilityState === 'visible'`, so someone who
  stays on one page still counts for that hour and shows as online. Paused when hidden,
  resumed (and sent at once) when the tab becomes visible again after 5+ minutes.

Nothing is written in the demo build (`DEMO` flag) or while signed out. Writes are
fire-and-forget; a failure is logged to the console and never surfaces to the user.
`ErrorLoggerService.trackWrite()` is not called for these, since they are not user data
writes and would trip the spike detector.

### Rules

```
match /_activity/{event} {
  allow create: if isSignedIn()
    && request.resource.data.uid == uid()
    && request.resource.data.keys().hasOnly([
         'uid','tripId','type','page','at','localHour','tz','tzOffsetMin',
         'platform','sessionId','appVersion'])
    && request.resource.data.type in ['session','page','ping']
    && request.resource.data.at == request.time;
  allow read: if isAdmin();          // get and list
  allow update, delete: if false;
}
```

Rules tests added to `test/firestore-rules.test.mjs`: member creates own event (allow),
spoofed `uid` (deny), extra field (deny), anon create (deny), admin reads and lists (allow),
member reads (deny), update and delete by admin (deny).

### Volume and retention

About 100 events per active user per day. Free tier: 20k writes/day, 50k reads/day, 1 GiB.
Kept indefinitely for now; add a Firestore TTL policy on `at` if it ever matters.

## PR 2 — `/activity` page (`feat/activity-page`)

Route `activity`, guarded by a new `adminGuard` (`src/app/guards/admin.guard.ts`) that waits
for `UserService.waitForUser()` and then checks `UserService.isAdmin()`; non-admins are sent
to `/home`. Linked from Profile, admins only. Component in `src/app/pages/activity/`.

The page queries `_activity` where `at >= rangeStart` ordered by `at`, with a live
`onSnapshot` for the "last 24 hours" query and a one-shot `getDocs` for longer ranges.
All aggregation is in the browser (`src/app/utils/usage-stats.ts`, pure functions with
unit tests). No Cloud Functions.

Controls: range (Today · 24 h · 7 days · 30 days), trip filter (all trips or one), hour
display zone (each user's own local time, or a chosen IANA zone; default `Europe/Berlin`
while it is the active trip's zone, else the viewer's zone).

Sections, top to bottom:
1. **Online now** — users with an event in the last 6 minutes: name, page, platform, zone.
2. **Users per hour** — last 24 h, bar per hour, distinct users. Below it **users per day**
   for the range.
3. **Hour of day** — distinct user-hours per hour 0–23 in the chosen zone mode.
4. **Pages** — views and distinct users per page, sorted by views.
5. **People** — per user: name (from `UsersService`, admin already reads all users),
   platform, zone, last seen, page views in range, days active in range.

Charts are inline SVG bars styled with the app's design tokens. No chart library.

## PR 3 — Google Analytics 4 (`feat/ga4`)

Prerequisite (Alayna, Firebase console): Project settings → Integrations → Google Analytics
→ Enable. Then `firebase apps:sdkconfig web` shows the `measurementId`, which goes into both
environment files.

- `provideAnalytics(() => getAnalytics())`, `ScreenTrackingService`, `UserTrackingService`
  from `@angular/fire/analytics`, web only (skipped under Capacitor and in the demo build).
- User properties: `platform`, `timezone`, `trip_id` (set when the active trip changes).
- Custom events: `trip_created`, `trip_joined`, `invite_shared`.
- CSP on the live site: `script-src` + `https://www.googletagmanager.com`;
  `connect-src` + `https://www.google-analytics.com https://*.google-analytics.com
  https://*.analytics.google.com https://www.googletagmanager.com`.
- Privacy page: one paragraph — we record which screens you visit and when, in our own
  database and in Google Analytics, to see how the app is used; not used for advertising.
- TODO.md: App Store privacy label needs "Product Interaction" (and "Crash Data" once
  Crashlytics lands); Capacitor Firebase Analytics plugin for the iOS shell later.

## Out of scope

Cloud Functions rollups, funnels in our own page, per-trip GA dimensions beyond `trip_id`,
the iOS analytics plugin, export.
