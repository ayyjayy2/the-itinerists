/**
 * Keeping a trip in the phone's calendar without duplicates. Every event the
 * app adds ends its notes with a tag naming the trip and the item
 * ("itinerists:<trip>:<item>"). Adding again reads the calendar over the
 * trip's dates and plans: update what changed, add what's new, remove what was
 * deleted from the trip, leave everything else (including the person's own
 * events) alone. The tag lives in Calendar, so this works on a new phone too.
 */
import { CalEvent, addDays } from './calendar-export';

const TAG = /itinerists:([\w-]+):([\w-]+)/;

export function tagFor(tripId: string, uid: string): string { return `itinerists:${tripId}:${uid}`; }

/** What the calendar plugin takes for one event: all-day days as local midnights. */
export interface NativeEvent {
  title: string;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  location?: string;
  description: string;
}
export interface ExistingEvent {
  id: string;
  title: string | null;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  location: string | null;
  description: string | null;
}
export interface SyncPlan {
  create: NativeEvent[];
  update: { id: string; event: NativeEvent }[];
  remove: string[];
  unchanged: number;
}

const localMidnight = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

export function toNative(e: CalEvent, tripId: string): NativeEvent {
  const description = [e.description, `Added by The Itinerists · ${tagFor(tripId, e.uid)}`].filter(Boolean).join('\n\n');
  if (e.start.allDay && e.end.allDay) {
    const lastDay = addDays(e.end.date, -1);
    return { title: e.title, isAllDay: true, startDate: localMidnight(e.start.date), endDate: localMidnight(lastDay) + 23 * 3_600_000 + 59 * 60_000, location: e.location, description };
  }
  const s = e.start as { ms: number }, en = e.end as { ms: number };
  return { title: e.title, isAllDay: false, startDate: s.ms, endDate: en.ms, location: e.location, description };
}

/** The window to read: a day either side of everything we'd add. */
export function syncWindow(events: readonly NativeEvent[], trip: { startDate?: string; endDate?: string }): { from: number; to: number } {
  const DAY = 86_400_000;
  const starts = events.map(e => e.startDate), ends = events.map(e => e.endDate);
  if (trip.startDate) starts.push(localMidnight(trip.startDate));
  if (trip.endDate) ends.push(localMidnight(trip.endDate) + DAY);
  return { from: Math.min(...starts) - DAY, to: Math.max(...ends) + DAY };
}

function same(a: NativeEvent, b: ExistingEvent): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 60_000;
  return (b.title ?? '') === a.title && b.isAllDay === a.isAllDay
    && close(b.startDate, a.startDate) && (a.isAllDay || close(b.endDate, a.endDate))
    && (b.location ?? '') === (a.location ?? '') && (b.description ?? '') === a.description;
}

export function planCalendarSync(desired: readonly CalEvent[], existing: readonly ExistingEvent[], tripId: string): SyncPlan {
  const ours = new Map<string, ExistingEvent[]>();
  for (const ev of existing) {
    const m = (ev.description ?? '').match(TAG);
    if (!m || m[1] !== tripId) continue;                 // not ours, or another trip's: never touched
    const list = ours.get(m[2]) ?? []; list.push(ev); ours.set(m[2], list);
  }
  const plan: SyncPlan = { create: [], update: [], remove: [], unchanged: 0 };
  for (const e of desired) {
    const target = toNative(e, tripId);
    const [keep, ...extra] = ours.get(e.uid) ?? [];
    ours.delete(e.uid);
    plan.remove.push(...extra.map(x => x.id));           // copies from before: keep one
    if (!keep) plan.create.push(target);
    else if (same(target, keep)) plan.unchanged++;
    else plan.update.push({ id: keep.id, event: target });
  }
  for (const gone of ours.values()) plan.remove.push(...gone.map(x => x.id));   // deleted from the trip
  return plan;
}
