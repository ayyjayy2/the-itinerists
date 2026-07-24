import { TripDestination, TripDoc } from '../models/trip.models';

/** The flat "primary + overall" summary fields derived from a trip's legs. */
export interface TripSummary {
  destination: string;
  destinationPlaceId?: string;
  destinationCoords?: { lat: number; lng: number };
  startDate: string;
  endDate: string;
  currency: string;
}

/**
 * Compute the flat mirror fields for a TripDoc from its per-leg destinations:
 * the primary (first) leg supplies destination/currency/coords, and the date
 * range spans the earliest start to the latest end across all legs.
 */
export function tripSummary(destinations: TripDestination[]): TripSummary {
  const primary = destinations[0];
  const summary: TripSummary = {
    destination: primary.destination,
    startDate: destinations.reduce((min, d) => (d.startDate < min ? d.startDate : min), primary.startDate),
    endDate:   destinations.reduce((max, d) => (d.endDate > max ? d.endDate : max), primary.endDate),
    currency: primary.currency,
  };
  if (primary.destinationPlaceId) summary.destinationPlaceId = primary.destinationPlaceId;
  if (primary.destinationCoords)  summary.destinationCoords  = primary.destinationCoords;
  return summary;
}

/**
 * The leg to feature on "current" glances (Home weather, map focus):
 *   1. the leg whose [startDate, endDate] contains `todayISO` (inclusive), else
 *   2. the next upcoming leg (earliest start after today), else
 *   3. the last leg (whole trip is in the past).
 * Assumes a non-empty array (use tripDestinations()).
 */
export function activeLeg(destinations: TripDestination[], todayISO: string): TripDestination {
  const current = destinations.find(d => d.startDate <= todayISO && todayISO <= d.endDate);
  if (current) return current;

  const upcoming = destinations
    .filter(d => d.startDate > todayISO)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (upcoming.length) return upcoming[0];

  // All legs are in the past — return the one that ended last.
  return destinations.reduce((latest, d) => (d.endDate > latest.endDate ? d : latest), destinations[0]);
}

/** A destination row from the edit form, carrying the leg it was loaded from. */
export interface DestinationEdit {
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  original?: TripDestination;   // the stored leg this row came from (if any)
}

/**
 * Build the destinations array from edit-form rows. Trims text and preserves a
 * leg's geocoded coords/placeId only when its destination text is unchanged from
 * the original — an edited destination drops its coords so the map re-geocodes.
 */
export function buildEditedDestinations(rows: DestinationEdit[]): TripDestination[] {
  return rows.map(r => {
    const destination = r.destination.trim();
    const leg: TripDestination = {
      destination,
      startDate: r.startDate,
      endDate: r.endDate,
      currency: r.currency,
    };
    if (r.original && r.original.destination.trim() === destination) {
      if (r.original.destinationCoords)  leg.destinationCoords  = r.original.destinationCoords;
      if (r.original.destinationPlaceId) leg.destinationPlaceId = r.original.destinationPlaceId;
    }
    return leg;
  });
}

/**
 * A trip's legs. Returns the stored `destinations` array when present, otherwise
 * derives a single leg from the flat fields (back-compat for pre-multi-destination
 * trips). Always returns at least one leg.
 */
export function tripDestinations(trip: TripDoc): TripDestination[] {
  if (trip.destinations && trip.destinations.length) return trip.destinations;
  const leg: TripDestination = {
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
  };
  if (trip.destinationPlaceId) leg.destinationPlaceId = trip.destinationPlaceId;
  if (trip.destinationCoords)  leg.destinationCoords  = trip.destinationCoords;
  return [leg];
}
