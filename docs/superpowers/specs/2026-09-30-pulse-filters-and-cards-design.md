# Pulse: filters and four more cards

**Date:** 2026-09-30 · **Status:** built (PR #234)

Pulse is the owner-only usage dashboard at `/pulse/` (see
`2026-09-30-usage-analytics-design.md`). This adds filters and four cards.
Everything is computed in the browser from the `_activity` rows already
loaded for the selected range; no new Firestore reads, rules or indexes.

## Filters

- **Hide** — three checkboxes, saved to `_pulse/prefs.hide`: **me** (the owner's
  uid), **test trips** (`prefs.testTrips`), **test accounts** (`prefs.testUsers`,
  edited by admin script; photoprobe is on it). Test trips and test accounts
  start checked; me starts unchecked. Hidden rows leave every tile, chart,
  trip row and member count. Unchecking test trips lists them in the trips
  table again.
- **Trips** — a multi-select of checkboxes replacing the single select. None or
  all checked means every trip. The scope line names the selection.

## Cards

1. **Return rate** (`returnCohorts`): people by the Monday-start week they were
   first seen in the range; how many were active again the next day, within 7
   and within 14 days. Table with percentages; hover a number for names.
2. **Visits** (`sessionStats`): one visit per session id. Minutes from first to
   last event (< 1, 1–5, 5–15, 15–30, 30+) and distinct pages (1, 2, 3–5, 6+).
3. **Around the trip** (`aroundTrips`): distinct people per trip-day, aligned so
   day 0 is the trip's first day, from 14 days before to 7 days after the
   longest selected trip; stacked before / during / after; summed across the
   selected dated trips. Hidden when nothing falls in the window.
4. **Platform per day** (`platformPerDay`) stacked web / installed / iOS, and
   **App versions** (`versionStats`): people and last seen per version.

## Code

Pure functions in `public/pulse/stats.mjs`, each with a node test in
`test/pulse-stats.test.mjs` (`npm run test:pulse`). Rendering in
`public/pulse/pulse.mjs`; stacked columns use a small `stackBars` renderer
beside the existing `bars`. A stubbed-DOM harness (kept out of the repo) ran
`render()` over fabricated rows to check every card and filter path.

## Not included

A first-trip funnel (needs new app events) and server-side daily rollups
(the fix when the year range gets slow: the page subscribes to raw rows).
