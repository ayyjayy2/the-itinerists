# Design Phases

Authoritative record of the app's **visual/UX design phases** and which commits belong to each.
(Design Phases are about the look & feel iterations — they are **separate** from the ROADMAP's
functional Phases 1–5.)

Each phase is frozen with a git **tag** + a **GitHub Release** so the exact code is preserved and
downloadable forever. To view/run any past phase:

```bash
git checkout design-phase-1        # inspect the frozen code (detached HEAD)
git checkout -b tmp design-phase-1 # or branch off it to run/experiment
```

…or download the source archive from the GitHub Release page.

---

## Design Phase 1 — baseline (COMPLETE, frozen)

The current functional app **before** the wireframe-driven visual redesign. Warm botanical
identity, desktop-sidebar layout, Nunito, cream/sage/pink/gold palette.

- **Tag:** `design-phase-1`
- **Boundary commit:** `0ef2426` — _refactor(recs): make Recs user-driven per trip (TP-28) (#51)_
- **Scope:** all commits reachable from the `design-phase-1` tag (project start → `0ef2426`).
- **GitHub Release:** https://github.com/ayyjayy2/the-itinerists/releases/tag/design-phase-1
- **Deployed live:** https://trip-planner-ayyjayy2.web.app (release 2026-07-14 19:59; build `Jul 14 @ 7:45 PM`).
- **What's in it:** multi-trip architecture (TP-4…24), open signup + `/get-started` onboarding
  (TP-25), searchable currency picker (TP-26), Firestore security rules locked down & deployed
  (TP-9), destination-aware weather (TP-27), user-driven Recs (TP-28).

To restore Phase 1 as the *live* site later: `git checkout design-phase-1`, `npm run build`,
`firebase deploy --only hosting` (or deploy it to a persistent preview channel to keep both live).

---

## Design Phase 2 — wireframe-driven visual redesign (COMPLETE, frozen)

Redesign of the app's visuals/layout from user-provided wireframes toward the **native
mobile app** direction (iOS-first, Android too, responsive across phone sizes — see
`docs/design-prompt.md`, `docs/HANDOFF.md`, and `docs/design-phase-2/DECISIONS.md`).

- **Tag:** `design-phase-2`
- **Boundary commit:** `9f45063` — _fix(map): destination-aware geocoding (#82)_
- **Scope:** every commit in `design-phase-1..design-phase-2` (i.e. `git log design-phase-1..design-phase-2`).
- **GitHub Release:** https://github.com/ayyjayy2/the-itinerists/releases/tag/design-phase-2
- **Deployed live:** https://trip-planner-ayyjayy2.web.app

**What's in it** — a top-to-bottom visual system + per-screen restyle:
- **Foundation (DP2-1…9):** Dusk Garden design tokens, Caprasimo display font, restyled shared
  components, bottom tab bar + "More" sheet + safe areas, custom line-icon set, "Getaway Club"
  wordmark + passport-stamp mark, multi-theme picker (Light / Dusk Meadow / Golden Hour /
  Plum Dusk / Night Garden).
- **Home (DP2-3, 12–16):** bold Caprasimo countdown hero, trip switcher, Pinned shortcuts,
  "At a glance" (time-aware "First up", finance net owed/owe), designed zero-trips welcome,
  Google-Fonts CSP fix.
- **Per-screen restyle (DP2-6, 11, 17, 21–28):** Finance, My Trips, Flights, Stays, Itinerary,
  Recs (category line-icons + colour-coding), Packing, Outfits, Profile, Trip Settings,
  Create Trip, and the auth/onboarding screens — all emoji replaced with the line-icon set and
  brought onto the palette.
- **Map (DP2-29, 30):** revived the orphaned Map page (route + nav), Dusk Garden markers/legend,
  and fixed destination-aware geocoding (pins land in the right place).

**Story index** (branch `DP2-##` → PR):
DP2-1 (#52), DP2-2 (#53), DP2-3 (#54), DP2-4 (#55), DP2-5 (#56), DP2-6 (#57), dark-mode-off (#58),
DP2-8 (#59), DP2-9 (#60), tab-bar safe-area (#61), DP2-11 (#62), DP2-12 (#63), home auto-select (#64),
DP2-14 (#65), DP2-15 (#66), CSP fonts (#67), DP2-17 (#68), tripUsers fix (#69), home hero/finance (#70),
First-up time-aware (#71), roadmap §3.6 (#72), DP2-21 (#73), DP2-22 (#74), DP2-23 (#75), DP2-24 (#76),
DP2-25 (#77), DP2-26 (#78), DP2-27 (#79), DP2-28 (#80), DP2-29 (#81), DP2-30 (#82).

To restore Phase 2 as the *live* site later: `git checkout design-phase-2`, `npm run build`,
`firebase deploy --only hosting` (or deploy to a persistent preview channel).

---

## After Phase 2 — feature work (not a design phase)

Work merged **after** the `design-phase-2` tag is **functional feature work**, not more visual
redesign, so it's logged separately in **`docs/feature-log.md`** (Milestone 1: Map &
Transportation, PRs #84–#93). The `design-phase-2` tag stays put as the clean visual-redesign
boundary. If/when the next *visual* redesign starts, it becomes Design Phase 3 with its own tag.

### Convention going forward
- Every commit **after** the `design-phase-1` tag and **before** the `design-phase-2` tag is
  Design Phase 2. Git makes this unambiguous: `git log design-phase-1..design-phase-2` lists exactly
  the Phase 2 commits.
- Keep story PRs (`TP-##` / a `DP2-##` prefix if we want phase-explicit branches) listed above as
  they merge, so there's a human-readable index too.
- Freeze each future phase with a `design-phase-N` tag + GitHub Release the same way.
