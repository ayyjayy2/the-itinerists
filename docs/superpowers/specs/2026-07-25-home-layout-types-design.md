# Home Layout Types (A/B) + Notification Bell — Design

**Date:** 2026-07-25
**Status:** Approved (Alayna)

## Problem

User testing (two test subjects) favors the old Savannah-era layout: a home
page with a hero plus a "Quick Access" card grid for every page, and a
hamburger → left slide-out drawer for navigation. Alayna prefers the current
layout (Pinned + At a glance + Latest from the group, sidebar/tab-bar nav).
Both should exist, switchable per account — with the group favorite as the
default and the toggle exposed only to Alayna.

## Decisions

- **Two layouts:** `Type A` = the current design. `Type B` = old-style layout
  (details below). **Default is B** — `homeLayout` absent means B.
- **Toggle only for Alayna:** Profile shows a "Home Layout" section only when
  `username === 'alayna'`. Everyone else gets B with no visible option.
  (Cosmetic gate — nothing sensitive behind it.)
- `homeLayout: 'A' | 'B'` lives on `users/{uid}` — account data, follows the
  user across devices, covered by the existing owner-update rule.
- **Bell is Type B only.** Type A keeps its inline "Latest from the group"
  home section unchanged.
- **Hamburger stays top-left** despite right-hand-reach concerns: in Type B
  the drawer is secondary navigation (Quick Access cards do the daily work),
  and top-left is the convention users recognize. The frequently-tapped bell
  gets the easy top-right spot.

## 1. Layout resolution

`effectiveHomeLayout(user): 'A' | 'B'` — returns `user?.homeLayout ?? 'B'`.
Drives both the home page body and the app shell (nav) via
`UserService.firestoreUser`.

## 2. Type B home page

Top (unchanged from today): trip switcher chips + countdown hero
("Ready for Lisbon, N days") with multi-destination support.

Below, replacing Pinned / At a glance / Latest from the group: a
**"Quick Access"** heading and 2-column grid of link cards — icon, label,
one-line description, per-card accent color (top edge) — resurrected from the
pre-redesign layout (`git show 6bf6cc2:src/app/pages/home/home.component.html`,
`.links-grid` / `.link-card`, restyled with app-icon instead of emoji to match
the current design system). Cards, in order:

| Card | Path | Description |
|---|---|---|
| Itinerary | /itinerary | Day-by-day plans |
| Flights | /flights | Arrivals & departures |
| Stays | /accommodations | Hotels & check-in |
| Transportation | /transportation | Rental car & getting around |
| Finance | /finance | Shared expenses |
| My Expenses | /expenses | Your private spending |
| Recs | /recs | Tips & spots |
| Packing | /packing | Your packing list |
| Outfits | /outfits | Plan your looks |
| Map | /map | Trip map |
| Profile | /profile | Settings & account |

Implementation: one `HomeComponent`; hero shared, body branches on the layout
(`@if`). No route changes. Home pins (Type A's section) remain account data —
untouched, just not rendered in B.

## 3. Notification bell + /updates page (Type B)

- **Badge source:** the active trip's `activityLog` entries where
  `performedBy !== my uid` and `timestamp > lastSeenActivityAt` (new optional
  `users/{uid}.lastSeenActivityAt: number`; absent → everything by others is
  unseen). Count caps visually at "9+".
- **Bell placement:** right side of the Type B top bar.
- **Tap bell → dropdown:** "N updates" header + up to 5 most recent unseen
  entries (same `performedByName — action · time ago` formatting the home feed
  uses today) + "See all" → `/updates`.
- **`/updates` page** (auth-guarded route): the full "Latest from the group"
  feed, newest first, same data source and text as the current home section.
  On open, writes `lastSeenActivityAt = Date.now()` to the user doc — clears
  the badge everywhere (account data, cross-device).
- Own changes never count toward the badge or appear differently — the feed
  itself still lists everyone's entries like today.

## 4. Type B navigation

When B is active (any screen size):
- Hide the fixed desktop sidebar and the mobile bottom tab bar.
- Show a **top bar**: hamburger (top-left) · brand · bell + user chip (right).
- Hamburger opens a **left slide-out drawer** (overlay + scrim, closes on
  navigation or scrim tap): trip name header, nav items (Home plus the Quick
  Access list except Profile — Profile is reached via the footer user chip),
  Refresh, version tag, and the user chip + Log out pinned at the bottom —
  per the reference screenshots.
- Admin link appears in the drawer for admins (parity with current sidebar).

Type A navigation is completely untouched. The existing top bar/header used by
Type A remains as-is; the Type B top bar is a variant of it (same component,
branching on layout).

## 5. Profile toggle

"Home Layout" card in Profile, visible only when
`firestoreUser().username === 'alayna'`: two options (Type A / Type B) as a
segmented control or radio pair, current value highlighted; selecting writes
`homeLayout` to the user doc immediately (no save button). A one-line hint:
"Type B is the default for everyone; this override is yours alone."

## 6. Data model summary

`users/{uid}` gains: `homeLayout?: 'A' | 'B'` (absent → B) and
`lastSeenActivityAt?: number` (absent → 0). Both owner-writable under existing
rules; no rules changes.

**Data safety:** all changes are additive — no migrations, no scripts, no
rewrites of existing user docs (Makaela's new account and its data must remain
untouched). Field updates only ever target the signed-in user's own doc.

## 7. Testing

- **Unit:** layout resolution (absent → B, explicit A/B); unseen-count logic
  (excludes own entries, respects `lastSeenActivityAt`, absent → all others
  unseen); quick-access card list integrity (paths exist in routes).
- **Live:** flip the toggle on Alayna's account and verify both layouts —
  home body, nav chrome, bell badge/dropdown, `/updates` marking seen.
- **Deferred:** rules-emulator cases for the new fields (needs Java).

## Out of scope

- Per-user layout preferences for other accounts (they can come later by
  widening the toggle's visibility).
- Push/OS-level notifications — the bell is in-app only.
- Read-state per entry (single high-water timestamp only).
