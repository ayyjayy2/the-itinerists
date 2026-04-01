# Bug: All App Styles Missing in Deployed App

**Date:** March 29, 2026
**Severity:** High — the entire app stylesheet was silently not applying in production

---

## The Symptom

The deployed app looked completely unstyled compared to the local dev version:
- Content touching edges on all sides (no padding/margins)
- Missing UI improvements that were clearly in the codebase
- Hard refreshes, cache clears, and re-entering the URL made no difference

The local dev server (`ng serve`) always looked correct.

---

## Why It Was Hard to Diagnose

Several red herrings made this difficult:

1. **Unmerged branch** — `IRE-08-Finance` had never been merged to `main`, so some finance UI improvements genuinely were missing from the deployed app. This masked the deeper CSS issue.

2. **Service worker suspicion** — The old Angular service worker (ngsw) was a reasonable suspect since it had been caching everything. A kill-switch (`ngsw-worker.js`) had been deployed to clear it, but we weren't sure it was working.

3. **CSS looked correct in the bundle** — Inspecting the built `styles-*.css` file confirmed `.page-container { padding: 1.5rem 2rem }` was there. The CSS was correct. It just wasn't loading.

4. **No visible error** — Browsers silently block CSP violations for event handlers. Nothing in the UI indicated the stylesheet was being skipped.

---

## The Root Cause

Angular's production build uses an `inlineCritical` CSS optimization. It splits styles into:
- **Critical CSS** — inlined directly into `index.html` as a `<style>` block (resets, CSS variables)
- **The rest** — loaded lazily via a `<link>` tag with a `media="print"` trick:

```html
<link rel="stylesheet" href="styles-XXXXX.css" media="print" onload="this.media='all'">
```

The `onload="this.media='all'"` is an **inline JavaScript event handler**. The app's Content Security Policy (added in IRE-09) restricts scripts:

```
script-src 'self' https://www.google.com https://www.gstatic.com https://recaptcha.net;
```

No `'unsafe-inline'` — so the browser **silently blocked** the `onload` handler. The stylesheet stayed as `media="print"` forever and never applied to the screen.

Only the inlined critical CSS (`margin: 0; padding: 0` reset + CSS variables) ever applied. Every other style — padding, colors, cards, layout — was skipped entirely.

This worked fine locally because `ng serve` doesn't set HTTP headers, so there's no CSP to enforce.

---

## The Fix

Disabled `inlineCritical` in `angular.json` for the production build:

```json
"optimization": {
  "scripts": true,
  "styles": {
    "minify": true,
    "inlineCritical": false
  },
  "fonts": true
}
```

This makes Angular emit a normal `<link rel="stylesheet">` tag instead of the deferred loading trick, which is fully compatible with the CSP.

---

## Lesson

When adding a strict CSP (`script-src` without `'unsafe-inline'`), check that the build toolchain doesn't rely on inline event handlers. Angular's `inlineCritical` optimization is a common offender. Always test the **production build** against the deployed CSP headers — not just the dev server.
