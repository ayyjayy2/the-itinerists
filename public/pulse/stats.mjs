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
const DAY = 24 * HOUR;
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
    .map(r => ({ uid: r.uid, tripId: r.tripId, page: pageName(r.page), platform: r.platform, tz: r.tz, lastSeen: r.at }));
}

/** Distinct users per clock hour from `from` (rounded down to the hour) up to `to`. */
export function usersPerHour(rows, from, to, zone) {
  const first = Math.floor(from / HOUR) * HOUR;
  const seen = new Map();
  const hits = new Map();
  for (const r of rows) {
    if (r.at < first || r.at >= to) continue;
    const k = Math.floor(r.at / HOUR) * HOUR;
    (seen.get(k) ?? seen.set(k, new Set()).get(k)).add(r.uid);
    (hits.get(k) ?? hits.set(k, []).get(k)).push(r);
  }
  const out = [];
  for (let s = first; s < to; s += HOUR) {
    const uids = [...(seen.get(s) ?? [])].sort();
    out.push({ start: s, label: hourLabel(s, zone), users: uids.length, uids, pages: pagesOf(hits.get(s) ?? []) });
  }
  return out;
}

/** Distinct pages in these rows, busiest first (every event type counts: a ping says where someone stayed). */
export function pagesOf(rows) {
  const n = new Map();
  for (const r of rows) if (r.page) n.set(pageName(r.page), (n.get(pageName(r.page)) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([page]) => page);
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
  return hourOfDayDetail(rows, mode).map(h => h.count);
}

/** Same as hourOfDay, with who, where and what: `{ count, uids, zones, pages }` per hour (uids and zones distinct, sorted; pages busiest first). */
export function hourOfDayDetail(rows, mode) {
  const seen = new Set();
  const counts = new Array(24).fill(0);
  const people = Array.from({ length: 24 }, () => new Set());
  const zones = Array.from({ length: 24 }, () => new Set());
  const hits = Array.from({ length: 24 }, () => []);
  for (const r of rows) {
    let hour, day;
    if (mode === 'local') {
      hour = r.localHour;
      day = new Date(r.at + r.tzOffsetMin * 60_000).toISOString().slice(0, 10);
    } else {
      ({ hour, day } = parts(r.at, mode));
    }
    hits[hour].push(r);
    const key = `${r.uid}|${day}|${hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[hour]++;
    people[hour].add(r.uid);
    if (r.tz) zones[hour].add(r.tz);
  }
  return counts.map((count, h) => ({ count, uids: [...people[h]].sort(), zones: [...zones[h]].sort(), pages: pagesOf(hits[h]) }));
}

/** "/" is the app's entry before it redirects to Home; count it as Home. */
export const pageName = page => page === '/' ? '/home' : page;

/** Page views (`page` events) and distinct people per page, busiest first. */
export function pageStats(rows) {
  const byPage = new Map();
  for (const r of rows) {
    const page = pageName(r.page);
    const s = byPage.get(page) ?? byPage.set(page, { views: 0, users: new Set() }).get(page);
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
    const a = acc.get(r.uid) ?? acc.set(r.uid, { last: r, lastTrip: null, views: 0, days: new Set(), sessions: 0 }).get(r.uid);
    if (r.at > a.last.at) a.last = r;
    // The trip they were last in, not the trip of their last event: the sign-in
    // screen and the trip list carry no trip, and they are often the last thing seen.
    if (r.tripId && (!a.lastTrip || r.at > a.lastTrip.at)) a.lastTrip = r;
    if (r.type === 'page') a.views++;
    if (r.type === 'session') a.sessions++;
    a.days.add(dayKey(r.at, zone));
  }
  return [...acc.entries()]
    .map(([uid, a]) => ({
      uid, platform: a.last.platform, tz: a.last.tz, tripId: a.lastTrip?.tripId ?? null, lastSeen: a.last.at,
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

// ── Return rate, visits, around the trip, platform & version ────────────────

const dayIndex = key => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
const keyOfIndex = i => new Date(i * DAY).toISOString().slice(0, 10);
const sortedUids = set => [...set].sort();

/**
 * People grouped by the week (Monday-start, in `zone`) they were first seen
 * in these rows, and who among them was active again the next day, within 7
 * days and within 14 days of that first day. Rows only reach back as far as
 * the loaded range, so "first seen" means first seen in the range.
 */
export function returnCohorts(rows, zone) {
  const days = new Map();
  for (const r of rows) (days.get(r.uid) ?? days.set(r.uid, new Set()).get(r.uid)).add(dayIndex(dayKey(r.at, zone)));
  const weeks = new Map();
  for (const [uid, set] of days) {
    const first = Math.min(...set);
    const dow = (first + 3) % 7;              // epoch day 0 was a Thursday; 0 = Monday
    const week = keyOfIndex(first - dow);
    const w = weeks.get(week) ?? weeks.set(week, { week, uids: [], nextDay: [], within7: [], within14: [] }).get(week);
    w.uids.push(uid);
    const within = n => [...set].some(d => d > first && d <= first + n);
    if (set.has(first + 1)) w.nextDay.push(uid);
    if (within(7)) w.within7.push(uid);
    if (within(14)) w.within14.push(uid);
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)).map(w => ({
    ...w, uids: w.uids.sort(), nextDay: w.nextDay.sort(), within7: w.within7.sort(), within14: w.within14.sort(),
  }));
}

const DURATION_BUCKETS = [['< 1 min', 0, 1], ['1–5 min', 1, 5], ['5–15 min', 5, 15], ['15–30 min', 15, 30], ['30+ min', 30, Infinity]];
const PAGE_BUCKETS = [['1 page', 1, 1], ['2 pages', 2, 2], ['3–5 pages', 3, 5], ['6+ pages', 6, Infinity]];

/** Visits (one per session id): minutes from first to last event, and distinct pages seen. */
export function sessionStats(rows) {
  const s = new Map();
  for (const r of rows) {
    const v = s.get(r.sessionId) ?? s.set(r.sessionId, { uid: r.uid, first: r.at, last: r.at, pages: new Set() }).get(r.sessionId);
    v.first = Math.min(v.first, r.at); v.last = Math.max(v.last, r.at);
    if (r.page) v.pages.add(pageName(r.page));
  }
  const bucket = (defs, pick) => defs.map(([label, lo, hi]) => {
    const uids = new Set(); let count = 0;
    for (const v of s.values()) { const x = pick(v); if (x >= lo && (hi === Infinity ? true : x < hi || (lo === hi && x === hi))) { count++; uids.add(v.uid); } }
    return { label, count, uids: sortedUids(uids) };
  });
  return {
    sessions: s.size,
    duration: bucket(DURATION_BUCKETS, v => (v.last - v.first) / 60_000),
    pages: bucket(PAGE_BUCKETS, v => Math.max(1, v.pages.size)),
  };
}

/**
 * Distinct people per day around each dated trip, aligned so day 0 is the
 * trip's first day, from two weeks before to a week after the longest trip.
 * Counts are per trip-day and summed across trips; `before` / `during` /
 * `after` say which phase of its trip each count fell in.
 */
export function aroundTrips(rows, trips, zone) {
  const dated = new Map(trips.filter(t => t.startDate && t.endDate).map(t => [t.id, { start: dayIndex(t.startDate), len: dayIndex(t.endDate) - dayIndex(t.startDate) + 1 }]));
  const maxLen = Math.max(1, ...[...dated.values()].map(t => t.len));
  const seen = new Set();
  const cells = new Map();
  for (const r of rows) {
    const t = dated.get(r.tripId); if (!t) continue;
    const offset = dayIndex(dayKey(r.at, zone)) - t.start;
    const key = `${r.uid}|${r.tripId}|${offset}`; if (seen.has(key)) continue; seen.add(key);
    const phase = offset < 0 ? 'before' : offset < t.len ? 'during' : 'after';
    const c = cells.get(offset) ?? cells.set(offset, { offset, before: 0, during: 0, after: 0, uids: new Set() }).get(offset);
    c[phase]++; c.uids.add(r.uid);
  }
  const out = [];
  for (let o = -14; o < maxLen + 7; o++) {
    const c = cells.get(o);
    out.push(c ? { ...c, uids: sortedUids(c.uids) } : { offset: o, before: 0, during: 0, after: 0, uids: [] });
  }
  return out;
}

/** Distinct people per day per platform (web, pwa, ios), days ascending. */
export function platformPerDay(rows, zone) {
  const days = new Map();
  for (const r of rows) {
    const k = dayKey(r.at, zone);
    const d = days.get(k) ?? days.set(k, { day: k, web: new Set(), pwa: new Set(), ios: new Set() }).get(k);
    (d[r.platform] ?? d.web).add(r.uid);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).map(d => ({ day: d.day, web: sortedUids(d.web), pwa: sortedUids(d.pwa), ios: sortedUids(d.ios) }));
}

/** People per app version and when that version was last seen, newest version first. */
export function versionStats(rows) {
  const v = new Map();
  for (const r of rows) {
    const x = v.get(r.appVersion) ?? v.set(r.appVersion, { version: r.appVersion, uids: new Set(), lastSeen: 0 }).get(r.appVersion);
    x.uids.add(r.uid); x.lastSeen = Math.max(x.lastSeen, r.at);
  }
  const num = s => String(s).split('.').map(n => parseInt(n, 10) || 0);
  const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0); return 0; };
  return [...v.values()].sort((a, b) => cmp(a.version, b.version)).map(x => ({ ...x, uids: sortedUids(x.uids) }));
}

/**
 * Where the app was used: distinct people, app opens and zones per country,
 * most people first. `countryOf` turns an event's zone into a country name
 * (the page passes its zones table); events with an unknown zone are skipped.
 */
export function countryStats(rows, countryOf) {
  const acc = new Map();
  for (const r of rows) {
    const country = r.tz ? countryOf(r.tz) : '';
    if (!country) continue;
    const c = acc.get(country) ?? acc.set(country, { country, uids: new Set(), sessions: 0, zones: new Set() }).get(country);
    c.uids.add(r.uid); c.zones.add(r.tz);
    if (r.type === 'session') c.sessions++;
  }
  return [...acc.values()]
    .map(c => ({ country: c.country, uids: [...c.uids].sort(), sessions: c.sessions, zones: [...c.zones].sort() }))
    .sort((a, b) => b.uids.length - a.uids.length || a.country.localeCompare(b.country));
}

// ── Sign-ups and things written ───────────────────────────────────────────────

/** Distinct new accounts per day (from users' createdAt) between `from` and `to`, days ascending; uids per day. */
export function signupsPerDay(users, from, to, zone) {
  const days = new Map();
  for (const [uid, u] of users) {
    const at = u.createdAt?.toMillis?.() ?? (typeof u.createdAt === 'number' ? u.createdAt : NaN);
    if (isNaN(at) || at < from || at >= to) continue;
    const k = dayKey(at, zone);
    (days.get(k) ?? days.set(k, new Set()).get(k)).add(uid);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, s]) => ({ day, uids: [...s].sort() }));
}

/** Things written per day, by kind, with who: `{ day, total, byKind: {kind: n}, uids }`, days ascending. */
export function writesPerDay(writes, zone) {
  const days = new Map();
  for (const w of writes) {
    const k = dayKey(w.at, zone);
    const d = days.get(k) ?? days.set(k, { day: k, total: 0, byKind: {}, uids: new Set() }).get(k);
    d.total++; d.byKind[w.kind] = (d.byKind[w.kind] ?? 0) + 1; d.uids.add(w.uid);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).map(d => ({ ...d, uids: [...d.uids].sort() }));
}

// ── Activity timeline ───────────────────────────────────────────────────────

/**
 * One entry per day with anyone active: people seen in the event log that day
 * plus people who wrote something (so days before the event log, known only
 * from the write log, still count). Carries what a hover needs: who, the
 * pages seen (busiest first), the first and last moment of activity, and the
 * edits: by kind overall, and per person by kind ("3 recs by Makaela"), and
 * `activity` = events + edits per person for splitting the bar. Days ascending.
 */
export function activityTimeline(rows, writes, zone) {
  const days = new Map();
  const get = k => days.get(k) ?? days.set(k, { day: k, uids: new Set(), hits: [], firstMs: Infinity, lastMs: -Infinity, activity: {}, writes: { total: 0, byKind: {}, byPerson: {}, uids: new Set() } }).get(k);
  for (const r of rows) {
    const d = get(dayKey(r.at, zone));
    d.uids.add(r.uid); d.hits.push(r); d.activity[r.uid] = (d.activity[r.uid] ?? 0) + 1;
    if (r.at < d.firstMs) d.firstMs = r.at; if (r.at > d.lastMs) d.lastMs = r.at;
  }
  for (const w of writes) {
    const d = get(dayKey(w.at, zone));
    d.uids.add(w.uid); d.writes.total++; d.writes.byKind[w.kind] = (d.writes.byKind[w.kind] ?? 0) + 1; d.writes.uids.add(w.uid); d.activity[w.uid] = (d.activity[w.uid] ?? 0) + 1;
    const mine = d.writes.byPerson[w.uid] ?? (d.writes.byPerson[w.uid] = {}); mine[w.kind] = (mine[w.kind] ?? 0) + 1;
    if (w.at < d.firstMs) d.firstMs = w.at; if (w.at > d.lastMs) d.lastMs = w.at;
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).map(d => ({
    day: d.day, uids: [...d.uids].sort(), pages: pagesOf(d.hits), firstMs: d.firstMs, lastMs: d.lastMs,
    activity: d.activity,   // events + edits per person, for the bar's per-person split
    writes: { total: d.writes.total, byKind: d.writes.byKind, byPerson: d.writes.byPerson, uids: [...d.writes.uids].sort() },
  }));
}
