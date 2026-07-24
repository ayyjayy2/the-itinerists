# Rename: Getaway Club → The Itinerists — Design

**Date:** 2026-07-24
**Status:** Approved

## Goal

Rebrand the app from the working name "Getaway Club" to **The Itinerists**, across code,
user-facing brand, external infrastructure (Firebase Hosting site, GitHub repo, local
folder), and living docs.

## Naming scheme

| Context | Value |
|---|---|
| Display name | `The Itinerists` |
| Slug (package, angular project, dist path, hosting site, repo, folder) | `the-itinerists` |
| Stamp ring text | `THE ITINERISTS · EST 2026 ·` |

## Changes

### 1. Code + config
- `package.json` — `"name": "the-itinerists"`.
- `angular.json` — project key `getaway-club` → `the-itinerists`; `outputPath` →
  `dist/the-itinerists`; both `buildTarget` refs.
- `firebase.json` — `hosting.site` → `the-itinerists`; `hosting.public` →
  `dist/the-itinerists/browser`.
- `src/index.html` — `<title>The Itinerists</title>`.
- `public/manifest.webmanifest` — `name` and `short_name` → `The Itinerists`.

### 2. Brand component (`src/app/shared/brand/brand.component.ts`)
- Ring `<textPath>` text → `THE ITINERISTS · EST 2026 ·`. Passport-stamp mark and sage
  leaf unchanged.
- Wordmark mirrors the old structure with the article de-emphasized: **"THE"** in small
  Nunito caps, lavender (the old "CLUB" styling) followed by **"itinerists"** in
  Caprasimo (the old "getaway" styling).
- CSS classes `wm-getaway`/`wm-club` renamed to match new roles; update the `::ng-deep
  .wm-getaway` override in `home.component.scss`.
- `src/app/pages/join/join.component.html` heading → `The Itinerists`.
- `src/styles.scss` header comment updated.

### 3. External infrastructure (in this order)
1. **Firebase Hosting:** create site `the-itinerists` on project `trip-planner-ayyjayy2`
   (`firebase hosting:sites:create`), then update `firebase.json`. Site names are
   globally unique — if taken, confirm a fallback with the user before using it. The old
   `getaway-club` site stays live and untouched; the new site is empty until next deploy.
2. **GitHub:** `gh repo rename the-itinerists` (from `ayyjayy2/getaway-club`). GitHub
   redirects the old URL; `gh` updates the local remote.
3. **Local folder:** `mv getaway-club the-itinerists` as the **final step** of the whole
   project — it invalidates the running Claude Code session's working directory, so the
   user restarts the session in the new path afterward.

### 4. Docs
- Update living docs to "The Itinerists" with a "formerly Getaway Club" breadcrumb where
  history matters: `README.md`, `SETUP.md`, `ROADMAP.md`, `docs/HANDOFF.md`,
  `docs/SESSION-STATUS.md`, `docs/design-phases.md`, `docs/design-phase-2/DECISIONS.md`.

## Explicitly out of scope
- Firebase project ID `trip-planner-ayyjayy2`, auth domains, CSP entries (project IDs
  cannot be renamed).
- Archived design snapshots: `docs/design-phase-2/*.dc.html`, dated specs in
  `docs/superpowers/specs/` — frozen historical record.
- Home page copy "Let's plan your first getaway" — plain English word, not the brand.
- Uncommitted `src/version.ts` change (pre-existing, unrelated).

## Testing
- `npm run build` succeeds and outputs to `dist/the-itinerists/browser`.
- `npm run test:ci` passes (brand component template change is covered by existing specs
  if any reference the wordmark text).
- Grep for `getaway` (case-insensitive) outside `node_modules`/`dist`/archived docs
  returns only the intentional leftovers listed above.
