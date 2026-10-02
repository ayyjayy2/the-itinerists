import { TripDestination } from '../models/trip.models';
import { legIsCurrent } from './trip-destinations';

const short = (place: string | undefined) => (place || '').split(',')[0].trim();

/**
 * The hero's opening line, following the trip as it happens:
 *   before   "Ready for Panama?"     (the first stop)
 *   during   "Enjoy Costa Rica"      (the stop you're in; on a travel day that
 *                                     falls inside two stops, the one you're heading to)
 *   after    "Back from Panama"
 * `todayISO` is today where the trip is.
 */
export function heroLine(
  trip: { destination?: string; name?: string; startDate?: string; endDate?: string } | null | undefined,
  legs: readonly TripDestination[],
  todayISO: string,
): string {
  if (!trip) return '';
  const first = short(legs[0]?.destination) || short(trip.destination) || short(trip.name);
  const { startDate, endDate } = trip;
  if (!startDate || !endDate || todayISO < startDate) return `Ready for ${first}? ✨`;
  if (todayISO > endDate) return `Back from ${short(trip.destination) || first} ✨`;
  const here = legs.filter(l => legIsCurrent(l, todayISO)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  return `Enjoy ${short(here?.destination) || first} ✨`;
}
