<!-- Generated mirror of the "Technical docs · Architecture" page in Itinerists HQ (https://claude.ai/artifact/4KXwSQgFrugzPq9ZfocA9d#architecture, private).
     The HQ page is the source of truth: change it there, then regenerate this file.
     Synced 2026-10-02. People's names are deliberately left out (see docs/README.md). -->

# Architecture

_Read from the code on **Oct 2, 2026** · app at **0.9.0** build 562_

How The Itinerists is put together and how its parts talk to each other. One Angular codebase runs as a website, an installable web app and an iPhone app; everything it stores lives in one Firebase project, guarded by security rules; and every change goes through tests and a staging site before it reaches people.

- **1** codebase — web, home-screen app and iPhone app from the same build

- **23** pages — each loaded only when opened

- **30** services — live data and actions, one per area

- **4** test layers — unit, Pulse, security rules, end-to-end

## The system map

**People**

- Browser — theitinerists.com

- Home-screen app — installable PWA, offline shell

- iPhone app — Capacitor 8 shell

the same web build runs in all three ↓

**The app · Angular 19**

- Pages — 23 routes, loaded on demand

- Shared components — bell, hero, pickers, loaders

- Services — signals fed by live listeners

- Utils — pure, tested logic: zones, money, events

services read and write live; every request proves it is the real app ↓

**Firebase · trip-planner-ayyjayy2**

- Authentication — email + password

- Firestore — all data · security rules

- App Check — enforced · reCAPTCHA v3

- Hosting — site, demo, Pulse

- Analytics — web only

- Crashlytics — iPhone only

- Storage — photos · off until Blaze

**Outside services**

- Open-Meteo — weather

- Nominatim + map tiles — places, maps

- Frankfurter — exchange rates

- Google Fonts — Nunito, Caprasimo

owner-only tools read the same database ↑

**Owner tools**

- Pulse — live usage dashboard, outside the app

- Admin scripts — Node + a service-account key

## How the code is organized

| Layer | What lives there | Rule of thumb |
|---|---|---|
| Pages — src/app/pages | One standalone component per screen: Home, Itinerary, Flights, Stays, Transportation, Map, Finance, My Expenses, Packing, Outfits, Recs, Updates, Trip Settings, My Trips, Profile, Admin, sign-in, sign-up, get started, privacy | Pages show and edit; they don't talk to Firebase directly |
| Shared components — src/app/shared | The bell, brand lockup, icons, loader, time input, avatar and currency pickers, invite panel, day map card, no-trip state, and small directives (date hints, focus target, start-date → end-date) | Used by two or more pages |
| Services — src/app/services · 30 | One per area (trip, itinerary, flights, finance, packing…) plus cross-cutting ones: auth, user, trip context, trip events, usage, analytics, crash reporter, error logger, geocode, airport zones, weather, exchange rates, calendar export, email confirmation | Each holds Angular signals fed by Firestore live listeners for the open trip, and does the writes |
| Utils — src/app/utils · 38 | Pure functions: time zones, first-up, flight status, settlements, event wording, calendar files, date ranges, sign-up validation, usage events | No Angular, no Firebase: the logic the unit tests pin down |
| Models — src/app/models | The shape of every document (trips, members, items, flights, events…) | One source of truth for field names |
| Demo stand-ins — src/demo | In-memory replacements for Firebase, swapped in by the demo build's path mapping | Powers the demo site, screenshots and end-to-end tests: no network, no accounts |

**One trip is open at a time.** Trip context remembers the open trip per device; when it changes, every trip service drops its listeners and subscribes to the new trip's collections, so each page always shows the open trip, live.

## The data model

### Top level

- `users/{uid}` profile; `…/private/account` sign-in email, readable only by its owner
- `usernames/{name}` username → sign-in email (one public lookup at a time, never listable)
- `userTrips/{uid}` the person's trip list and last open trip
- `trips/{id}` name, stops (each with dates, coordinates and time zone), currency
- `invites`, `inviteIndex` invite codes, valid 7 days
- `userExpenses/{uid}` private expenses
- `geocache` place lookups, shared
- `_activity`, `_writes`, `_appLogs`, `_pulse` usage, edit and error logs; Pulse settings. Owner-only reads

### Inside each trip

- `members`, `removedMembers`
- `itinerary`, `dayLabels`
- `flights`, `stays`, `cars` (all transport)
- `finance` shared expenses and settlements
- `packing`, `packingSuggestions`
- `outfits`, `outfitPhotos`
- `recs`, `pins`
- `events` the update feed behind the bell; `activityLog` the owner's log

**Only members read a trip.** The rules check membership on every read and write, require a real email to create an account, and keep the analytics collections to the owner alone. 164 rules tests prove each allow and each deny.

## How a change travels

Maya adds "Sunset at the Miradouro" to Day 2 on her phone. What happens:

1. **The page** hands the item to the itinerary service.
2. **The service writes** `trips/{id}/itinerary/{item}`. App Check vouches for the request; the rules check Maya is a member.
3. **The trip-events service** writes one update to `trips/{id}/events` ("Maya added Sunset… to Day 2, Fri Oct 2 at 6:30 PM WEST", with who it's for) and one content-free row to `_writes`.
4. **Everyone else's listeners** on that trip fire within a second: the itinerary updates in place and the bell's count goes up.
5. **Seen is per trip:** opening the bell stamps `users/{uid}.lastSeenByTrip.{trip}`, so another trip's updates wait until that trip is open.
6. **Pulse**, the owner's dashboard, sees the new `_writes` row live.

## Sign-in and startup

1. **Launch:** the iPhone app holds its logo splash until it knows who is signed in; the web shows a small spinner only if loading passes 300ms.
2. **App Check** gets its token up front (reCAPTCHA on the web, a debug token in the iPhone app for now), so the first database request doesn't wait.
3. **Username → email:** looked up in `usernames` as soon as the person moves to the password field.
4. **Sign in** with Firebase Authentication; the route guard waits for the profile in `users/{uid}`.
5. **The open trip** comes from the device, or the person's last trip in `userTrips`; its listeners start and Home appears. Measured: 1.3 s median from tap to Home on 4G.

## Time zones

### Where zones come from

- A trip's stops get their zone when saved: Nominatim gives coordinates, `tz-lookup` turns them into a zone.
- Flights use their airports: a table of 5,500 airports (`/data/airports.json`, loaded on first use) maps each code to its zone.

### How they're used

- All zone maths uses the browser's own `Intl`, no date library.
- Every time shown carries its zone code (CDT, WEST); a departure is in the departure airport's zone, an arrival in the arrival airport's.
- "Today", the countdown, the current stop and calendar exports all use the trip's zone.

## The iPhone app

| Piece | What it does |
|---|---|
| Capacitor 8 | Wraps the same web build in a native iOS app (Swift Package Manager). The web code is copied in with `npm run ios:sync`. |
| Splash screen | Holds the logo until sign-in state is known, so there's no blank flash. |
| Crashlytics | Crash and error reports from phones, tagged with the person. |
| Calendar | "Add to my calendar" writes the trip straight into Calendar and updates it without copies. |
| Filesystem, file opener, share | The calendar-file fallback when calendar access is off. |
| Until TestFlight | Builds go to the phone from a Mac with Xcode's command-line tools. App Attest replaces the debug token once the Apple Developer account exists. |

## From code to people

- **Local** — dev server against real data, or the demo build with no network

- **Pull request + CI** — unit, Pulse, rules and end-to-end tests; a red check blocks the merge

- **Staging** — the-itinerists-staging.web.app, deployed automatically after CI on master; own data, sign-up off

- **Production** — theitinerists.com, deployed by hand

- **iPhone** — installed from the Mac today; TestFlight next

Staging is a separate Firebase project with the same rules and indexes and its own seeded trip and test accounts, deployed by a service account that can only touch staging.

## Security and privacy

| Security rules | Members only, per trip; field allow-lists on logs; a real email to sign up; owner-only analytics. Tested on every change. |
|---|---|
| App Check | Enforced on Firestore: requests from anything but the real app are refused. |
| Content Security Policy | The site may only load from the hosts it uses; a new service must be added to `firebase.json` or the browser blocks it. |
| Analytics without content | The usage and edit logs record that something happened, never what was written. |
| Keys | Service-account keys and local account files are never committed; admin scripts check which project they're pointed at before doing anything. |

## What's watched, and what's planned

### Watched today

- **Pulse:** visits, people, pages, edits, countries, live.
- **Crashlytics** for the iPhone app; **the error log** (`_appLogs`) for the web.
- **Google Analytics** on the web.

### Planned

- **Firebase pay-as-you-go plan**, which unlocks the rest.
- **Cloud Functions** for push notifications, purchases and deleting ended trips.
- **Cloud Storage** for outfit photos (code written, switched off) and **backups**.
- **App Attest** and **TestFlight**, once the Apple Developer account exists.
- **RevenueCat** for Trip Pass, Keep and Plus.
