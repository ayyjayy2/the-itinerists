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
