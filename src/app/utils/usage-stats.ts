/**
 * Aggregations for the admin Activity page, computed in the browser from the
 * `_activity` rows the page has loaded. Pure functions; the page passes the
 * display zone in and gets numbers out.
 */
import type { UsagePlatform } from './usage';

export interface UsageRow {
  uid: string;
  tripId: string | null;
  type: 'session' | 'page' | 'ping';
  page: string;
  at: number;          // ms since epoch (the doc's server timestamp)
  localHour: number;
  tz: string;
  tzOffsetMin: number;
  platform: UsagePlatform;
  sessionId: string;
  appVersion: string;
}

/** Either "each person's own clock" or one IANA zone everyone is converted to. */
export type HourMode = 'local' | string;

const HOUR = 3_600_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    });
    formatters.set(zone, f);
  }
  return f;
}

function parts(ms: number, zone: string): { day: string; hour: number } {
  const p = fmt(zone).formatToParts(new Date(ms));
  const get = (t: string) => p.find(x => x.type === t)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** Calendar day (`YYYY-MM-DD`) of an instant in a zone. */
export function dayKey(ms: number, zone: string): string { return parts(ms, zone).day; }

/** Hour of day (0–23) of an instant in a zone. */
export function hourIn(ms: number, zone: string): number { return parts(ms, zone).hour; }

/** Hour label like "14:00" for a bucket start in a zone. */
export function hourLabel(ms: number, zone: string): string {
  return `${String(hourIn(ms, zone)).padStart(2, '0')}:00`;
}

export interface OnlineUser { uid: string; page: string; platform: UsagePlatform; tz: string; lastSeen: number }

/** People with any event inside the window, each by their latest event, most recent first. */
export function onlineNow(rows: UsageRow[], now: number, windowMs: number): OnlineUser[] {
  const latest = new Map<string, UsageRow>();
  for (const r of rows) {
    if (now - r.at > windowMs || r.at > now) continue;
    const cur = latest.get(r.uid);
    if (!cur || r.at > cur.at) latest.set(r.uid, r);
  }
  return [...latest.values()]
    .sort((a, b) => b.at - a.at)
    .map(r => ({ uid: r.uid, page: r.page, platform: r.platform, tz: r.tz, lastSeen: r.at }));
}

export interface HourBucket { start: number; label: string; users: number }

/** Distinct users per clock hour from `from` (rounded down to the hour) up to `to`. */
export function usersPerHour(rows: UsageRow[], from: number, to: number, zone: string): HourBucket[] {
  const first = Math.floor(from / HOUR) * HOUR;
  const seen = new Map<number, Set<string>>();
  for (const r of rows) {
    if (r.at < first || r.at >= to) continue;
    const k = Math.floor(r.at / HOUR) * HOUR;
    (seen.get(k) ?? seen.set(k, new Set()).get(k)!).add(r.uid);
  }
  const out: HourBucket[] = [];
  for (let s = first; s < to; s += HOUR) out.push({ start: s, label: hourLabel(s, zone), users: seen.get(s)?.size ?? 0 });
  return out;
}

export interface DayBucket { day: string; users: number }

/** Distinct users per calendar day in the display zone, oldest first. Days with no events are omitted. */
export function usersPerDay(rows: UsageRow[], zone: string): DayBucket[] {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = dayKey(r.at, zone);
    (seen.get(k) ?? seen.set(k, new Set()).get(k)!).add(r.uid);
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, s]) => ({ day, users: s.size }));
}

/**
 * How many distinct user-hours fell in each hour of the day (24 numbers). A
 * person active at 14:00 on two days counts twice for 14. In `local` mode the
 * hour is the one on that person's own clock at the time; otherwise everyone
 * is converted to the given zone.
 */
export function hourOfDay(rows: UsageRow[], mode: HourMode): number[] {
  const seen = new Set<string>();
  const counts = new Array<number>(24).fill(0);
  for (const r of rows) {
    let hour: number, day: string;
    if (mode === 'local') {
      hour = r.localHour;
      // The person's calendar day: shift the instant by their offset and read UTC.
      day = new Date(r.at + r.tzOffsetMin * 60_000).toISOString().slice(0, 10);
    } else {
      ({ hour, day } = parts(r.at, mode));
    }
    const key = `${r.uid}|${day}|${hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[hour]++;
  }
  return counts;
}

export interface PageStat { page: string; views: number; users: number }

/** Page views (`page` events) and distinct people per page, busiest first. */
export function pageStats(rows: UsageRow[]): PageStat[] {
  const byPage = new Map<string, { views: number; users: Set<string> }>();
  for (const r of rows) {
    const s = byPage.get(r.page) ?? byPage.set(r.page, { views: 0, users: new Set() }).get(r.page)!;
    if (r.type === 'page') s.views++;
    s.users.add(r.uid);
  }
  return [...byPage.entries()]
    .map(([page, s]) => ({ page, views: s.views, users: s.users.size }))
    .sort((a, b) => b.views - a.views || b.users - a.users || a.page.localeCompare(b.page));
}

export interface PersonStat {
  uid: string; platform: UsagePlatform; tz: string; lastSeen: number; views: number; daysActive: number; sessions: number;
}

/** One line per person: latest platform and zone, last seen, page views, days active, app opens. */
export function peopleStats(rows: UsageRow[], zone: string): PersonStat[] {
  const acc = new Map<string, { last: UsageRow; views: number; days: Set<string>; sessions: number }>();
  for (const r of rows) {
    const a = acc.get(r.uid) ?? acc.set(r.uid, { last: r, views: 0, days: new Set(), sessions: 0 }).get(r.uid)!;
    if (r.at > a.last.at) a.last = r;
    if (r.type === 'page') a.views++;
    if (r.type === 'session') a.sessions++;
    a.days.add(dayKey(r.at, zone));
  }
  return [...acc.entries()]
    .map(([uid, a]) => ({
      uid, platform: a.last.platform, tz: a.last.tz, lastSeen: a.last.at,
      views: a.views, daysActive: a.days.size, sessions: a.sessions,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
}
