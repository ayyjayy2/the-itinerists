<!-- Generated mirror of "The Itinerists" design system (https://claude.ai/artifact/2wKMcgfwoQbvJHbXH2XVpe, private; a copy is in Itinerists HQ → Technical docs).
     Values come from src/styles.scss; the design system is built from the code. tokens.json beside this file is the machine-readable set.
     Synced 2026-10-02. -->

# Design system

The Itinerists is a group trip planner: one shared plan for flights, stays, the itinerary, money and packing, made for the planner who loves an organized trip and the friends who just want to know what's next. The look is "Dusk Garden": a warm cream ground, sage as the brand voice, lavender as the second voice, gold and pink as tags, set in friendly rounded Nunito with Caprasimo for the big moments.

## Content fundamentals

- **Talk to the person as "you", the app as "we".** "We sent a link to m•••@example.com." "You're owed $33.33."
- **Sentence case everywhere**, including buttons and titles: "Add to my calendar", "Set up a trip", "Do this later".
- **Say what happened or what to do, plainly.** Errors explain the fix: "End date can't be before the start date." Empty states offer the next step: "Set up a trip" · "I have an invite code".
- **Trip names and avatars are the people's own**, emoji included ("Berlin 🇩🇪, Bibs 🏃‍♂️, & Beer 🍻"). The app itself uses emoji sparingly: the hero's ✨ and nothing as a section icon.
- **Real copy from the app:** "Ready for Panama? ✨" · "Enjoy Costa Rica ✨" · "13 days left" · "you + 2 friends" · "No new updates" · "Nothing on your trip to add yet."

## Visual foundations

### Color

- Set the page on `bg`, cards and sheets on `surface`, quiet areas on `surface-2`; outline with `border`.
- Body text is `text`. Keep `text-muted` to short labels, dates and captions on `surface`: it is below 4.5:1 on `bg` in every light theme.
- `primary` (sage) is the brand. Fill primary buttons with `primary-dark` and white text; one primary button per view.
- `lavender` is the second voice (the wordmark's "THE", flights). `accent` (gold) marks reminders and anything to look at again. `highlight` (pink) is a tag colour only. `danger` is for errors and destructive actions, never decoration.
- Each hue has a `-tint` wash and a `-dark` text step: put `-dark` text on its own `-tint`, as the chips do.
- Five themes, chosen on Profile and set as `data-theme` on `<html>`: Light (default), Dusk Meadow and Golden Hour (muted grounds, cream cards), Plum Dusk and Night Garden (dark). A sixth, Deep Moss, exists in the code as an unlisted backup.
- **Contrast, as the code stands:** several of the brand's text pairs meet only the 3:1 large-text level, not 4.5:1: white on `primary-dark` (3.7:1 in Light, under 3:1 in the dark themes), `accent-dark` on `accent-tint` (3.0:1), `lavender-dark` and `highlight-dk` on their tints (3.4 to 3.7:1), `danger` on `danger-tint` (3.7:1). They are kept exact here and flagged in each token's note; small text on them relies on weight 800.

### Typography

- Nunito (`sans`) for everything; Caprasimo (`display`) only for the hero countdown, the wordmark and other single big moments. Never set running text in Caprasimo.
- Weights do the work: 800 for buttons, chips and kickers; 700 for labels and headings; 400 for body.
- **Every form field is 16px or larger** (`field`). iPhones zoom the whole page in when a smaller field is focused, and the zoom sticks across pages.

### Spacing, radius, shadow

- Space on the steps the code uses: `space-1` to `space-8` (0.25 to 2rem). `space-2` and `space-4` are the workhorses.
- `radius` (16px) for cards, inputs and the hero; `radius-pill` for every button, chip and tab; `radius-sm` for banners.
- Cards rest on `shadow`; anything floating over other content (stop cards over the hero, dropdowns) uses `shadow-md`. Shadows are sage-tinted in Light.

### Layout and motion

- **The header and the bottom tab bar never move.** The page itself never scrolls; only the content area between them does. Nothing may scroll sideways except a strip built for it (the stop cards).
- Tappable things are at least 44px tall (`tap-target`).
- Pages fade in over 0.2s with opacity only, never a transform (a transform would pull fixed children such as the loader out of place).
- Loaders sit in the middle of the screen, appear only after 300ms (fast loads never flash) and stay at least 300ms; on Home right after sign-in they show at once. A busy button keeps its busy label ("Signing in…") until the next screen is up.
- Respect reduced motion: the live dot's pulse stops.

## UI rules

- **Every time shows its time-zone code**, the official abbreviation, never an offset: "11:30 AM CDT", "6:30 PM WEST". A flight's departure is in the departure airport's zone and its arrival in the arrival airport's.
- **Dates are short and clear:** "Oct 6 – 9" in a month, "Sep 30 – Oct 3" across two (en dash with spaces).
- **The current stop is a live dot**, not a word: the pin becomes a pulsing `primary` dot so every stop card's text stays on the same lines.
- **Reminders never block.** They are `accent-tint` banners with one action and a ✕ that hides them for the visit.
- **Keep people in the app.** Anything that hands off to another app (calendar export) is a small muted link at the end of the page, not a button.
- **Joiners never meet a paywall** or an extra account step.
- **Updates belong to a trip.** The bell shows the open trip's changes; switching trips shows the other trip's.

## Iconography

- One custom line set (assets/Icons): 24px grid, 2.2px round strokes, `currentColor` in the app. Use these, never emoji, for section and action icons.
- Brand marks are in assets/Logos: the stamp mark (lettered ring and leaf), the app badge, the app icon and the launch lockup.

## Tokens

CSS custom properties of the same names (`--bg`, `--primary-dark`…) are defined in `src/styles.scss`; themes switch with `data-theme` on `<html>`. A theme column that repeats Light's value inherits it.

### Colour

| Token | Light (default) | Dusk Meadow | Golden Hour | Plum Dusk | Night Garden | Use |
|---|---|---|---|---|---|---|
| `bg` | `#f8f4ef` | `#bfc6a9` | `#c4afb6` | `#221b20` | `#1a1f17` | Page ground behind everything. Cards and the header sit on it. |
| `surface` | `#ffffff` | `#efe6d2` | `#f1e4c8` | `#2c242a` | `#2c2530` | Cards, sheets, the header, inputs and the bottom tab bar. |
| `surface-2` | `#f5efe3` | `#e4dac3` | `#e7d7b8` | `#362c34` | `#352c3a` | Sunken or secondary areas: scope-tab tracks, muted chips, quiet panels. |
| `card-bg` | `{surface}` | `{surface}` | `{surface}` | `{surface}` | `{surface}` | Legacy alias of surface; older components still read it. Use surface in new work. |
| `text` | `#3a3328` | `#3a3328` | `#3a3328` | `#f3eaee` | `#f0efe2` | Body text and headings on bg, surface and surface-2 (11:1 or more in every theme). |
| `text-muted` | `#8a7e6a` | `#8a7e6a` | `#8a7e6a` | `#ac9aa6` | `#a9a38f` | Secondary text: labels, dates, captions, inactive tabs. 3.6:1 on bg and 4.0:1 on surface in Light, 1.9:1 on Golden Hour's bg: keep it to short labels on surface, never long copy or anything that must be read on bg. Flagged. |
| `border` | `#ede5d8` | `#cdbfa4` | `#d6c6a6` | `#3d3340` | `#403646` | Card outlines, dividers, input borders, chip outlines. |
| `primary` | `#8baf7c` | `#8baf7c` | `#8baf7c` | `#9dbf8e` | `#a8cb96` | Sage. The brand hue: icons, focus rings, ghost-button borders, the spinner, the current stop's live dot. Not for small text. |
| `primary-dark` | `#6a8f5e` | `#4f6f44` | `#5e7f4c` | `#7aa269` | `#7da76b` | Sage fill for primary buttons and chip-primary (with white text), and sage text on primary-tint. White on it is 3.7:1 in Light and under 3:1 in Plum Dusk and Night Garden, so button labels rely on their 800 weight; primary-dark on primary-tint is 3.2:1 in Light. Below WCAG AA for small text: flagged, kept exact. |
| `primary-tint` | `#eaf1e3` | `#dee6cf` | `#e3e9d1` | `rgba(157, 191, 142, 0.16)` | `rgba(168, 203, 150, 0.16)` | Sage wash: selected chips, success alerts, hover on ghost buttons, the current stop card. |
| `lavender` | `#b4a6d4` | `#b4a6d4` | `#b4a6d4` | `#cdb4de` | `#c9b7de` | Third voice: "THE" in the wordmark, flight banners, secondary accents. |
| `lavender-dark` | `#7e6fa8` | `#7e6fa8` | `#7e6fa8` | `#cdb4de` | `#c9b7de` | Lavender text, e.g. chip-lavender and flight banners. 4.4:1 on surface and 3.7:1 on lavender-tint in Light: AA only for large or bold text. |
| `lavender-tint` | `#ece7f4` | `#ece7f4` | `#ece7f4` | `#3a2d3a` | `#3a2f42` | Lavender wash behind lavender text (flight items, chip-lavender). |
| `accent` | `#f2c48a` | `#f2c48a` | `#f2c48a` | `#f2c48a` | `#efc98d` | Gold. Accent button fill (with text on it), reminder and outside-dates banners' edge. |
| `accent-dark` | `#b97f35` | `#b97f35` | `#b97f35` | `#eab877` | `#e9be77` | Gold text on accent-tint: reminders, "Outside trip dates" tags. 3.0:1 on accent-tint in every light and medium theme: below AA for small text, flagged. |
| `accent-tint` | `#fbeed9` | `#fbeed9` | `#fbeed9` | `#3c2f1e` | `#41371f` | Gold wash: reminder banners (recovery email, confirm email), outside-dates notices and tags. |
| `highlight` | `#e8b4b8` | `#e8b4b8` | `#e8b4b8` | `#e8b4b8` | `#f0b7c6` | Pink: the fourth tag hue (stay banners, avatars). |
| `highlight-dk` | `#b96a76` | `#b96a76` | `#b96a76` | `#ecaab0` | `#f0b7c6` | Pink text on highlight-tint (chip-highlight). 3.4:1: AA only for large or bold text. |
| `highlight-tint` | `#f9eced` | `#f9eced` | `#f9eced` | `#3e2a2d` | `#4a3040` | Pink wash behind highlight-dk. |
| `danger` | `#c0564a` | `#c0564a` | `#c0564a` | `#e68b80` | `#e88a80` | Errors, destructive actions, invalid field borders, field-error text. 4.7:1 on surface in Light; 3.7:1 on danger-tint. |
| `danger-tint` | `#f7e4e1` | `#f7e4e1` | `#f7e4e1` | `#3e2622` | `#402626` | Wash behind danger buttons and the invalid-field focus ring. |

### Type

Families: `sans` = 'Nunito', system-ui, sans-serif; `display` = 'Caprasimo', 'Nunito', serif.

| Style | Family | Size | Weight | Line height | Use |
|---|---|---|---|---|---|
| `hero-number` | display | 3.4rem | 400 | 1 | The Home hero countdown. Caprasimo only. |
| `wordmark` | display | 1.15rem | 400 | 1 | "itinerists" in the header lockup. |
| `h1` | sans | 1.8rem | 800 | normal | Page titles on the auth and onboarding screens. |
| `h2` | sans | 1.4rem | 700 | normal | Page headers inside the app. |
| `h3` | sans | 1.1rem | 700 | normal | Section titles within a page. |
| `body` | sans | 16px | 400 | 1.6 | Running text and paragraphs. |
| `field` | sans | 16px | 400 | normal | Every input, select and textarea. Never smaller: iOS zooms the page in on a field under 16px. |
| `button` | sans | 0.94rem | 800 | normal | Buttons. |
| `button-sm` | sans | 0.82rem | 800 | normal | Small buttons inside cards and banners. |
| `hero-kicker` | sans | 0.9rem | 800 | normal | The line above the hero countdown. |
| `label` | sans | 0.85rem | 700 | normal | Form labels, in text-muted. |
| `error` | sans | 0.8rem | 400 | normal | Field errors, in danger, under the field. |
| `chip` | sans | 0.78rem | 800 | normal | Chips and tags. |

### Spacing

The code has no spacing variables; these are the steps it actually uses (counted across every stylesheet, Oct 2, 2026). Keep to them.

| Token | Value | Use |
|---|---|---|
| `space-1` | `0.25rem` | Hairline gaps: icon to text inside a chip. |
| `space-2` | `0.5rem` | The most used step: gaps between chips and stop cards, small paddings. |
| `space-3` | `0.75rem` | Gaps between form fields in a row and between cards in a grid. |
| `space-4` | `1rem` | Card padding and gaps between sections. |
| `space-6` | `1.5rem` | Page side padding on desktop; space above a page title. |
| `space-8` | `2rem` | Page padding on wide screens. |

### Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | `8px` | Banners, small panels, the reminder nudges. |
| `radius` | `16px` | Cards, inputs, stop cards, the hero. |
| `radius-lg` | `24px` | Large sheets and the hero card on wide screens. |
| `radius-pill` | `999px` | Buttons, chips, scope tabs, badges: always fully round. |

### Shadow (Light; dark themes use black at 0.40–0.52)

| Token | Value | Use |
|---|---|---|
| `shadow` | `0 2px 12px rgba(139, 175, 124, 0.18)` | Resting cards. Sage-tinted in Light. |
| `shadow-md` | `0 4px 24px rgba(139, 175, 124, 0.22)` | Raised things: stop cards over the hero, dropdowns, sheets. |

### Layout

| Token | Value | Use |
|---|---|---|
| `header-h` | `60px` | Height of the fixed header. |
| `sidebar-w` | `240px` | Width of the desktop sidebar. |
| `tap-target` | `44px` | Minimum height of anything tappable (Apple's guideline): buttons are at least this tall. |

## Components

Global classes from `src/styles.scss` (and Home / app-shell styles). Each lists what the consumer provides.

### Button

Pill-shaped buttons for every action, at least 44px tall, labels in weight 800.

- **Variants:** `btn-primary` (one per view: the main action, `primary-dark` fill, white text), `btn-accent` (a gold call-out such as "Add email"), `btn-ghost` (secondary: sage outline and text), `btn-danger` (destructive: `danger` on `danger-tint`). Add `btn-sm` inside cards and banners.
- **The consumer provides** the label (sentence case, a verb first: "Add flight", "Send link") and the click handler. Optional leading icon from the line set at 15 to 16px.
- **Busy:** disable the button and keep a busy label with `btn-spinner` ("Signing in…", "Preparing…") until the next screen or result is on screen.
- Don't: two primary buttons side by side; all-caps labels; buttons shorter than 44px.
- Contrast: white on `primary-dark` is 3.7:1 in Light (under 3:1 in the dark themes); the 800 weight carries it. Flagged in the token.

### Chip

Small pills for filters, categories and tags.

- **Variants:** default (neutral: `surface`, `border`, `text-muted`), `chip-primary` (selected), `chip-accent`, `chip-lavender`, `chip-highlight` (category tags in the hue's `-dark` on its `-tint`), `chip-muted` (inactive or archived).
- **The consumer provides** a one- or two-word label. Day chips on the Itinerary use the trip's day ("Day 2") or a date ("Jul 27") when outside the trip.
- Contrast: the tinted variants are 3.0 to 3.7:1, so keep labels short and in weight 800.

### Card

The basic container: `surface`, `radius`, `shadow`, 1rem padding.

- **Use for** glance items, list rows that open something, and any grouped content on a page.
- **The consumer provides** the content; keep one idea per card: a title line in `text` 700–800 and a meta line in `text-muted`.
- Times inside always carry their zone code ("11:30 AM CDT").

### ScopeTabs

Two-way switch between your view and everyone's, used on Itinerary, Flights and similar pages.

- **The consumer provides** the two labels and which is active (`.active`). "My Trip" shows what is for the signed-in person; "All" shows the whole group's.
- Keep to two options; more choices are chips.

### TabBar

The phone's bottom navigation: Home plus the person's top three pages and More.

- **It never moves** and sits in flow above the home indicator (safe-area padding); on desktop the same list is a sidebar.
- **The consumer provides** the order (each person reorders pages in More; the top three join the bar). Icons from the line set at 23px; labels one word.
- The active tab is `primary-dark`; the rest `text-muted`.

### FormField

Label, control and error, stacked; `form-row` puts fields side by side and wraps on a phone.

- **Every control is 16px or larger.** Smaller fields make iPhones zoom the page in, and the zoom sticks.
- **The consumer provides** a short `label` (sentence case), a placeholder that shows an example ("e.g. ORD"), and validation that says the fix in `field-error` under the field; add `.invalid` to the control.
- Dates use the native picker. A start date moves an empty or earlier end date to it and opens the end picker.
- Required fields are not starred; optional ones say "(optional)" in the label.

### PeoplePicker

Who something is for: "All" or a set of trip members, as toggle pills with each person's emoji.

- **The consumer provides** the members (emoji + name) and the selected set; "All" selects everyone.
- Used for itinerary items, stays, expenses ("split between") and packing suggestions.

### ReminderNudge

A gentle reminder at the top of a page: `accent-tint` with a gold edge, one action and a ✕.

- **Never blocks anything.** The ✕ hides it for the visit; it returns until the thing is done.
- **The consumer provides** one bold lead ("Confirm your email"), one sentence of why, and one action.
- Used for: add a recovery email, confirm your email, items outside the trip's dates.

### Banner

A full-width notice for app state such as working offline: `accent` ground, one optional action at the end.

- **The consumer provides** one sentence and, optionally, one action ("Retry").
- Its text and button colours (#7a6200 on `accent`, button `accent-dark`) are fixed in the stylesheet, not tokens.

### EmptyState

What a page shows when it has nothing yet: a large line icon, one sentence, the next step.

- **The consumer provides** the icon (from the line set, in `primary`), a sentence that says what will appear here, and the action that adds the first one.
- With no trip at all, every page offers "Set up a trip" and "I have an invite code" instead.

### Loading

The page loader: a sage spinner in the middle of the screen, standing in for the whole page.

- **Shows only after 300ms** (fast loads never flash) and stays at least 300ms; on Home right after sign-in it shows at once.
- In the app it is fixed to the screen's centre, never covers the header or tab bar, and never blocks a tap on them.
- **The consumer provides** an optional label; the default is "Loading…". Render it in place of the page, not on top of it.

### TripHero

Home's countdown card and, for a trip with several stops, the stop cards that ride up onto it.

- **The line follows the trip:** "Ready for {first stop}? ✨" before, "Enjoy {current stop} ✨" during, "Back from {place} ✨" after. The number is the countdown in `hero-number` (Caprasimo).
- **Stop cards** are as wide as their name and dates and swipe sideways; the strip opens on the current stop and fades on the side with more.
- **The current stop is a live dot** in the pin's place (`primary`, gently pulsing; the pulse stops under reduced motion), plus the green outline and tint. Never a "Now" word that pushes text out of line; screen readers still hear "Now".
- **The consumer provides** the trip (dates, stops with their zones), the members (emoji + colour) and today's date in the trip's zone.

- **Known issue (dark themes):** the current stop card's `primary-tint` is see-through, so where it overlaps the green hero its `primary-dark` name is hard to read in Plum Dusk and Night Garden. Shown as the app has it; fix in the app before relying on it.

## Assets

- **stamp-mark.svg**: the passport-stamp mark from the header lockup, drawn in `primary-dark` (#6a8f5e). Its ring lettering is set in Nunito.
- **app-badge.svg**: the browser and home-screen badge: cream mark on a `primary-dark` rounded square.
- **app-icon-512.png**: the installed app icon.
- **launch-lockup.png**: the iPhone launch screen: stamp mark over "THE itinerists" on `bg`.
In the app, the lockup is the stamp mark followed by "THE" in Nunito 800 small caps (`lavender-dark`) and "itinerists" in Caprasimo (`text`).

Icons: The app's own line icons, one per name, copied from the icon component: 24×24 grid, 2.2px stroke, round caps and joins. In the app they draw in `currentColor`; these files are drawn in `text` (#3a3328) because an `<img>` can't inherit colour. Use them at 15 to 24px. Names: see `ICON_PATHS` in `src/app/shared/icon/icon.component.ts`.
