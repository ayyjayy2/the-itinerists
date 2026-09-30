/**
 * Aggregations for the Pulse dashboard (/pulse/), computed in the browser
 * from the `_activity` rows the page has loaded. Pure functions; the page
 * passes the display zone in and gets numbers out. Tested by
 * test/pulse-stats.test.mjs (`npm run test:pulse`).
 *
 * A row: { uid, tripId, type: 'session'|'page'|'ping', page, at (ms),
 *          localHour, tz, tzOffsetMin, platform, sessionId, appVersion }
 */

const HOUR = 3_600_000;
const formatters = new Map();

function fmt(zone) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    });
    formatters.set(zone, f);
  }
  return f;
}

function parts(ms, zone) {
  const p = fmt(zone).formatToParts(new Date(ms));
  const get = t => p.find(x => x.type === t)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** Calendar day (`YYYY-MM-DD`) of an instant in a zone. */
export function dayKey(ms, zone) { return parts(ms, zone).day; }

/** Hour of day (0–23) of an instant in a zone. */
export function hourIn(ms, zone) { return parts(ms, zone).hour; }

/** Hour label like "14:00" for a bucket start in a zone. */
export function hourLabel(ms, zone) { return `${String(hourIn(ms, zone)).padStart(2, '0')}:00`; }

/** Midnight at the start of the calendar day containing `ms` in `zone`. */
export function startOfDay(ms, zone) {
  const day = dayKey(ms, zone);
  let t = ms;
  while (dayKey(t - HOUR, zone) === day) t -= HOUR;
  return Math.floor(t / HOUR) * HOUR;
}

/** People with any event inside the window, each by their latest event, most recent first. */
export function onlineNow(rows, now, windowMs) {
  const latest = new Map();
  for (const r of rows) {
    if (now - r.at > windowMs || r.at > now) continue;
    const cur = latest.get(r.uid);
    if (!cur || r.at > cur.at) latest.set(r.uid, r);
  }
  return [...latest.values()]
    .sort((a, b) => b.at - a.at)
    .map(r => ({ uid: r.uid, tripId: r.tripId, page: r.page, platform: r.platform, tz: r.tz, lastSeen: r.at }));
}

/** Distinct users per clock hour from `from` (rounded down to the hour) up to `to`. */
export function usersPerHour(rows, from, to, zone) {
  const first = Math.floor(from / HOUR) * HOUR;
  const seen = new Map();
  for (const r of rows) {
    if (r.at < first || r.at >= to) continue;
    const k = Math.floor(r.at / HOUR) * HOUR;
    (seen.get(k) ?? seen.set(k, new Set()).get(k)).add(r.uid);
  }
  const out = [];
  for (let s = first; s < to; s += HOUR) out.push({ start: s, label: hourLabel(s, zone), users: seen.get(s)?.size ?? 0 });
  return out;
}

/** Distinct users per calendar day in the display zone, oldest first. Days with no events are omitted. */
export function usersPerDay(rows, zone) {
  const seen = new Map();
  for (const r of rows) {
    const k = dayKey(r.at, zone);
    (seen.get(k) ?? seen.set(k, new Set()).get(k)).add(r.uid);
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, s]) => ({ day, users: s.size }));
}

/**
 * How many distinct user-hours fell in each hour of the day (24 numbers). A
 * person active at 14:00 on two days counts twice for 14. With mode 'local'
 * the hour is the one on that person's own clock at the time; otherwise
 * everyone is converted to the given zone.
 */
export function hourOfDay(rows, mode) {
  const seen = new Set();
  const counts = new Array(24).fill(0);
  for (const r of rows) {
    let hour, day;
    if (mode === 'local') {
      hour = r.localHour;
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

/** Page views (`page` events) and distinct people per page, busiest first. */
export function pageStats(rows) {
  const byPage = new Map();
  for (const r of rows) {
    const s = byPage.get(r.page) ?? byPage.set(r.page, { views: 0, users: new Set() }).get(r.page);
    if (r.type === 'page') s.views++;
    s.users.add(r.uid);
  }
  return [...byPage.entries()]
    .map(([page, s]) => ({ page, views: s.views, users: s.users.size }))
    .sort((a, b) => b.views - a.views || b.users - a.users || a.page.localeCompare(b.page));
}

/** One line per person: latest platform, zone and trip, last seen, page views, days active, app opens. */
export function peopleStats(rows, zone) {
  const acc = new Map();
  for (const r of rows) {
    const a = acc.get(r.uid) ?? acc.set(r.uid, { last: r, views: 0, days: new Set(), sessions: 0 }).get(r.uid);
    if (r.at > a.last.at) a.last = r;
    if (r.type === 'page') a.views++;
    if (r.type === 'session') a.sessions++;
    a.days.add(dayKey(r.at, zone));
  }
  return [...acc.entries()]
    .map(([uid, a]) => ({
      uid, platform: a.last.platform, tz: a.last.tz, tripId: a.last.tripId, lastSeen: a.last.at,
      views: a.views, daysActive: a.days.size, sessions: a.sessions,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

/** One line per trip: people, views, opens, last activity; most recently active first. */
export function tripStats(rows) {
  const acc = new Map();
  for (const r of rows) {
    const k = r.tripId ?? '';
    const a = acc.get(k) ?? acc.set(k, { users: new Set(), views: 0, sessions: 0, last: 0 }).get(k);
    a.users.add(r.uid);
    if (r.type === 'page') a.views++;
    if (r.type === 'session') a.sessions++;
    if (r.at > a.last) a.last = r.at;
  }
  return [...acc.entries()]
    .map(([tripId, a]) => ({ tripId: tripId || null, users: a.users.size, views: a.views, sessions: a.sessions, lastSeen: a.last }))
    .sort((a, b) => b.lastSeen - a.lastSeen);
}
