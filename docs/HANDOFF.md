# Getaway Club — Session Handoff

_Last updated: 2026-07-19. This is the authoritative "pick up where we left off" doc.
(Note: `docs/SESSION-STATUS.md` is STALE — ignore it.)_

---

## 1. Snapshot

- **DESIGN PHASES — both complete & frozen:**
  - **Design Phase 1** (pre-redesign baseline) — tag `design-phase-1` (commit `0ef2426`).
  - **Design Phase 2** (wireframe-driven visual redesign, mobile-first) — **DONE**, tag
    `design-phase-2` (commit `9f45063`, PR #82). Dusk Garden design system, "Getaway Club"
    branding, custom line-icon set, bottom-tab nav, multi-theme picker, full per-screen restyle.
  - Full record + how to restore any phase: **`docs/design-phases.md`**. Each is recoverable via
    `git checkout <tag>` or its GitHub Release.
- **FEATURE WORK since Phase 2:** Milestone 1 — **Map & Transportation** (PRs #84–#93) — DONE.
  Revived the two orphaned pages (Map, Transportation), destination-aware map geocoding, map
  locations list, multi-mode Transportation surfaced across Home/Itinerary/Map, finance
  "tracked so far" total. Full detail: **`docs/feature-log.md`**.
- **App:** "Getaway Club" — Angular 19 multi-trip travel app. Live: https://trip-planner-ayyjayy2.web.app
- **Branch:** `master` (clean, nothing uncommitted). **Open PRs:** none.
- **No orphaned pages remain** — every `src/app/pages/*` is routed + in the nav.
- **What's next (open, not started):** see §5 — mostly user-decision items (final app name,
  app icon 4b vs 4c) and deferred features (multi-currency/multi-destination, event/flight
  reminders, Stripe billing).

---

## 2. Project overview

- **App:** Angular 19 standalone-components **"Getaway Club"** (working name; earlier "Trip
  Planner" / "Savannah Getaway"), a multi-trip travel planning app. Signals throughout
  (`signal`/`computed`/`effect`).
- **Platform direction (don't misframe this):** the end goal is a **native iOS + Android app**,
  **iOS-first**, shipped via **Capacitor** (ROADMAP Phase 4) — the same Angular codebase becomes
  the mobile app. It's a PWA today only as a stepping stone. Design & UX work should be
  **mobile-first / responsive across phone sizes**, with desktop as a scale-up. (The earlier
  React-Native/Expo rewrite was abandoned in favor of this Capacitor path.) Capacitor is NOT
  installed yet — that's ROADMAP Phase 4. See `docs/design-prompt.md`.
- **Backend:** Firebase — Firestore (modular `@angular/fire`), Firebase Auth
  (username → synthetic email `username@trip-planner.local`).
- **Firebase project:** `trip-planner-ayyjayy2`. Web config lives in the app env + repeated in
  the scratchpad scripts.
- **Repo:** `ayyjayy2/getaway-club` (private; formerly `trip-planner`). Default branch `master`.
- **Data model:** `trips/{tripId}` + per-trip sub-collections (members, itinerary, finance, stays,
  recs, cars, pins, flights, outfits, dayLabels, packing, packingSuggestions, invites,
  activityLog); `userTrips/{uid}` index; `inviteIndex/{code}` global lookup. Plus top-level
  `users`, `geocache`, `userExpenses`, `outfitPhotos`, `_appLogs`.
- **Planning docs (untracked, in repo root):** `ROADMAP.md` (phases 1–5), `VISION.md`.

---

## 3. Working agreement / process (IMPORTANT — follow these)

- **One story per PR.** Branch name `TP-<n>-descriptive-name` off `master`.
- **Pause after each PR** for the user to review/merge. Do NOT merge to `master` without the
  user's explicit say-so. The user says "merge #NN" (or "merge") to proceed.
- **After merge:** `git checkout master && git pull --ff-only`, then set the board card → Done.
- **Board updates:** move the card to In Progress when starting, In Review when the PR is up,
  Done after merge. (GraphQL field id for Status: `PVTSSF_lAHOA1MSD84BbqzxzhWZwKE`;
  project id `PVT_kwHOA1MSD84Bbqzx`. Option ids resolved dynamically via `gh project field-list`.)
- **New stories:** create a GitHub issue (`gh issue create`), reference `Closes #NN` in the PR,
  add the issue to project #9 and set status.
- **Verify every story in a real browser** before opening the PR (see §6). Build first
  (`npx ng build --configuration development`), then drive the running app.
- **SECURITY — never commit the admin credentials** (`Alayna` / `admin123`). They only ever appear
  in throwaway scratchpad scripts, never in the repo.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  PR body trailer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## 4. Done so far

### Phase 1 — Multi-trip architecture (all merged)
TP-4 rebrand · TP-5 TripContextService · TP-6 TripService · TP-7/8 per-trip sub-collections ·
TP-10 migration · TP-11 per-trip invite codes · TP-12 My Trips · TP-13 create-trip ·
TP-14 home uses active trip · TP-15 trip settings · TP-16 models · TP-17 test fixes ·
TP-18 activity log · TP-19 owner actions · TP-20 retire TripConfigService ·
TP-21 packing → Firestore · TP-23 pages read active-trip dates · TP-24 per-account trip removal.

### Enhancements (merged this stretch)
- **TP-25** (#45) — Open self-serve signup (`/signup`) + post-auth `/get-started` prompt
  (Set up a trip / I have an invite code / Do this later). Shown when a signed-in user has 0 trips.
- **TP-26** (#47) — Searchable currency picker on create-trip (full ISO 4217 list in
  `src/app/data/currencies.ts`).
- **TP-9** (#43) — **Firestore security rules locked down AND DEPLOYED LIVE.** Member-scoped
  read/write; owner/admin-only privileged actions; deliberate public reads for the pre-auth join
  flow (`inviteIndex`, `trips/*/invites/*`, `users`). Design in `docs/firestore-security-rules.md`.
  Rules unit tests in `test/firestore-rules.test.mjs` (`npm run test:rules`, 48/48). Validated live
  with the browser smoke flow.
- **TP-27** (#49) — Destination-aware weather. `WeatherService` now geocodes the active trip's
  destination (Nominatim) instead of hardcoded Savannah; caches per destination+range. Outfit-tip
  copy de-Savannah-ified.

---

## 5. Current state & what's next

**Design Phase 2 is complete + frozen, and Milestone 1 (Map & Transportation) is done.** The app
is fully restyled, both orphaned pages are revived, and Transportation is integrated
end-to-end. Nothing is in progress; `master` is clean with no open PRs.

**Open items (none started — most need a user decision or are deferred features):**
- **Branding decisions** (design-phase-2 `DECISIONS.md` "still open"): final **app name**
  (working name "Getaway Club"; Sprig/Flock were runners-up) and final **app icon** (4b lettered
  ring vs 4c postage-dot). These gate the `package.json` name, splash, store listing.
- **Multi-currency / multi-destination** (deferred by user): trip can select several currencies →
  finance pickers show only those; support multi-destination trips. Not yet designed.
- **Event & flight reminders** (backlogged in `ROADMAP.md` §3.6): opt-in, time-based reminders
  ahead of an event/flight; builds on the Home "First up" time parsing (factor into a shared
  `datetime.util.ts`).
- **Stripe billing** (`ROADMAP.md` §2.4): needs the user's Stripe account + Firebase Functions;
  tier enforcement (free = 1 active trip / 6-member cap; Pro-gated features).
- **Bigger ROADMAP features:** Phase 3 (AI itinerary, real-time flight tracking, activity voting,
  FCM push, shared photo albums), Phase 4 (Capacitor native app + store submission).

---

## 6. Verification & cleanup (READ — changed by the rules lockdown)

- **Pattern:** headless system Chrome via `playwright-core`, driving the running app at
  `http://localhost:4200` (dev server talks to the **LIVE** Firebase project). Scripts create a
  throwaway trip/user, exercise the feature, assert, screenshot, then self-clean.
- **Scratchpad location (session-specific!):**
  `/private/tmp/claude-501/-Users-alayna-Documents-Code-mobileApps-travelPlanningApp/<session-id>/scratchpad/`
  Holds `verify-tp*.mjs` and screenshots. A NEW session has a different path — copy/re-create scripts there.
- **`playwright-core` is installed `--no-save`** (not in package.json), so `npm install` prunes it.
  Re-add with `npm install --no-save playwright-core` when a verify run says it's missing.
- **Dev server:** `ng serve` auto-recompiles on file save; check
  `scratchpad/ngserve.log` tail for "Page reload sent" before re-running a verify.
- **CLEANUP now needs member context, NOT admin god-mode.** Under the deployed locked-down rules:
  - Admin **cannot** `getDocs(collection('trips'))` (unfiltered list denied) and **cannot** purge a
    trip it isn't a member of. Old `cleanup.mjs` / the admin-SDK trip purges in older verify scripts
    now throw `permission-denied`.
  - **To purge a throwaway trip:** sign in as a **member** of it (e.g. Alayna if she created it),
    find it via `userTrips/{uid}.tripIds` (NOT by listing `trips`), then delete sub-collections,
    then the trip doc, then the `members` docs **last** (deleting your own membership revokes your
    access). This mirrors `TripService.purgeTripData`.
  - **Deleting throwaway `users/{uid}` + `userTrips/{uid}`** as admin still works (isAdmin grants it).
  - Cleanest self-clean: have the app itself purge via last-member-leave (what `verify-tp24b` does).

---

## 7. To-do backlog (prioritized)

**Savannah/rebrand cleanup — effectively DONE.** Recs made user-driven (TP-28, Phase 1 boundary);
map geocoding de-Ireland'd + destination-aware (#82); app rebranded to "Getaway Club". Remaining
`savannah`/`ireland` hits are cosmetic: a couple of stale comments (`trip.models.ts:240`,
`flight-countdown.service.ts` SAV entry) and **`src/app/data/seed-data.ts`** — old Ireland seed
data that is **imported nowhere (dead code, safe to delete)**.

**Design Phase 2 (ROADMAP.md §2) — mostly DONE:** bottom tab bar + safe areas, themes/dark mode
(multi-theme picker), onboarding fork + designed empty states, full per-screen restyle. Still
open: **final app name + app icon** (§5), and **2.4 Stripe billing** (needs user's Stripe account +
Firebase Functions; free = 1 active trip / 6-member cap, Pro-gated features).

**Deferred features (need user steer):** multi-currency/multi-destination trips; event/flight
reminders (`ROADMAP.md` §3.6); the larger Phase 3/4 items below.

**Operational follow-ups (from the rules deploy):**
- Rewrite the scratchpad `cleanup.mjs` / verify cleanup helpers to use member/`userTrips` context
  instead of admin trip-listing (see §6). Low priority; scratchpad only.
- Minor console noise: during a trip purge, the leaving member's `onSnapshot` listeners log
  `permission-denied` as access is revoked mid-teardown. Harmless; could detach listeners on leave.

**Beyond:** ROADMAP.md Phases 3 (AI itinerary, flight tracking, voting, FCM, photo albums),
4 (Capacitor native app, store submission), 5 (growth).

---

## 8. Tooling / environment notes

- **Build:** `npx ng build --configuration development`. Dev server: `npm start` (`ng serve`, port 4200).
- **Rules tests:** `npm run test:rules` → `firebase emulators:exec --only firestore "node test/firestore-rules.test.mjs"`.
  Needs a **JDK** — OpenJDK was installed via Homebrew at `/opt/homebrew/opt/openjdk`
  (`export PATH="$(brew --prefix openjdk)/bin:$PATH"` before running the emulator).
- **Firestore emulator jar** is cached in `~/.cache/firebase/emulators/`. Emulator debug logs
  (`firestore-debug.log` etc.) are gitignored.
- **Deploy rules:** `firebase deploy --only firestore:rules` (manual, gated on user OK; no CI
  deploys rules). `.firebaserc` default project = `trip-planner-ayyjayy2`. CLI is authenticated.
- **Signals gotcha (bit us once):** `computed()` only tracks **signal** reads. A computed that reads
  a plain class field caches forever (see the TP-26 currency-label bug — fixed by using a method).

---

## 9. Quick resume checklist for next session

1. `git checkout master && git pull` — confirm clean, no open PRs.
2. Re-create the scratchpad verify scripts in the new session's scratchpad path (§6).
3. `npm install --no-save playwright-core` if verifying.
4. Pick a **§5 "what's next"** item — most are user-decision (app name/icon) or deferred features
   (multi-currency, reminders, Stripe). Confirm direction with the user before starting.
5. Design Phase 2 = frozen (`docs/design-phases.md`); post-freeze feature work is logged in
   `docs/feature-log.md` — add new milestones there, not to the design-phase log.
