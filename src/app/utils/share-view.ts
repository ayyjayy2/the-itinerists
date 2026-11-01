import { AccommodationDoc, FlightDoc, ItineraryItemDoc, TripDoc, TripMember } from '../models/trip.models';
import { stopDateRange } from './stop-dates';
import { normalizeTime } from './time-format';
import { parseTimeString } from './first-up';
import { activeLeg, tripDestinations } from './trip-destinations';
import { planZoneLabel, zoneLabelAt } from './time-zone-label';

/**
 * The read-only page a trip's members can share with people at home (#611),
 * at /view#<token> (after the #, so the secret never reaches a server or the page log). It holds only what the owner chose for it, already
 * worded for display: the trip's dates and places, the day-by-day plan,
 * flights, where people stay (the town, never the address) and who's going
 * (first names). Never notes, booking references, links, money, packing or
 * outfits. A member's device rebuilds it when the plan changes.
 */
export interface ShareView {
  v: 1;
  tripName: string;
  dates: string;                 // "Nov 12 – 19"
  places: string[];              // each stop: "Chiang Mai, Thailand"
  people: { name: string; avatarEmoji: string; color: string; avatarLetterColor: string }[];
  days: { date: string; label: string; items: { time: string; title: string; place: string }[] }[];
  flights: { who: string; flight: string; route: string; departs: string; arrives: string }[];
  stays: { name: string; where: string; dates: string }[];
}

const dayLabel = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortDay = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** Minutes after midnight for "3:50 PM"; times that don't parse sort last. */
const minutes = (t: string) => { const p = parseTimeString(t); return p ? p.h * 60 + p.min : 24 * 60; };
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
const town = (destination: string) => destination.split(',')[0]?.trim() ?? '';

/** "7:00 PM – 9:00 PM ICT", "7:00 PM ICT", or '' for a plan with no time. */
function timeText(time: string, end: string | undefined, zone: string): string {
  const t = normalizeTime(time);
  if (!t) return '';
  const e = normalizeTime(end);
  return [e ? `${t} – ${e}` : t, zone].filter(Boolean).join(' ');
}

export function buildShareView(input: {
  trip: TripDoc;
  members: readonly TripMember[];
  itinerary: readonly ItineraryItemDoc[];
  flights: readonly FlightDoc[];
  stays: readonly AccommodationDoc[];
  airportZone: (code: string) => string | undefined;
}): ShareView {
  const { trip, members, itinerary, flights, stays, airportZone } = input;
  const legs = tripDestinations(trip);
  const nameOf = new Map(members.map(m => [m.uid, firstName(m.displayName)]));

  const byDate = new Map<string, ItineraryItemDoc[]>();
  for (const item of itinerary) {
    if (!item.date) continue;
    (byDate.get(item.date) ?? byDate.set(item.date, []).get(item.date)!).push(item);
  }
  const days = [...byDate.keys()].sort().map(date => ({
    date,
    label: dayLabel(date),
    items: byDate.get(date)!
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(i => ({
        time: timeText(i.time, i.endTime, i.time ? planZoneLabel(i, i.time, trip, airportZone) : ''),
        title: i.activity,
        place: i.location ?? '',
      })),
  }));

  const at = (date: string, time: string, code: string) =>
    [shortDay(date), normalizeTime(time), zoneLabelAt(airportZone(code), date, time)].filter(Boolean).join(', ').replace(/, (?=[A-Z+-]{2,5}$)/, ' ');

  return {
    v: 1,
    tripName: trip.name,
    dates: stopDateRange(trip.startDate, trip.endDate),
    places: legs.map(l => l.destination).filter(Boolean),
    people: members.map(m => ({
      name: firstName(m.displayName), avatarEmoji: m.avatarEmoji, color: m.color, avatarLetterColor: m.avatarLetterColor ?? '',
    })),
    days,
    flights: [...flights]
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate) || minutes(a.departureTime) - minutes(b.departureTime))
      .map(f => ({
        who: nameOf.get(f.uid) ?? '',
        flight: [f.airline, f.flightNumber].filter(Boolean).join(' '),
        route: `${f.from} → ${f.to}`,
        departs: at(f.departureDate, f.departureTime, f.from),
        arrives: at(f.arrivalDate, f.arrivalTime, f.to),
      })),
    stays: [...stays]
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .map(s => ({
        name: s.name,
        where: s.checkIn && legs.length ? town(activeLeg(legs, s.checkIn).destination) : '',
        dates: stopDateRange(s.checkIn, s.checkOut),
      })),
  };
}

/** A share link's secret: 22 random letters and digits (about 130 bits). */
export function newShareToken(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return [...random(22)].map(b => chars[b % chars.length]).join('');
}
