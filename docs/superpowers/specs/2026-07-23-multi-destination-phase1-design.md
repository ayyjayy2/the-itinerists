# Multi-destination trips — Phase 1 (foundation + create page)

**Date:** 2026-07-23
**Status:** Approved

## Goal (full project)
Let a trip have multiple destinations, each with its own dates and currency, flowing through the whole app. Delivered in phases:

1. **Foundation (this spec)** — data model, back-compat, and the create-page UI.
2. **Read consumers** — Home (all legs), Map (pin per destination), Weather (per-destination forecasts).
3. **Finance** — per-destination currency: per-currency subtotals **and** an approximate converted grand total (live rates).

Phase 1 must not break any existing screen.

## Decisions (from brainstorming)
- Each destination has **manually-set** start/end dates; they may overlap or leave gaps. The trip's overall range is **derived** (earliest start → latest end).
- Finance (Phase 3) shows **both** per-currency subtotals and an approximate converted total.
- Single-destination stays the default; multi-destination is opt-in via a toggle.

## Data model (`trip.models.ts`)
```ts
export interface TripDestination {
  destination: string;
  destinationPlaceId?: string;
  destinationCoords?: { lat: number; lng: number };
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  currency: string;    // ISO code
}
```
`TripDoc` gains `destinations?: TripDestination[]`. The existing flat fields
(`destination`, `startDate`, `endDate`, `currency`, `destinationCoords`,
`destinationPlaceId`) **remain**, mirroring the **primary** (first) destination
and the **overall** date range.

### Back-compat (no migration)
- Every new trip writes `destinations[]` **and** the flat mirror fields.
- A read helper `tripDestinations(trip): TripDestination[]` returns
  `trip.destinations` when present, else a one-element array derived from the
  flat fields. Existing trips (no `destinations`) read as single-destination.
- A pure helper `tripSummary(destinations): { destination, startDate, endDate, currency, destinationCoords?, destinationPlaceId? }` computes the flat mirror:
  primary = `destinations[0]`; `startDate` = min; `endDate` = max.
- All existing screens keep reading the flat fields in Phase 1 → zero breakage.

## Service (`trip.service.ts`)
`CreateTripInput` gains an optional `destinations?: TripDestination[]`.
`createTrip`:
- If `destinations` provided (length ≥ 1): store the array + derive the flat
  mirror via `tripSummary`.
- Else (single-destination form): behave exactly as today, and also store
  `destinations: [<the single destination>]` for forward-consistency.

No Firestore rules change — `destinations` is just another field on the trip
doc, already writable by the creator/members.

## Create page (`create-trip.component`)
- New **"Multiple destinations"** toggle, default **off**.
- **Off:** current single form unchanged (destination · dates · currency).
- **On:** a stacked list of **destination cards**, each with: destination text,
  start date, end date, **its own currency picker**, and a remove **×** (hidden
  when only one card). A **"+ Add another destination"** button appends a card.
- Trip **name** stays a single top-level field.
- **Validation:** each destination needs a non-empty destination and valid dates
  (end ≥ start) and a currency. Submit is blocked with a specific message
  naming the first offending card.
- **Submit:** assemble `destinations[]` (in card order) and call `createTrip`.

### Currency picker
Today's picker is bound to one `currency` field + component-level signals. For
multiple cards it becomes per-card. Implementation options (decided in the
plan): extract a small reusable currency-select, or key the open/query state by
card index. Behaviour (searchable dropdown) is unchanged.

## Testing
- **Unit (TDD, `test:ci`)** for the pure helpers: `tripSummary` (primary +
  min/max range across legs) and `tripDestinations` (array passthrough vs
  derived-from-flat fallback), plus create-form validation logic.
- `ng build` clean.

## Out of scope (Phase 1)
- Home/Map/Weather/Finance reading the array (Phases 2–3).
- Per-destination geocoding on the create page (coords stay optional/on-demand,
  as today).
- Editing destinations after creation (future).
