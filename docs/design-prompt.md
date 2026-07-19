# Design prompt — Trip Planner (mobile-first, native app)

Paste the block below into Claude (or another design tool) to generate high-fidelity
visual designs. Adjust the **[CUSTOMIZE]** lines first (see notes at the bottom).

**Context for us (not part of the prompt):** the app is built in Angular and will ship as a
**native iOS + Android app via Capacitor** (ROADMAP Phase 4) — the same codebase becomes the
mobile app. So designs must be **mobile-first and iOS-leaning**, dynamic across phone sizes,
with the desktop/tablet view as a scale-up adaptation.

---

## PROMPT

You are a senior product designer specializing in **native mobile apps (iOS-first)**. Design
high-fidelity screens for **Trip Planner**, an existing app I'm redesigning. Keep the information
architecture and what each screen does the same — I want a stronger, mobile-native *visual* design
for the *exact* set of screens below, not a re-architecture.

### Product
Trip Planner is a collaborative, multi-trip travel-planning app for friend groups. A user creates
or joins a trip and the whole group shares one plan: itinerary, flights, stays, a shared budget,
packing lists, outfit ideas, and recommendations. It's warm, personal, and social — think "planning
a girls' trip with your friends," not a corporate booking tool.

### Platform & priorities (IMPORTANT)
- **This is a native mobile app for both iOS and Android** (shipped via Capacitor, so it's the same
  codebase as a web build). **Design mobile-first. Lead with iOS (iPhone), but Android is a required
  platform, not an afterthought** — deliver Android variants of the navigation, sheets, and core
  screens (Material 3 conventions), not just iOS. The web/desktop view is a scale-up, not the
  primary target.
- **Must be dynamic across device sizes and phone types.** Design fluid, adaptive layouts — not one
  fixed width. Explicitly account for:
  - Small phones (~360–375 pt wide, e.g. iPhone SE) up to large (~430 pt, iPhone Pro Max), and
    Android equivalents (compact to large).
  - **Safe-area insets**: iOS notch / Dynamic Island + home indicator, and Android status/navigation
    bars (gesture and 3-button) — content, headers, and the tab bar must respect them (show the
    safe-area padding in your frames).
  - Larger dynamic-type / accessibility text sizes without breaking layout.
- **Follow each platform's native conventions** while keeping our brand:
  - **iOS:** bottom tab bar, large/sticky titles, **bottom sheets** for add/edit, swipe gestures,
    pull-to-refresh, momentum scrolling, action sheets/alerts, ≥44 pt touch targets, haptics.
  - **Android (Material 3):** bottom navigation bar, top app bar, Material bottom sheets & dialogs,
    FAB, ripple feedback, ≥48 dp touch targets.
- Also provide a **tablet / desktop adaptation** for 2–3 core screens (the bottom tabs can become a
  left sidebar at wide breakpoints).

### Brand & art direction (keep this identity)
- **Mood:** warm, soft, friendly, botanical/organic. Rounded, cozy, a little feminine. Logo mark is
  a simple green **leaf 🌿**.
- **Type:** Nunito (weights 400–800). Rounded, friendly sans.
- **Color tokens (hex):**
  - Background: `#FAF6EF` (warm cream) · Card surface: `#FFFFFF`
  - Primary / sage green: `#8BAF7C`, dark `#6A8F5E`
  - Accent / warm gold: `#F2C48A`, dark `#E0A055`
  - Highlight / soft pink: `#E8B4B8`, dark `#D4909A`
  - Text: `#3A3020` (warm near-black brown); muted `#8A7E6A`; Border: `#EDE5D8`
  - Shadows: soft, green-tinted, e.g. `0 4px 24px rgba(139,175,124,0.22)`
- **Shape:** border-radius 8 / 16 / 24 pt; generous padding; pill-shaped chips & buttons.
- **Iconography:** friendly emoji are used as section icons today (🏠 🧭 ✈️ 📅 🏨 💵 🧾 🌸 🧳 👗 ⚙️ 👤).
  Keep emoji or propose a matching custom line-icon set for the tab bar — show both if unsure.

### Branding & naming exploration
The app name is **not final** — "Trip Planner" is a working placeholder. As part of this work:
- Propose **3 distinct app-name + wordmark directions** that fit the warm, botanical, friendly
  identity. For each: the name, a one-line rationale, and the wordmark set in a fitting typeface
  (pair well with Nunito or suggest a display face for the logo).
- Design an **app-icon concept** for each direction (built around the leaf 🌿 motif) and show it in
  both platform forms: iOS rounded-square and Android adaptive/round, on a background from our
  palette, at large and small sizes.
- Design a matching **splash / launch screen** for iOS and Android.
- **Recommend one direction** and say why.

### Primary navigation (bottom tab bar)
Design a bottom tab bar with 4 tabs + an overflow: **Home · Itinerary · Finance · More**.
"More" opens the rest (Flights, Stays, Packing, Outfits, Map, Recs, My Expenses, Trip Settings,
Profile). Add actions use a floating "+" or a header "+", opening a bottom sheet.

### Screens to design (keep each screen's purpose & core content)
Auth / onboarding (full-screen, no tab bar):
1. **Login** — centered, username + password, leaf header, "Sign up" link.
2. **Sign up** — create account: name, emoji avatar, color swatch, username, password.
3. **Get started** — post-signup: two big choice cards ("Set up a trip" / "I have an invite code")
   + a small "Do this later" link.
4. **Join** — enter/confirm invite code + set up profile.

Main app (inside the tab-bar shell):
5. **Home** — trip dashboard: hero with destination + countdown ("Ready for Tokyo?"), quick stats,
   at-a-glance cards.
6. **My Trips** — the user's trips (active vs archived) + "New Trip".
7. **Create Trip** — name, destination, start/end dates, and a **searchable currency picker**
   (great candidate for a native bottom-sheet search list).
8. **Itinerary** — day-by-day plan; per-day cards; **swipe between days**; weather chip per day.
9. **Flights** — arrivals/departures; per-person flight cards; add-flight bottom sheet.
10. **Stays** — accommodations list/cards.
11. **Finance** — shared budget/expense overview, totals, per-category breakdown.
12. **My Expenses** — the current user's personal expense entries.
13. **Recs** — user-added tips grouped by category (Food, Drink, Places, Activities, Tips, Culture)
    with filter chips and an empty state.
14. **Packing** — personal checklist by category + "suggest an item to a friend."
15. **Outfits** — per-day outfit planner with a live weather card + suggestions.
16. **Map** — saved-location pins on a map.
17. **Trip Settings** — edit details, members list, activity log, page-visibility toggles,
    "remove trip" confirmation (as a native action sheet / centered alert).
18. **Profile** — avatar, name, username, change password.

### Reusable components to define
Cards; pill chips (default / primary / highlight / muted) as filters & tags; buttons
(primary / ghost / accent / danger, pill-shaped); empty states (icon + headline + subtext + CTA);
form fields, selects, and a **searchable combobox** rendered as a bottom sheet; **bottom sheets**
and confirmation alerts/action sheets; a "people picker" (avatar buttons); weather cards
(emoji + temp range + city); avatars (emoji on a colored circle); the **bottom tab bar** itself.

### Deliverables
- **All 18 screens above** designed as mobile-native, framed on a **standard iPhone (~390 pt)** with
  visible safe areas. (Please cover the full set, not a subset.)
- **Android (Material 3) variants** of the bottom navigation, sheets/dialogs, and at least 4–5 core
  screens (Home, Itinerary, Finance, Create Trip, Trip Settings) shown alongside their iOS versions.
- To prove it's dynamic: show **2–3 key screens at a small size (~360–375 pt) and at Pro Max
  (~430 pt)** so the responsive behavior is clear.
- The **bottom tab bar** + the "More" menu (iOS and Android forms).
- **Branding:** 3 app-name + wordmark directions, an **app-icon** concept per direction (iOS
  rounded-square + Android adaptive/round, large and small), a **splash/launch screen**, and a
  recommended direction (see "Branding & naming exploration").
- A **tablet/desktop adaptation** of 2–3 core screens (tabs → sidebar at wide breakpoints).
- A one-page **component / style sheet**: color swatches, type scale, buttons, chips, cards,
  inputs, bottom sheet, empty state, avatar, tab bar.
- A **system-aware dark-mode** variant of the core screens and tokens.
- Keep WCAG AA contrast, ≥44 pt (iOS) / ≥48 dp (Android) touch targets.

### Constraints
- Preserve the warm, botanical, friendly identity and the leaf motif.
- Don't change the app's information architecture or what each screen does.
- Prefer evolving the existing color tokens over inventing a wholly new palette. [CUSTOMIZE — see below]

---

## Notes for you (delete before pasting)
- **Palette:** default asks the tool to *evolve* the current colors. For a bolder rebrand, change
  the last constraint to "explore 2–3 distinct palette directions."
- Scope (all 18 screens), Android (Material 3), and naming/logo/icon exploration are now baked into
  the prompt as requirements.
