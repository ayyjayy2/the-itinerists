# AGENTS.md

How AI coding agents (and people) understand and work on The Itinerists. Follow it on every task: it
is the one place the project's rules live. `CLAUDE.md` imports this file, so Claude Code loads it
automatically; other agents read it by name.

**The project:** a group trip planner. One Angular 19 codebase runs as a website, an installable web
app (PWA) and a Capacitor 8 iPhone app, on Firebase (Auth, Firestore, App Check, Hosting, Analytics on
the web, Crashlytics on iPhone). Owner: Alayna.

---

## 1. Read before you start

1. **[docs/README.md](docs/README.md)**: the map of all docs and the rules for working with the data.
2. **[docs/architecture.md](docs/architecture.md)**: layers, the data model, how a change travels, sign-in, time zones, the iPhone app, delivery.
3. **[docs/design/design-system.md](docs/design/design-system.md)** before any UI work (tokens: `src/styles.scss`, `docs/design/tokens.json`).
4. **[docs/product/prd.md](docs/product/prd.md)** for what 1.0 must do and each requirement's status.
5. **The code you will touch:** `src/app/models/trip.models.ts` for document shapes, `firestore.rules` for who may read and write what, and the service that owns the data.
6. **Where things stand:** `git status`, `git log --oneline -10`, open pull requests (`gh pr list`). Another session may be working in the same checkout: check before you assume the tree is yours (see 2.3).

## 2. General rules

### 2.1 Privacy (non-negotiable)

- **Never commit real people's names, usernames, emails or social handles**: not in code, docs, tests, fixtures, commit messages or pull requests. Refer to people by role ("a beta tester", "the co-planner") or by count. Demo and test names (Maya, Theo, Jo, Rafa, Sam…) are fictional and fine.
- **User data stays out of the repository.** The private Headcount artifact is never mirrored here; `scripts/stats.js` and anything matching `scripts/*.local.*` stay gitignored.
- **Test accounts and test trips are never counted** in analytics, reports or dashboards.
- **Pulse (the usage dashboard) and its data are the owner's alone.** Never widen `isAppOwner()` in the rules or `OWNER_UID` in `public/pulse/pulse.mjs` without the owner's explicit permission for a named person.
- **Never delete or rewrite real users' data** to fix a bug. Correct values in place, and only with the owner's go-ahead.

### 2.2 How work ships

- **Branch, then pull request.** Never commit to `master` directly; it is protected and needs the CI `test` job green.
- **CI must pass:** unit tests, Pulse tests, the production build, security-rules tests and Playwright end-to-end tests.
- **Merging to master deploys staging automatically** (https://the-itinerists-staging.web.app). **Production (theitinerists.com) is deployed by hand,** from an up-to-date master, when the owner wants the change live.
- **The iPhone app** only changes when a new build is installed: `npm run ios:sync`, then Xcode Run (simulator) or an `xcodebuild` + `devicectl` install (a phone). Commit the version stamp `ios:sync` writes to `ios/App/App.xcodeproj/project.pbxproj` through a pull request.
- **One change per pull request,** described in plain words: what changed, why, and how it was tested.
- **Commit early.** Uncommitted work can be lost to another session's checkout or stash; for feature work use a git worktree (`git worktree add .worktrees/<name> -b <branch> origin/master`).

### 2.3 Standing product decisions

- **People with no trip keep the full navigation;** each page shows the shared no-trip state (`src/app/shared/no-trip-state`) with "Set up a trip".
- **Updates are per trip:** the bell shows the open trip; "seen" is tracked per trip.
- **Hand-offs to other apps stay low-key** (e.g. "Add to my calendar" is a muted link at the end of the page): the app should stay the place people plan from.
- **Joiners never meet a paywall** or an extra account step; planners are the ones who pay (see `docs/product/making-money.md`).
- **Home layout A** is kept as an internal option: don't remove its code paths without asking.
- **Outfit photos stay in Firestore** (`OUTFIT_PHOTO_STORAGE_ENABLED = false`) until the Firebase paid plan exists and the Storage bucket is created.

## 3. Code guidelines

### 3.1 Structure

- **Standalone components and signals.** Inject with `inject()`; hold state in `signal()`, derive with `computed()`, react with `effect()`. Use the `input()` API for new component inputs.
- **Pages show and edit; services own the data.** Only services talk to Firestore. Each trip service listens to the open trip's collections and exposes signals.
- **Pure logic goes in `src/app/utils/`** with a `.spec.ts` beside it: no Angular, no Firebase. Time zones, money, event wording and calendar files all live there; reuse them rather than re-implementing.
- **Shapes live in `src/app/models/trip.models.ts`.** A new field means: the model, the rules (with a test), and every writer.
- **The demo build** swaps Firebase for in-memory stand-ins in `src/demo/`. Using a Firebase function the app hasn't used before? Add it to the matching stand-in (`fire-auth.ts`, `fire-firestore.ts`…), or the demo build and the end-to-end tests break.
- TypeScript is `strict`; 2-space indents, UTF-8, final newline (`.editorconfig`).

### 3.2 UI rules (from the design system)

- **Use the tokens** (`var(--primary-dark)`, `var(--radius)`…), never new hex values. Components follow the shared classes in `src/styles.scss` (`.btn`, `.chip`, `.card`, `.form-group`…).
- **Every time shows its zone code** (CDT, WEST), never an offset; use `src/app/utils/zones.ts`. A flight's departure is in its departure airport's zone, its arrival in its arrival airport's.
- **Dates:** "Oct 6 – 9" within a month, "Sep 30 – Oct 3" across two (`src/app/utils/stop-dates.ts`).
- **Form fields are at least 16px.** Smaller fields make iPhones zoom the page; `e2e/no-zoom.spec.ts` guards it.
- **The header and the tab bar never move,** and the page never scrolls sideways.
- **Loaders** use `<app-loading>`: centred, shown after 300ms, at least 300ms. A busy button keeps its busy label until the next screen is up.
- **Tap targets are at least 44px.** Respect `prefers-reduced-motion`.
- **Copy:** sentence case; "you" for the person, "we" for the app; errors say how to fix it; empty states offer the next step.

### 3.3 Tests

- **Fix a bug by writing the failing test first,** then the fix.
- **Unit tests** (Karma + Jasmine) for every util and every component behaviour you change.
- **Security-rules tests** (`test/firestore-rules.test.mjs`) for every rule you add or change: an allow and a deny.
- **End-to-end tests** (Playwright, `e2e/`) for user flows; they run against the demo build at phone size.
- Verify against reality before saying something works: a screenshot of the page, a real staging run, or the data itself.

## 4. Security and best practices

- **Security rules first.** Every new collection or field gets a rule and a rules test. Never loosen a rule to make something work.
- **App Check is enforced on Firestore:** requests must come from the real app.
- **A new outside service** needs its host in the Content-Security-Policy in `firebase.json`, a line in `docs/apis.md`, and a mention in the privacy policy (`src/app/pages/privacy/`).
- **Secrets never enter the repository:** `.env`, `scripts/serviceAccountKey*.json` and local account files are gitignored. Don't print keys or passwords into logs, chats or pull requests.
- **Admin scripts** check that their key's `project_id` is the intended one (`trip-planner-ayyjayy2` for production, `the-itinerists-staging` for staging) before doing anything. Prefer staging for experiments.
- **Analytics count, they never read:** `_activity` and `_writes` record that something happened, never what was written.
- **Sign-up requires a real email** (form, `AuthService` and rules); email confirmation is gentle and never blocks.
- **Ask the owner first** for anything costly or hard to undo: billing plans, Apple accounts, production deploys of unreviewed work, deleting data, changing sign-in or domains. The-itinerists.web.app must not be redirected away before the Berlin trip ends (Oct 9, 2026).

## 5. Useful commands

| Command | What it does |
|---|---|
| `npm install` | Install; also writes `src/version.ts` |
| `node scripts/gen-env.js` | `.env` → `src/environments/*` (needs a `.env`; `cp .env.example .env` for CI-style builds) |
| `npm start` | Dev server on :4200 against the real (production) data |
| `npm run start:demo` | The demo build on :4400: in-memory data, no accounts |
| `npm run build` | Production build |
| `npm run test:ci` | Unit tests, headless |
| `npm run test:pulse` | Pulse dashboard tests |
| `PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run test:rules` | Security-rules tests on the emulators (needs a JDK; the PERMISSION_DENIED lines are expected) |
| `npm run test:e2e` | Playwright end-to-end tests (builds and serves the demo) |
| `npm run deploy:staging` | Build and deploy staging by hand (CI does it after every merge) |
| `node scripts/api-console.js grant <username>` | Approve a staging account for the API console (`/api-console/index.html` on staging); also `revoke`, `list`, `publish <openapi.json>`. Only with the owner's say-so |
| `firebase deploy --only hosting:the-itinerists --project trip-planner-ayyjayy2` | Deploy production hosting (after `npm run build`) |
| `firebase deploy --only firestore:rules --project trip-planner-ayyjayy2` | Deploy production rules |
| `npm run ios:sync` | Build and copy the web app into the iPhone project, stamping the version |
| `npm run ios:run` / `npm run ios:open` | Run on a simulator / open Xcode |

**Environments**

| | Address | Firebase project | Data |
|---|---|---|---|
| Local | localhost:4200 (or :4400 demo) | production (or none for demo) | real (or in-memory) |
| Staging | the-itinerists-staging.web.app | `the-itinerists-staging` | seeded test trip and test accounts; sign-up off |
| Production | theitinerists.com, the-itinerists.web.app | `trip-planner-ayyjayy2` | real people |

## 6. Need help?

- **Where to look first:** `docs/README.md` (map), `docs/architecture.md`, `docs/apis.md` (every tool and script), `docs/HANDOFF.md` (history), `TODO.md`, and recent pull requests (`gh pr list --state merged --limit 20`).
- **Decisions belong to the owner** (Alayna): product changes, anything involving money, accounts, real users' data, or production. When in doubt, ask rather than guess.
- **Common snags**

  | Symptom | Fix |
  |---|---|
  | A page loads forever locally but works in production | Stale dev-server cache after an install: `rm -rf .angular/cache` and restart `ng serve` |
  | `test:rules` says "Unable to locate a Java Runtime" | Put Homebrew's JDK first on PATH (the command in section 5) |
  | Playwright tests run against old code | Something already serves :4400 and Playwright reuses it: stop it or run on another port |
  | The phone or simulator shows an old version | The native app only changes when reinstalled: `npm run ios:sync`, then Xcode Run or a fresh install |
  | The page zooms in on a phone and the header seems to move | A form field under 16px: raise it (see 3.2) |
  | An admin script finds no data | Its key points at another project: check `project_id` |
  | `timeout` command not found (macOS) | It isn't installed; don't wrap commands in it |
