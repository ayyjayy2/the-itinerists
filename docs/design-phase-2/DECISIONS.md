# Design Phase 2 — locked decisions

Source brief: this folder (`Design Overview.dc.html` = the exploration log,
`Trip Planner App.dc.html` = the interactive prototype). Reference screenshots are
in `uploads/` (gitignored — large; also in the original `_original-export.zip`).

## Locked (2026-07-15)
- **Palette: Dusk Garden** — warm cream ground `#F8F4EF`, sage primary
  (`#8BAF7C` / `#6A8F5E`), **lavender** third voice (`#B4A6D4` / `#7E6FA8`), gold
  (`#F2C48A` / `#B97F35`) + pink (`#E8B4B8` / `#B96A76`) tags, text `#3A3328`,
  danger `#C0564A`. Tints: sage `#EAF1E3`, lavender `#ECE7F4`, gold `#FBEED9`,
  pink `#F9ECED`, danger `#F7E4E1`. Surface `#FFF`, surface-2 `#F5EFE3`, border `#EDE5D8`.
- **App name: "Getaway Club"** — WORKING name, not final. Keep exploring later
  (Sprig / Flock were runners-up). Build visuals under this; finalize in the
  branding story. Bundle ID / store name not needed until native (Phase 4).
- **App icon: 4b** — "lettered ring" passport stamp: dashed ring + inner ring +
  sage leaf, with `GETAWAY CLUB · EST 2026 ·` set around it (see Overview §t4).
  **Backup: 4c** (perforated postage-dot ring) — keep, develop further later.
- **Typography:** Nunito stays the UI font; **Caprasimo** added as the display face
  (hero numbers, wordmark, big headings).
- **Nav direction:** bottom tab bar (Home · Itinerary · Finance · More), safe-area
  insets, bottom sheets; sidebar returns at ≥700pt (tablet/desktop).
- **Icons:** custom line-icon set (2.2px round strokes) replaces emoji section icons.
- **Dark mode:** warm espresso/moss ground, user-toggle in Trip Settings → Appearance.

## Still open (revisit later)
- Final app name + wordmark; final icon (4b vs 4c).
- Home hero variant (leaning 1b "bold countdown").
- Whether to also ship the alt palettes as selectable themes.

## Implementation roadmap (each = DP2-## branch → PR → pause; all Design Phase 2 commits)
1. **DP2-1 Foundation** ✅ — Dusk Garden tokens, Caprasimo font, restyled shared
   components (pill buttons ≥44pt, neutral chips, rounded inputs).
2. **DP2-2 App shell** — bottom tab bar + safe areas + "More" sheet + FAB; custom
   icon set in the nav; sidebar as the ≥700pt adaptation.
3. **DP2-3 Home** — new hero (Caprasimo bold countdown), glance chips, trip switcher.
4. **DP2-4 Dark mode** + Appearance toggle.
5. **DP2-5…N** — per-screen restyle (Itinerary, Stays, Flights, Recs, Packing,
   Outfits, Map, Profile, Settings, My Trips, Create Trip, auth/onboarding).
6. **DP2-Finance** — who-owes-who ledger rework (functional + visual).
7. **DP2-Branding** — name, wordmark, app icon (4b), splash.
