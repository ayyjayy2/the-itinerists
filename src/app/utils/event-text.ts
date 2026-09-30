/**
 * Wording and audience for trip events (the bell / Updates feed and, later,
 * push). Pure functions: the phone knows the before and after of every edit,
 * so it composes the line once and every delivery shows the same words.
 *
 * Every summary starts after the actor's name: "Maya " + summary.
 */
import {
  ItineraryItemDoc, FlightDoc, AccommodationDoc, RentalCar, FinanceEntryDoc, RecDoc, MapPin, TripDoc,
} from '../models/trip.models';
import { normalizeTime } from './time-format';

export type AudienceSpec = 'all' | string[];
export interface EventText { summary: string; audience: AudienceSpec; }
export interface MemberLike { uid: string; displayName: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 'All' / empty → everyone; "Maya, Sam" → uids of matching members (case-insensitive). */
export function resolveAudience(forWho: string | undefined, members: readonly MemberLike[]): AudienceSpec {
  const raw = (forWho ?? '').trim();
  if (!raw || raw.toLowerCase() === 'all') return 'all';
  const wanted = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const uids: string[] = [];
  for (const m of members) {
    if (wanted.includes(m.displayName.trim().toLowerCase()) && !uids.includes(m.uid)) uids.push(m.uid);
  }
  return uids;
}

/** 'Fri Oct 3' */
export function fmtDay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00');
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${wd} ${md}`;
}

/** 'Oct 3 – 5' inside one month, else 'Sep 30 – Oct 5'. */
export function fmtRange(a: string, b: string): string {
  const da = new Date(a + 'T00:00'), db = new Date(b + 'T00:00');
  const md = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) return `${md(da)} – ${db.getDate()}`;
  return `${md(da)} – ${md(db)}`;
}

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const time = (t: string | undefined) => (t ? normalizeTime(t) : '');
const same = (a: unknown, b: unknown) => (a ?? '') === (b ?? '');

/** Labels of the watched fields that differ between before and after. */
function changedFields<T>(before: T, after: T, watch: Array<[keyof T, string]>): string[] {
  return watch.filter(([k]) => !same(before[k], after[k])).map(([, label]) => label);
}

// ── Itinerary ─────────────────────────────────────────────────────────────────

function dayRef(item: ItineraryItemDoc, dayNumber: number | null): string {
  return dayNumber ? `Day ${dayNumber}, ${fmtDay(item.date)}` : fmtDay(item.date);
}

export function itineraryAdded(item: ItineraryItemDoc, dayNumber: number | null, members: readonly MemberLike[]): EventText {
  const when = time(item.time);
  const where = dayNumber ? `to ${dayRef(item, dayNumber)}` : `on ${fmtDay(item.date)}`;
  return {
    summary: `added ${item.activity} ${where}${when ? ` at ${when}` : ''}`,
    audience: resolveAudience(item.forWho, members),
  };
}

export function itineraryChanged(before: ItineraryItemDoc, after: ItineraryItemDoc, members: readonly MemberLike[]): EventText | null {
  const changed = changedFields(before, after, [
    ['time', 'time'], ['date', 'date'], ['activity', 'name'], ['location', 'location'], ['endTime', 'end time'], ['notes', 'notes'],
  ]);
  if (!changed.length) return null;
  const audience = resolveAudience(after.forWho, members);
  const name = after.activity;
  let summary: string;
  if (changed.length === 1) {
    switch (changed[0]) {
      case 'time': {
        const was = time(before.time);
        summary = `changed ${name} to ${time(after.time) || 'no set time'}${was ? ` (was ${was})` : ''}`;
        break;
      }
      case 'date':     summary = `moved ${name} to ${fmtDay(after.date)}`; break;
      case 'name':     summary = `renamed ${before.activity} to ${after.activity}`; break;
      case 'location': summary = `changed the location of ${name} to ${after.location || 'none'}`; break;
      default:         summary = `updated ${name} (${changed[0]})`;
    }
  } else {
    summary = `updated ${name} (${changed.join(', ')})`;
  }
  return { summary, audience };
}

export function itineraryRemoved(item: ItineraryItemDoc, dayNumber: number | null, members: readonly MemberLike[]): EventText {
  return { summary: `removed ${item.activity} from ${dayRef(item, dayNumber)}`, audience: resolveAudience(item.forWho, members) };
}

// ── Flights (everyone: arrivals and departures are group logistics) ──────────

const whose = (ownerName: string, actorUid: string, ownerUid: string) =>
  actorUid === ownerUid ? 'their' : `${ownerName}'s`;
const route = (f: FlightDoc) => `${f.from} → ${f.to}`;

export function flightAdded(f: FlightDoc, ownerName: string, actorUid: string): EventText {
  const when = time(f.departureTime);
  return {
    summary: `added ${whose(ownerName, actorUid, f.uid)} flight ${route(f)}, ${fmtDay(f.departureDate)}${when ? ` at ${when}` : ''}`,
    audience: 'all',
  };
}

export function flightChanged(before: FlightDoc, after: FlightDoc, ownerName: string, actorUid: string): EventText | null {
  const changed = changedFields(before, after, [
    ['departureTime', 'departure time'], ['arrivalTime', 'arrival time'], ['departureDate', 'date'],
    ['arrivalDate', 'arrival date'], ['from', 'route'], ['to', 'route'], ['airline', 'airline'], ['flightNumber', 'flight number'],
  ]);
  const labels = [...new Set(changed)];
  if (!labels.length) return null;
  return { summary: `changed ${whose(ownerName, actorUid, after.uid)} flight ${route(after)} (${labels.join(', ')})`, audience: 'all' };
}

export function flightRemoved(f: FlightDoc, ownerName: string, actorUid: string): EventText {
  return { summary: `removed ${whose(ownerName, actorUid, f.uid)} flight ${route(f)}`, audience: 'all' };
}

// ── Stays ─────────────────────────────────────────────────────────────────────

export function stayAdded(s: AccommodationDoc, members: readonly MemberLike[]): EventText {
  return { summary: `added a stay: ${s.name}, ${fmtRange(s.checkIn, s.checkOut)}`, audience: resolveAudience(s.forWho, members) };
}

export function stayChanged(before: AccommodationDoc, after: AccommodationDoc, members: readonly MemberLike[]): EventText | null {
  const changed = changedFields(before, after, [
    ['checkIn', 'check-in'], ['checkOut', 'check-out'], ['name', 'name'], ['address', 'address'],
    ['checkInTime', 'check-in time'], ['checkOutTime', 'check-out time'],
  ]);
  if (!changed.length) return null;
  return { summary: `changed ${after.name} (${changed.join(', ')})`, audience: resolveAudience(after.forWho, members) };
}

export function stayRemoved(s: AccommodationDoc, members: readonly MemberLike[]): EventText {
  return { summary: `removed the stay ${s.name}`, audience: resolveAudience(s.forWho, members) };
}

// ── Transportation (everyone) ─────────────────────────────────────────────────

const modeWord = (c: RentalCar) => (c.mode ?? 'Rental Car').toLowerCase();

export function transportAdded(c: RentalCar): EventText {
  const when = time(c.pickupTime);
  return {
    summary: `added a ${modeWord(c)}: ${c.company}, pick-up ${fmtDay(c.pickupDate)}${when ? ` at ${when}` : ''}`,
    audience: 'all',
  };
}

export function transportChanged(before: RentalCar, after: RentalCar): EventText | null {
  const changed = changedFields(before, after, [
    ['pickupDate', 'pick-up'], ['pickupTime', 'pick-up'], ['pickupLocation', 'pick-up'],
    ['dropoffDate', 'drop-off'], ['dropoffTime', 'drop-off'], ['dropoffLocation', 'drop-off'],
    ['company', 'company'], ['drivers', 'drivers'],
  ]);
  const labels = [...new Set(changed)];
  if (!labels.length) return null;
  return { summary: `changed the ${after.company} ${modeWord(after)} (${labels.join(', ')})`, audience: 'all' };
}

export function transportRemoved(c: RentalCar): EventText {
  return { summary: `removed the ${c.company} ${modeWord(c)}`, audience: 'all' };
}

// ── Finance (the payer and everyone in the split) ─────────────────────────────

function financeAudience(e: FinanceEntryDoc, members: readonly MemberLike[]): AudienceSpec {
  const split = resolveAudience(e.splitAmong, members);
  if (split === 'all') return 'all';
  const payer = resolveAudience(e.paidBy, members);
  const uids = payer === 'all' ? [] : payer;
  for (const u of split) if (!uids.includes(u)) uids.push(u);
  return uids;
}

function splitPhrase(e: FinanceEntryDoc): string {
  const raw = (e.splitAmong ?? '').trim();
  if (!raw || raw.toLowerCase() === 'all') return 'split between all of you';
  const n = raw.split(',').map(s => s.trim()).filter(Boolean).length;
  return `split between ${n} of you`;
}

export function financeAdded(e: FinanceEntryDoc, actorName: string, currency: string, members: readonly MemberLike[]): EventText {
  const paid = e.paidBy && e.paidBy !== actorName ? `, paid by ${e.paidBy}` : '';
  return {
    summary: `added ${money(e.amount, e.currency || currency)} for ${e.description}${paid}, ${splitPhrase(e)}`,
    audience: financeAudience(e, members),
  };
}

export function financeChanged(before: FinanceEntryDoc, after: FinanceEntryDoc, currency: string, members: readonly MemberLike[]): EventText | null {
  const cur = after.currency || currency;
  const audience = financeAudience(after, members);
  if (!same(before.amount, after.amount)) {
    return { summary: `changed ${after.description} to ${money(after.amount, cur)} (was ${money(before.amount, before.currency || currency)})`, audience };
  }
  if (!same(before.splitAmong, after.splitAmong) || JSON.stringify(before.splits ?? null) !== JSON.stringify(after.splits ?? null)) {
    return { summary: `changed who splits ${after.description}`, audience };
  }
  const changed = changedFields(before, after, [
    ['vendor', 'vendor'], ['date', 'date'], ['description', 'description'], ['paidBy', 'who paid'], ['category', 'category'], ['currency', 'currency'],
  ]);
  if (!changed.length) return null;
  return { summary: `updated ${after.description} (${changed.join(', ')})`, audience };
}

export function financeRemoved(e: FinanceEntryDoc, currency: string, members: readonly MemberLike[]): EventText {
  return { summary: `removed ${money(e.amount, e.currency || currency)} for ${e.description}`, audience: financeAudience(e, members) };
}

// ── Recs (everyone) ───────────────────────────────────────────────────────────

export function recAdded(r: RecDoc): EventText {
  return { summary: `added a rec: ${r.title} (${r.category})`, audience: 'all' };
}

export function recChanged(before: RecDoc, after: RecDoc): EventText | null {
  const changed = changedFields(before, after, [
    ['title', 'title'], ['category', 'category'], ['description', 'description'], ['extra', 'details'], ['destination', 'destination'],
  ]);
  if (!changed.length) return null;
  return { summary: `changed the rec ${before.title} (${changed.join(', ')})`, audience: 'all' };
}

export function recRemoved(r: RecDoc): EventText {
  return { summary: `removed the rec ${r.title}`, audience: 'all' };
}

// ── Map pins ──────────────────────────────────────────────────────────────────

export function pinAdded(p: MapPin, members: readonly MemberLike[]): EventText {
  return { summary: `pinned ${p.name} (${p.category})`, audience: resolveAudience(p.forWho, members) };
}

export function pinRemoved(p: MapPin, members: readonly MemberLike[]): EventText {
  return { summary: `removed the pin ${p.name}`, audience: resolveAudience(p.forWho, members) };
}

// ── Packing suggestions (one person each way) ─────────────────────────────────

export function packingSuggested(item: string, toUid: string): EventText {
  return { summary: `suggested you pack: ${item}`, audience: [toUid] };
}

export function packingAnswered(item: string, fromUid: string, accepted: boolean): EventText {
  return { summary: `${accepted ? 'added' : 'passed on'} your suggestion: ${item}`, audience: [fromUid] };
}

// ── Members and the trip itself (everyone) ────────────────────────────────────

export function memberEvent(action: 'joined' | 'left' | 'kicked' | 'restored', targetName: string, selfAct: boolean): EventText {
  const summary =
    action === 'joined'   ? (selfAct ? 'joined the trip' : `added ${targetName}`) :
    action === 'left'     ? 'left the trip' :
    action === 'kicked'   ? `removed ${targetName}` :
                            `added ${targetName} back`;
  return { summary, audience: 'all' };
}

export function tripChanged(before: TripDoc, patch: Partial<TripDoc>): EventText | null {
  const after = { ...before, ...patch };
  const labels: string[] = [];
  if (!same(before.name, after.name)) labels.push('name');
  if (!same(before.destination, after.destination)) labels.push('destination');
  if (!same(before.startDate, after.startDate) || !same(before.endDate, after.endDate)) labels.push('dates');
  if (!labels.length) return null;
  let summary: string;
  if (labels.length > 1)               summary = `updated the trip (${labels.join(', ')})`;
  else if (labels[0] === 'name')       summary = `renamed the trip to ${after.name}`;
  else if (labels[0] === 'destination') summary = `changed the destination to ${after.destination}`;
  else                                 summary = `changed the trip dates to ${fmtRange(after.startDate, after.endDate)}`;
  return { summary, audience: 'all' };
}
