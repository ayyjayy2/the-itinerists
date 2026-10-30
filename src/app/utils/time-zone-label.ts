import { TripDoc } from '../models/trip.models';
import { activeLeg, tripDestinations } from './trip-destinations';
import { parseTimeString } from './first-up';
import { airportCodeIn } from './flight-events';
import { wallToUtcMs, zoneAbbr } from './zones';

/**
 * The zone code to write after a plan's time ("WEST", "CST"): the zone of the
 * trip stop the plan's date falls in, as of the plan's own moment, so a
 * November plan says CST even while it is CDT today. A plan with no time is
 * labelled by its day. Empty when the trip has no zone yet.
 */
export function zoneLabelOn(trip: TripDoc | null | undefined, dateISO: string, time?: string): string {
  if (!trip) return '';
  const legs = tripDestinations(trip);
  const zone = (legs.length ? activeLeg(legs, dateISO).timeZone : undefined) ?? trip.timeZone;
  return zoneLabelAt(zone, dateISO, time);
}

/** A zone's code at a day and time (noon when there's no time); empty without a zone. */
export function zoneLabelAt(zone: string | undefined, dateISO: string, time?: string): string {
  if (!zone) return '';
  const t = parseTimeString(time) ?? { h: 12, min: 0 };
  return zoneAbbr(zone, wallToUtcMs(dateISO, t.h, t.min, zone));
}

/**
 * A typed plan's zone code: the airport's when it is a flight plan that names
 * one ("Depart Chicago O'Hare" at ORD says CST on a Bangkok trip), else the
 * trip stop's on that day.
 */
export function planZoneLabel(
  plan: { date: string; activity: string; category?: string; location?: string },
  time: string | undefined,
  trip: TripDoc | null | undefined,
  airportZone: (code: string) => string | undefined,
): string {
  const code = airportCodeIn(plan);
  const zone = code ? airportZone(code) : undefined;
  return zone ? zoneLabelAt(zone, plan.date, time) : zoneLabelOn(trip, plan.date, time);
}
