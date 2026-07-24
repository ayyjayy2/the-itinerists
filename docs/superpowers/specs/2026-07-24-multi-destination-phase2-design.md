# Multi-destination trips — Phase 2 (read consumers)

**Date:** 2026-07-24
**Status:** Approved

## Goal
Surface the per-leg destinations captured in Phase 1 on the three screens that
display trip location/weather: **Home**, **Weather**, **Map**. Read-only — no
model or create-page changes. Single-destination trips must look unchanged.

Depends on Phase 1 (`TripDoc.destinations[]`, `tripDestinations()`,
`tripSummary()`; PR #104).

## New pure helper (`utils/trip-destinations.ts`)
```ts
activeLeg(destinations: TripDestination[], todayISO: string): TripDestination
```
Picks the leg to feature on "current" glances:
1. the leg whose `[startDate, endDate]` contains `todayISO`, else
2. the next upcoming leg (earliest `startDate` > today), else
3. the last leg (trip fully in the past).
Always returns a leg (input is guaranteed non-empty via `tripDestinations`).
Unit-tested for all three branches + single-leg passthrough.

## Home — primary hero + legs strip
- Hero unchanged (primary destination + overall date range). Single-destination
  Home is visually identical to today.
- When `tripDestinations(trip).length > 1`, render a compact **legs strip**
  below the hero: one row/chip per destination with its name + formatted date
  range; the `activeLeg` is subtly highlighted.
- **Weather glance** uses `activeLeg` instead of the primary: it loads/show the
  forecast for the current-or-next leg, labeled with that leg's short name.

## Weather page — per-leg
- Multi-destination: one forecast **per destination, scoped to that leg's
  dates**; the page groups results by destination (heading = leg name + range).
- Single-destination: unchanged (one forecast, full range).
- `WeatherService` gains the ability to hold forecasts for multiple
  destination+range keys. The cache is already keyed by `destination|start|end`
  (`loadedFor`/cache map), so this becomes: load N legs, expose a
  `forecastFor(destination, start, end)` read. Existing single-destination
  callers keep working via the same keys.

## Map — a pin per destination + fit all
- Geocode each leg's destination (reusing the existing geocode + geocache path)
  and drop a **distinct destination marker** per leg (visually separate from
  itinerary/stay/flight/pin markers — a labeled leg pin).
- On load, **auto-fit** the map bounds to include all destination pins (falls
  back to current single-center behavior when only one).
- Address-form geocoding keeps using a trip destination as the disambiguation
  hint, now sourced from the leg list (primary leg) — behavior unchanged.

## Testing
- **Unit (`test:ci`)**: `activeLeg` (contains-today / next-upcoming / all-past /
  single-leg). Pure and fully covered.
- **Build**: `ng build` clean.
- **Live (browser)**: create a 2-leg trip, verify Home legs strip + glance leg
  label, Weather per-leg grouping, Map shows a pin per destination and fits all.

## Out of scope
- Finance per-destination currency (Phase 3).
- Editing destinations after creation.
- Per-leg itinerary/packing scoping (trip-wide, as today).
