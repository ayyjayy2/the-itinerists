# Trip Settings — edit multiple destinations

**Date:** 2026-07-24
**Status:** Approved

## Goal
Let the Trip Settings → Details card edit a trip's destinations the same way the
create form does: a "Multiple destinations" toggle with per-leg cards (each with
its own dates + currency), add/remove, reusing `app-currency-select`. Extends the
multi-destination project ([[project_multi_destination]]) to editing existing trips.

Depends on Phase 1/2 (`TripDoc.destinations[]`, `tripDestinations()`,
`tripSummary()`, `app-currency-select`).

## Details card UX (mirrors create)
- Add the **"Multiple destinations"** toggle to the Details card.
- **Off (single):** destination · dates · currency. Swap the current plain
  `<select>` currency control for `app-currency-select` to match create.
- **On (multi):** a destination card per leg — destination · start · end ·
  `app-currency-select` · remove ×, plus **"+ Add another destination"**.
- **Prefill:** legs from `tripDestinations(trip)` (multi trips show all legs;
  legacy single trips get one leg derived from the flat fields).
- **Toggle initial state:** `destinations.length > 1`.
- **Toggle disabled while >1 leg:** cannot collapse a multi trip by toggling.
  To return to single, remove legs via × down to one; the toggle then unlocks.

## Save
`saveDetails()`:
- **Multi:** validate each leg (non-empty destination, valid dates end ≥ start,
  currency) with a message naming the offending card; build `destinations[]`;
  derive the flat mirror via `tripSummary(destinations)`; persist `destinations`
  **and** the mirrored `destination/startDate/endDate/currency`.
- **Single:** as today, plus write `destinations: [<the one leg>]` for a
  consistent stored shape.

### Coords preservation
When a leg's destination text is unchanged from the stored trip, keep its
existing `destinationCoords` / `destinationPlaceId` so the map keeps its
geocoded destination pins. When the destination text changed, drop coords (the
map re-geocodes on demand, as it already does).

## Service
`updateTrip`'s patch type gains `destinations` (and the existing
`destination/startDate/endDate/currency`). `undefined` fields are still filtered
out before the Firestore `updateDoc`.

## Testing
- **Unit (`test:ci`)**: the pure save-assembly logic — building `destinations[]`
  + `tripSummary` mirror from edit-form rows, and the coords-preservation rule
  (unchanged text keeps coords; changed text drops them). Extract a small pure
  helper so it's testable without the component.
- `ng build` clean.
- **Live**: open settings on a multi trip → legs prefilled, toggle locked on;
  edit a leg, add one, remove one; save; confirm Home legs strip + Map pins
  reflect the change. Then a single trip → toggle off, add a 2nd leg, save.

## Out of scope
- Finance per-destination currency (Phase 3).
- Re-ordering legs (add/remove/edit only).
