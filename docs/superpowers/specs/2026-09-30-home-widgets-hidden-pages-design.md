# Home widgets + hidden pages — design

**Date:** 2026-09-30
**Status:** approved (conversation, 2026-09-30)

## Goal

A member can hide any optional page from their menu on a trip, and Home stops
surfacing that page everywhere: no widget, no pin, no quick-access card.
Every optional page (except Map) gets a Home widget so Home stays useful as
pages come and go, and the remaining widgets close up the gap.

## What changes

### 1. Customize Menu (Trip Settings)

Hideable pages go from six to nine:

| key              | label          |
|------------------|----------------|
| `flights`        | Flights        |
| `accommodations` | Stays          |
| `transportation` | Transportation |
| `finance`        | Finance        |
| `expenses`       | My Expenses    |
| `recs`           | Recs           |
| `packing`        | Packing        |
| `outfits`        | Outfits        |
| `map`            | Map            |

Fixed (never hideable): Home, Itinerary, My Trips, Trip Settings, Profile.

Copy: "Hide pages you don't use. Home and Itinerary always stay. This only
affects your menu and Home on this trip."

Storage is unchanged: `members/{uid}.hiddenPages: string[]` per trip, read via
`TripService.hiddenPages()`. Keys are the route path without the slash.

### 2. Home "At a glance" keeps four slots; backups fill in (layouts A and More)

**Correction 2026-09-30 (after first deploy):** the new cards are *backups*,
not additions. Out of the box Home shows exactly what it showed before:
Itinerary, Finance, Packing, Outfits (`DEFAULT_WIDGETS`, four slots). When a
default page is hidden on the active trip, its slot is backfilled by the first
visible backup page in the user's personal nav order (Flights, Stays,
Transportation, My Expenses, Recs). Hiding a backup page changes nothing
while all four defaults are shown. If there is nothing left to fill with, the
grid shrinks below four.

Layout: slots 0 and 1 are full-width rows, slots 2 and 3 sit side by side; a
lone third card stretches to full width. Every card is one `GlanceCard` view
model (icon, tone, title, sub-lines) rendered by a single template.

| page           | card content (live)                                        | empty state                    |
|----------------|------------------------------------------------------------|--------------------------------|
| Itinerary      | "First up: {activity}" · when · location (exists)          | "Plan your itinerary"          |
| Finance        | You owe / you're owed / all settled + tracked total (exists)| "Shared expenses"              |
| Packing        | "n/m packed" + up to 3 unpacked items (exists)             | "Packing list"                 |
| Outfits        | weather for the glance leg, condition (exists)             | "Forecast nearer the trip"     |
| Flights        | next flight for me: "Departs in 3d · SAV → BER 10:40"      | "Add your flights"             |
| Stays          | tonight's stay, else next check-in: "Check in Fri · Hotel" | "Add where you're staying"     |
| Transportation | next pick-up or drop-off: "Pick-up Sat 10:00 · Hertz"      | "Add a rental car"             |
| My Expenses    | my private total this trip: "$412 spent"                   | "Track your own spending"      |
| Recs           | "8 recs · latest: Café Einstein"                           | "Save a rec"                   |
| Map            | **no card.** The existing day-map card on the More layout stays as is and is hidden when Map is hidden. | — |

Data sources (all already loaded app-wide): `FlightsService.flights` +
`flightMomentsForUid`, `StaysService.stays`, `DataService` rental cars,
`ExpensesService.expenses`, `RecsService.recs`. No new fetches.

### 3. Pins (layouts A and More)

- `pinnedTiles` skips pages hidden on the active trip.
- The pin editor does not list hidden pages.
- The saved `homePins` on the account are **not** modified. Pins follow the
  user across trips; hidden pages are per trip. Unhiding brings the tile back.

### 4. Quick Access grid (Simple layout)

Filtered by hidden pages. Fixed pages always show.

## Not changing

- Hidden pages remain reachable by URL (it is a menu preference, not a permission).
- No Firestore rule or model change.
- No changes to the day-map card, the countdown hero, or "Latest from the group".

## Testing

- `home.component.spec`: each new widget's live and empty state; hiding a page
  removes its card, pin tile, pin option and quick-access entry; Map hidden
  removes the day-map card; itinerary card always present.
- `trip-settings.component.spec`: nine toggles, toggling `finance`/`map`/
  `transportation` persists via `setHiddenPages`.
- Existing shell nav filtering tests stay green.
