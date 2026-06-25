# trip-planner — Session Status
> Last updated: June 25, 2026. Pick up from here in the next session.

---

## What This Project Is

An **Angular 19 web app** being transitioned out of the Savannah-specific
"Savannah Getaway" app into a **reusable, global multi-trip product**.
`trip-planner` is a **placeholder name** — the product name is not yet
decided ("Troupe" was an earlier idea, set aside). The name is *not* baked
into the code, so it's cheap to change later.

See `VISION.md` (strategy) and `ROADMAP.md` (phased engineering plan).

---

## The Three Repos — Don't Confuse Them

| Repo | Path | GitHub | Role |
|------|------|--------|------|
| **trip-planner** (THIS, active) | `mobileApps/travelPlanningApp/` | `ayyjayy2/trip-planner` (private) | The copy we're globalizing |
| Savannah Getaway (original) | `webapps/travelApp/savannah-getaway/` | `ayyjayy2/savannah-getaway` | Untouched source app — leave alone |
| Triplan (abandoned) | `mobileApps/triplan/` | `ayyjayy2/triplan` | Old Expo/React-Native rebuild attempt, reached TP-7, abandoned |

> Earlier versions of this file described the Triplan Expo rebuild as the
> active project. **That plan was abandoned.** Work now continues by
> evolving this Angular app in place.

---

## Done This Session (June 25, 2026)

- Forked this copy onto its own private repo `ayyjayy2/trip-planner`
  (re-pointed `origin`, pushed `master`).
- Renamed package `savannah-getaway` → `trip-planner` (`package.json`).
- Renamed Angular workspace project → `trip-planner`; build output now
  `dist/trip-planner/` (`angular.json`, `firebase.json` hosting path).
- Fixed a broken install: pinned `@angular/pwa` + `@angular/service-worker`
  to 19.x (were 21.x). Clean `npm install` now works without
  `--legacy-peer-deps`; audit findings dropped 65→35 (0 critical).

---

## Build & Run

- `npm start` → `ng serve` → http://localhost:4200/
- `npm run build` → outputs to `dist/trip-planner/`
- Stack: Angular 19, Firebase JS SDK, Leaflet maps.

---

## Important: What Still Says "savannah" (and why)

The rename was deliberately scoped. These remain **savannah** on purpose:

- **Firebase project / infra** — `projectId: savannah-getaway`,
  `savannah-getaway.firebaseapp.com`, `*.firebasestorage.app`, CSP
  `connect-src`, console URLs in `scripts/`. These point to the **live**
  Firebase backend. Renaming them requires migrating cloud resources —
  separate, deliberate effort.
- **Auth email domain** `@savannah-getaway.local` (`auth.service.ts`,
  seed scripts). Existing user accounts are keyed to this domain; changing
  it would orphan logins.

Still **TODO** for de-branding (ROADMAP Phase 2.2):
- ~80 `"savannah"` references in `src/` (content, titles, sample data —
  e.g. `recs.component.ts`, `weather.service.ts`, `home.component.ts`).
- App display title in `app.component.ts` + its spec assertion.
- Decide whether to migrate the Firebase project to a neutral name.

---

## Next Direction — Phase 1: Multi-Trip Architecture

Per `ROADMAP.md`, everything is blocked on making the app multi-trip
(it currently assumes a single hardcoded trip). High level:
- Add `TripDoc` / `TripMember` / `UserTripsDoc` models.
- New `trip-context.service.ts` (active trip signal) + `trip.service.ts`
  (create/join/switch/archive).
- Rewrite `data.service.ts` + per-feature services to read/write
  `trips/{tripId}/...` sub-collections.
- Trip management UI (`/trips`, `/trips/new`), update home screen.
- New Firestore security rules for the sub-collection paths.

Detailed legacy plans (written for the abandoned Expo app — useful for
intent, NOT for the Angular file paths):
- `docs/superpowers/specs/2026-04-22-triplan-multi-trip-architecture-design.md`
- `docs/superpowers/plans/2026-04-22-plan-1-bootstrap-auth.md`

---

## Workflow Rules

- **Branch per task**, descriptive names; pick a prefix convention for
  this repo (original Savannah used `SAV-#`; the old Expo app used `TP-#`).
- **Never push/merge to `master` without explicit consent.**
- **Pause after creating a PR** — wait for review/merge before next task.
- PR descriptions: user-readable summaries of all changes.
