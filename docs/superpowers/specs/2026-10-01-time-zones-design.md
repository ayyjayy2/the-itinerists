# Time zones: trip times in their own zones

**Date:** 2026-10-01 · **Status:** building · **Asked by:** Alayna, after the Lisbon test
trip showed "Land at Lisbon Airport 2:30 PM" as First up at 5:35 PM Lisbon time.

## The problem

Every time in the app is a wall-clock time somewhere else: itinerary, stays and transport
at the destination; flights at their airports. The app compared all of them with the
phone's clock as if they were local. So Home's First up, the countdown and "today" drift by
the zone difference, and flights used a 24-airport table of US offsets with daylight time
hard-coded (LIS and LHR were treated as New York).

## Rules

1. **A destination has a time zone.** Each trip leg carries `timeZone` (IANA). It is set
   when the owner saves the trip, by geocoding the destination (Nominatim, as the map does)
   and looking the coordinates up in `tz-lookup`. Existing trips are backfilled once by
   `scripts/backfill-trip-zones.js`. A leg without a zone behaves as before (phone zone).
2. **A flight time belongs to its airport.** Departure is read in the departure airport's
   zone, arrival in the arrival airport's zone, for arrivals and the return flight alike.
   Airport zones come from `public/data/airports.json` (IATA → zone, 5,500 airports from
   OpenFlights plus overrides such as BER), loaded lazily by `AirportZoneService`. An unknown
   code falls back to the trip's zone for the destination end and the phone's zone otherwise.
3. **Comparisons with "now" use the right zone.** `utils/zones.ts` (Intl only, no library):
   `wallToUtcMs(date, h, min, zone)`, `todayISOInZone`, `utcOffsetMinutes`, `zoneAbbr`.
   First up, the hero countdown, "now" on a leg, the itinerary's today, recs' active leg and
   the flight countdown all go through it.
4. **Say which zone when it is not the phone's.** Home's First up line and the flight card
   times show the abbreviation (WEST, CEST, EDT) only when that zone's offset differs from
   the phone's at that moment, so at home nothing changes and abroad it is explicit.
5. **Flights get a status**: *Boarding soon* from two hours before departure, *In flight*
   from departure to arrival, *Landed* for six hours after. All in the airports' zones.

## Out of scope here

Map geocoding sends the trip's destination and country as context and the bad cache
entries are redone: separate PR. Reminders and push: the notifications spec.

## Tests

`utils/zones.spec.ts` (offsets, wall→UTC across a DST edge, today in a zone, abbreviations),
`utils/first-up.spec.ts` extended with zoned cutoffs and the JFK→LIS case, flight status
helper spec.
