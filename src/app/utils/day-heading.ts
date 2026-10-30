import { TripDoc } from '../models/trip.models';
import { tripDestinations } from './trip-destinations';

// Newspaper style: short months stay whole, the rest take a period.
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const WEEKDAYS = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];

function parts(dateISO: string): { weekday: string; month: string; day: number } | null {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return null;
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { weekday: WEEKDAYS[weekday], month: MONTHS[m - 1], day: d };
}

/** A day's heading on the Itinerary and Outfits: "Thu., Nov. 12". */
export function dayHeadingDate(dateISO: string): string {
  const p = parts(dateISO);
  return p ? `${p.weekday}, ${p.month} ${p.day}` : '';
}

/** A day chip's label: "Nov. 12". */
export function dayChipDate(dateISO: string): string {
  const p = parts(dateISO);
  return p ? `${p.month} ${p.day}` : '';
}

/** "Chiang Mai, Thailand" → "Chiang Mai". */
function city(destination: string): string {
  return destination.split(',')[0].trim();
}

/**
 * The note under a day's date: the name you gave the day, else the city of
 * the trip stop it falls in ("Chiang Mai → Pai" on a day between two stops),
 * else nothing.
 */
export function dayNote(dateISO: string, trip: TripDoc | null | undefined, customLabel: string | undefined): string {
  const named = customLabel?.trim();
  if (named) return named;
  if (!trip) return '';
  const cities = tripDestinations(trip)
    .filter(leg => leg.startDate && leg.endDate && leg.startDate <= dateISO && dateISO <= leg.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(leg => city(leg.destination ?? ''))
    .filter(Boolean);
  return [...new Set(cities)].join(' → ');
}
