# Rename Getaway Club → The Itinerists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app from "Getaway Club" to "The Itinerists" across code, brand UI, docs, and external infra (Firebase Hosting site, GitHub repo, local folder).

**Architecture:** Pure rename — no behavior change. Config identifiers use slug `the-itinerists`; user-facing strings use `The Itinerists`. Verification is `npm run build`, `npm run test:ci`, and a clean grep. External infra changes (Firebase site, repo, folder) run last, after local changes are committed.

**Tech Stack:** Angular 19 (standalone components), Firebase Hosting, `firebase` CLI, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-07-24-rename-the-itinerists-design.md`

**Historical-reference rule (applies to every task):** `savannah-getaway` / "Savannah Getaway" strings that refer to the *predecessor app or its Firebase project* stay unchanged (e.g. `docs/SESSION-STATUS.md`, `docs/CHANGES.md`). Only strings that name the *current* app change. Exception: `SETUP.md` uses `savannah-getaway` in stale build/deploy paths for the current app — those update to `the-itinerists`.

---

### Task 1: Config identifiers (package.json, angular.json, firebase.json public path)

**Files:**
- Modify: `package.json:2`
- Modify: `angular.json:9,23,79,82`
- Modify: `firebase.json:13`

- [ ] **Step 1: package.json** — change `"name": "getaway-club",` → `"name": "the-itinerists",`

- [ ] **Step 2: angular.json** — four edits:
  - Line 9: project key `"getaway-club": {` → `"the-itinerists": {`
  - Line 23: `"outputPath": "dist/getaway-club",` → `"outputPath": "dist/the-itinerists",`
  - Line 79: `"buildTarget": "getaway-club:build:production"` → `"buildTarget": "the-itinerists:build:production"`
  - Line 82: `"buildTarget": "getaway-club:build:development"` → `"buildTarget": "the-itinerists:build:development"`

- [ ] **Step 3: firebase.json** — `"public": "dist/getaway-club/browser",` → `"public": "dist/the-itinerists/browser",`. Leave `"site"` alone for now (changes in Task 6 together with site creation).

- [ ] **Step 4: Verify build works and outputs to the new path**

Run: `npm run build`
Expected: succeeds; `ls dist/the-itinerists/browser/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add package.json angular.json firebase.json
git commit -m "chore: rename project slug to the-itinerists"
```

### Task 2: User-facing strings (title, manifest, Join page)

**Files:**
- Modify: `src/index.html:5`
- Modify: `public/manifest.webmanifest:2-3`
- Modify: `src/app/pages/join/join.component.html:20`

- [ ] **Step 1: index.html** — `<title>Getaway Club</title>` → `<title>The Itinerists</title>`

- [ ] **Step 2: manifest.webmanifest** — `"name": "Getaway Club",` → `"name": "The Itinerists",` and `"short_name": "Getaway Club",` → `"short_name": "The Itinerists",`

- [ ] **Step 3: join.component.html** — `<h1>Getaway Club</h1>` → `<h1>The Itinerists</h1>`

- [ ] **Step 4: Commit**

```bash
git add src/index.html public/manifest.webmanifest src/app/pages/join/join.component.html
git commit -m "feat: rename user-facing app name to The Itinerists"
```

### Task 3: Brand lockup component

**Files:**
- Modify: `src/app/shared/brand/brand.component.ts`
- Modify: `src/app/pages/home/home.component.scss:99-100`
- Modify: `src/styles.scss:3`

- [ ] **Step 1: Rewrite brand.component.ts** — doc comment, ring text, wordmark spans (article "THE" takes the old small-caps lavender "CLUB" styling and comes first; "itinerists" takes the old Caprasimo "getaway" styling). Ring text gains 2 characters, so font-size drops 5.4 → 5.2 and letter-spacing 1.1 → 1.0 to keep it on the arc. Full new file:

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

let uid = 0;

/**
 * The Itinerists brand lockup (formerly "Getaway Club", DP2-8): the "4b"
 * passport-stamp mark (dashed/inner ring lettered "THE ITINERISTS · EST 2026 ·"
 * with a sage leaf) + the wordmark ("THE" in small Nunito caps, lavender,
 * before "itinerists" in Caprasimo).
 *
 * `variant="inline"` for chrome (header/sidebar); `variant="stacked"` for the
 * big auth screens. `[mark]` sizes the stamp in px. Change the copy here to
 * rebrand app-wide.
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="brand" [class.stacked]="variant === 'stacked'">
      <svg class="brand-mark" [style.width.px]="mark" [style.height.px]="mark"
           viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs><path [attr.id]="ringId" d="M24 7.5a16.5 16.5 0 1 1 0 33 16.5 16.5 0 0 1 0-33"/></defs>
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.7"/>
        <circle cx="24" cy="24" r="11.6" stroke="currentColor" stroke-width="1.7"/>
        <text font-family="Nunito, sans-serif" font-size="5.2" font-weight="800"
              fill="currentColor" letter-spacing="1">
          <textPath [attr.href]="'#' + ringId">THE ITINERISTS · EST 2026 ·</textPath>
        </text>
        <path d="M29.5 18.8c-6.2 0-9.9 3.3-9.9 8.3 1-3.6 3.4-5.9 7.2-7-3.4 2-5.5 4.5-6.2 7.8 5.7.9 8.9-3.3 8.9-9.1z"
              fill="currentColor"/>
      </svg>
      @if (showWordmark) {
        <span class="wordmark">
          <span class="wm-the">the</span><span class="wm-name">itinerists</span>
        </span>
      }
    </span>
  `,
  styles: [`
    .brand { display: inline-flex; align-items: center; gap: 0.5rem; }
    .brand.stacked { flex-direction: column; gap: 0.55rem; }
    .brand-mark { color: var(--primary-dark); flex-shrink: 0; }
    .wordmark { display: inline-flex; align-items: baseline; gap: 0.32rem; line-height: 1; }
    .brand.stacked .wordmark { flex-direction: column; align-items: center; gap: 0.15rem; }
    .wm-name { font-family: var(--font-display); font-size: 1.15rem; color: var(--text); line-height: 1; }
    .wm-the {
      font-family: var(--font); font-weight: 800; font-size: 0.68rem;
      letter-spacing: 0.2em; text-transform: uppercase; color: var(--lavender-dark);
    }
    .brand.stacked .wm-name { font-size: 2.1rem; }
    .brand.stacked .wm-the { font-size: 0.9rem; letter-spacing: 0.42em; }
  `],
})
export class BrandComponent {
  @Input() mark = 28;
  @Input() variant: 'inline' | 'stacked' = 'inline';
  @Input() showWordmark = true;

  readonly ringId = `ti-ring-${uid++}`;
}
```

- [ ] **Step 2: home.component.scss** — the welcome-hero white override:
  - `::ng-deep .wm-getaway { color: #fff; }` → `::ng-deep .wm-name { color: #fff; }`
  - `::ng-deep .wm-club { color: #fff; opacity: 0.85; }` → `::ng-deep .wm-the { color: #fff; opacity: 0.85; }`

- [ ] **Step 3: styles.scss** — header comment `// ── Getaway Club Theme Variables — "Dusk Garden" (Design Phase 2) ─────────────` → `// ── The Itinerists Theme Variables — "Dusk Garden" (Design Phase 2) ──────────`

- [ ] **Step 4: Verify** — `npm run test:ci` passes; `npm run build` passes. Visually check the stamp ring text fits the arc (serve with `npm start`, look at login screen brand; if "THE ITINERISTS · EST 2026 ·" overflows past its start, drop font-size to 5.0).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/brand/brand.component.ts src/app/pages/home/home.component.scss src/styles.scss
git commit -m "feat: The Itinerists brand lockup (wordmark + stamp ring)"
```

### Task 4: Docs

**Files:**
- Modify: `README.md:3`, `SETUP.md:110,118,133,135`, `ROADMAP.md:99`, `docs/HANDOFF.md:1,21,32,45`, `docs/design-phases.md:27,47`, `docs/design-phase-2/DECISIONS.md:13`
- Rename: `docs/Savannah Getaway Documentation.pages` → `docs/Savannah Trip Documentation.pages`
- Leave alone: `docs/SESSION-STATUS.md`, `docs/CHANGES.md`, `docs/design-phase-2/*.dc.html`, dated specs, `docs/HANDOFF.md:13,107,149` (historical statements about the rebrand/naming process)

- [ ] **Step 1: README.md** — `# IrelandStpatricks` → `# The Itinerists` (heading was stale scaffold text; note stays that this evolved from the Ireland prototype).

- [ ] **Step 2: SETUP.md** — stale paths for the current app:
  - `cd savannah-getaway` → `cd the-itinerists`
  - `npx http-server dist/savannah-getaway/browser -p 8080` → `npx http-server dist/the-itinerists/browser -p 8080`
  - ``2. Deploy `dist/savannah-getaway/browser/` to any static host:`` → ``2. Deploy `dist/the-itinerists/browser/` to any static host:``
  - `- **Vercel**: `npx vercel dist/savannah-getaway/browser`` → `- **Vercel**: `npx vercel dist/the-itinerists/browser``

- [ ] **Step 3: ROADMAP.md** — `- [ ] Update all "savannah-getaway" references in code and configs` → `- [x] Rename app to "The Itinerists" (formerly "Getaway Club"; earlier "savannah-getaway") — code, configs, infra (2026-07-24)`

- [ ] **Step 4: docs/HANDOFF.md**
  - Line 1: `# Getaway Club — Session Handoff` → `# The Itinerists — Session Handoff`
  - Line 21: `- **App:** "Getaway Club" — Angular 19 multi-trip travel app.` → `- **App:** "The Itinerists" (formerly "Getaway Club") — Angular 19 multi-trip travel app.`
  - Line 32: `- **App:** Angular 19 standalone-components **"Getaway Club"** (working name; earlier "Trip` → `- **App:** Angular 19 standalone-components **"The Itinerists"** (formerly "Getaway Club"; earlier "Trip` (keep the rest of the sentence on line 33 intact)
  - Line 45: `` - **Repo:** `ayyjayy2/getaway-club` (private; formerly `trip-planner`).`` → `` - **Repo:** `ayyjayy2/the-itinerists` (private; formerly `getaway-club`, `trip-planner`).``

- [ ] **Step 5: docs/design-phases.md** — release URLs (GitHub redirects old ones after the Task 7 rename, but point at the canonical name):
  - `https://github.com/ayyjayy2/getaway-club/releases/tag/design-phase-1` → `https://github.com/ayyjayy2/the-itinerists/releases/tag/design-phase-1`
  - same for `design-phase-2`. Line 52's `"Getaway Club"` mention is a historical description — leave it.

- [ ] **Step 6: docs/design-phase-2/DECISIONS.md** — line 13: `- **App name: "Getaway Club"** — WORKING name, not final. Keep exploring later` → `- **App name: "Getaway Club"** — WORKING name, not final. *(Resolved 2026-07-24: final name is **The Itinerists**.)*`

- [ ] **Step 7: Rename the .pages file**

```bash
git mv "docs/Savannah Getaway Documentation.pages" "docs/Savannah Trip Documentation.pages"
```

- [ ] **Step 8: Commit**

```bash
git add -A README.md SETUP.md ROADMAP.md docs/
git commit -m "docs: update living docs for The Itinerists rename"
```

### Task 5: Full verification sweep

- [ ] **Step 1:** `npm run build` — succeeds, outputs `dist/the-itinerists/browser/`.
- [ ] **Step 2:** `npm run test:ci` — all green.
- [ ] **Step 3:** Grep for leftovers:

```bash
grep -riIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.angular --exclude-dir=.firebase --exclude=package-lock.json "getaway" .
```

Expected remaining hits ONLY in: `docs/SESSION-STATUS.md`, `docs/CHANGES.md`, `docs/HANDOFF.md` (lines 13/107/149 historical), `docs/design-phases.md:52`, `docs/design-phase-2/DECISIONS.md` (13/17 historical), `docs/design-phase-2/*.dc.html`, `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `src/app/pages/home/home.component.html:61` ("first getaway" copy), `ROADMAP.md:99` (breadcrumb), `docs/HANDOFF.md:45` (breadcrumb), `claude-notes/`. Anything else = missed rename, fix it.

### Task 6: Firebase Hosting site

- [ ] **Step 1: Create the new site** (needs firebase CLI auth):

```bash
npx firebase hosting:sites:create the-itinerists --project trip-planner-ayyjayy2
```

Expected: "Site the-itinerists has been created". If the name is globally taken, STOP and ask the user which fallback to use (suggest `the-itinerists-app`).

- [ ] **Step 2: firebase.json** — `"site": "getaway-club",` → `"site": "the-itinerists",`

- [ ] **Step 3: Commit**

```bash
git add firebase.json
git commit -m "chore: point hosting at the-itinerists site"
```

Note: old `getaway-club.web.app` stays deployed/live; new site is empty until the next `firebase deploy`. Deleting the old site is a separate, user-initiated decision.

### Task 7: GitHub repo rename

- [ ] **Step 1:**

```bash
gh repo rename the-itinerists --yes
```

Expected: renamed `ayyjayy2/getaway-club` → `ayyjayy2/the-itinerists`; gh updates the local `origin` remote automatically. Verify with `git remote -v`.

### Task 8: Local folder rename (FINAL step, after branch is merged/pushed per user's choice)

- [ ] **Step 1:** From the parent directory:

```bash
mv /Users/alayna/Documents/Code/mobileApps/getaway-club /Users/alayna/Documents/Code/mobileApps/the-itinerists
```

This invalidates the running Claude Code session's working directory — the user restarts Claude Code in `the-itinerists/` afterward. Do this only when everything else is done.
