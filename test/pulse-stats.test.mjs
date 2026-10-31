/** Unit tests for the Pulse dashboard aggregations. Run: npm run test:pulse */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey, hourIn, startOfDay, stampText, onlineNow, inWindow, usersPerHour, usersPerDay, hourOfDay, hourOfDayDetail, pageStats, offerStats, peopleStats, tripStats,
  deletionStats, waitlistStats, historyCacheUsable, liveFrom, backfillRange, mergeRows,
} from '../public/pulse/stats.mjs';

const H = 3_600_000;
// 2026-09-30 12:00:00 UTC = 14:00 in Berlin, 07:00 in Chicago.
const NOON = Date.UTC(2026, 8, 30, 12, 0, 0);
const row = o => ({
  tripId: 'T', type: 'page', page: '/home', localHour: 14, tz: 'Europe/Berlin', tzOffsetMin: 120,
  platform: 'web', sessionId: 's', appVersion: '0.9.0', ...o,
});

test('dayKey / hourIn / startOfDay read a zone', () => {
  assert.equal(dayKey(NOON, 'Europe/Berlin'), '2026-09-30');
  assert.equal(hourIn(NOON, 'Europe/Berlin'), 14);
  assert.equal(hourIn(NOON, 'America/Chicago'), 7);
  assert.equal(dayKey(Date.UTC(2026, 8, 30, 23, 30), 'Europe/Berlin'), '2026-10-01');
  assert.equal(hourIn(Date.UTC(2026, 8, 30, 23, 30), 'Europe/Berlin'), 1);
  assert.equal(startOfDay(NOON, 'Europe/Berlin'), Date.UTC(2026, 8, 29, 22)); // 00:00 Berlin = 22:00 UTC the day before
  assert.equal(startOfDay(NOON, 'UTC'), Date.UTC(2026, 8, 30));
});

test('onlineNow lists each user once by their latest event inside the window', () => {
  const rows = [
    row({ uid: 'a', at: NOON - 10 * 60_000, page: '/home' }),
    row({ uid: 'a', at: NOON - 60_000, page: '/finance', type: 'ping' }),
    row({ uid: 'b', at: NOON - 5 * 60_000, page: '/map' }),
    row({ uid: 'c', at: NOON - 7 * 60_000, page: '/home' }),
  ];
  const online = onlineNow(rows, NOON, 6 * 60_000);
  assert.deepEqual(online.map(o => o.uid), ['a', 'b']);
  assert.equal(online[0].page, '/finance');
  assert.equal(online[0].lastSeen, NOON - 60_000);
});

test('usersPerHour counts distinct users per clock hour and aligns to the hour', () => {
  const rows = [
    row({ uid: 'a', at: NOON + 5 * 60_000 }),
    row({ uid: 'a', at: NOON + 20 * 60_000, type: 'ping' }),
    row({ uid: 'b', at: NOON + 30 * 60_000 }),
    row({ uid: 'b', at: NOON + H + 10 * 60_000 }),
  ];
  const b = usersPerHour(rows, NOON, NOON + 3 * H, 'Europe/Berlin');
  assert.deepEqual(b.map(x => x.users), [2, 1, 0]);
  assert.deepEqual(b.map(x => x.uids), [['a', 'b'], ['b'], []]);
  assert.deepEqual(b.map(x => x.pages), [['/home'], ['/home'], []]);
  assert.equal(b[0].start, NOON);
  assert.equal(b[0].label, '14:00');
  const aligned = usersPerHour([], NOON + 25 * 60_000, NOON + 2 * H, 'UTC');
  assert.equal(aligned[0].start, NOON);
  assert.equal(aligned.length, 2);
});

test('usersPerDay uses calendar days in the display zone', () => {
  const rows = [
    row({ uid: 'a', at: NOON }),
    row({ uid: 'b', at: NOON + H }),
    row({ uid: 'a', at: Date.UTC(2026, 8, 30, 23, 30) }),
  ];
  assert.deepEqual(usersPerDay(rows, 'Europe/Berlin'), [{ day: '2026-09-30', users: 2 }, { day: '2026-10-01', users: 1 }]);
  assert.deepEqual(usersPerDay(rows, 'UTC'), [{ day: '2026-09-30', users: 2 }]);
});

test('hourOfDay counts a person once per hour per day, on their clock or in one zone', () => {
  const rows = [
    row({ uid: 'a', at: NOON, localHour: 14 }),
    row({ uid: 'a', at: NOON + 10 * 60_000, localHour: 14 }),
    row({ uid: 'b', at: NOON, localHour: 7, tz: 'America/Chicago', tzOffsetMin: -300 }),
    row({ uid: 'a', at: NOON + 24 * H, localHour: 14 }),
  ];
  const local = hourOfDay(rows, 'local');
  assert.equal(local.length, 24);
  assert.equal(local[14], 2);
  assert.equal(local[7], 1);
  assert.equal(local.reduce((s, n) => s + n, 0), 3);
  const berlin = hourOfDay(rows, 'Europe/Berlin');
  assert.equal(berlin[14], 3);
  assert.equal(berlin[7], 0);
  // Who: distinct people per hour, and how many user-hours they add up to.
  const detail = hourOfDayDetail(rows, 'Europe/Berlin');
  assert.deepEqual(detail[14], { count: 3, uids: ['a', 'b'], zones: ['America/Chicago', 'Europe/Berlin'], pages: ['/home'] });
  assert.deepEqual(detail[7], { count: 0, uids: [], zones: [], pages: [] });
  // On each person's own clock the bar also says which zones those hours were in.
  const own = hourOfDayDetail(rows, 'local');
  assert.deepEqual(own[14], { count: 2, uids: ['a'], zones: ['Europe/Berlin'], pages: ['/home'] });
  assert.deepEqual(own[7], { count: 1, uids: ['b'], zones: ['America/Chicago'], pages: ['/home'] });
});

test('offerStats counts taps and distinct people per partner, most tapped first', () => {
  const rows = [
    { uid: 'a', type: 'offer', offer: 'airalo' }, { uid: 'a', type: 'offer', offer: 'airalo' },
    { uid: 'b', type: 'offer', offer: 'saily' }, { uid: 'c', type: 'offer', offer: 'airalo' },
    { uid: 'a', type: 'page', page: '/recs' },
  ];
  assert.deepEqual(offerStats(rows), [
    { offer: 'airalo', taps: 3, users: 2 },
    { offer: 'saily', taps: 1, users: 1 },
  ]);
});

test('pageStats counts views and distinct people per page, busiest first', () => {
  const rows = [
    row({ uid: 'a', at: NOON, page: '/home' }),
    row({ uid: 'a', at: NOON + 1, page: '/home', type: 'ping' }),
    row({ uid: 'b', at: NOON + 2, page: '/home' }),
    row({ uid: 'b', at: NOON + 3, page: '/map' }),
    row({ uid: 'b', at: NOON + 4, page: '/map' }),
    row({ uid: 'b', at: NOON + 5, page: '/map' }),
    row({ uid: 'c', at: NOON + 6, page: '/login', type: 'session' }),
  ];
  assert.deepEqual(pageStats(rows), [
    { page: '/map', views: 3, users: 1 },
    { page: '/home', views: 2, users: 2 },
    { page: '/login', views: 0, users: 1 },
  ]);
});

test('peopleStats summarises each person, most recently seen first', () => {
  const rows = [
    row({ uid: 'a', at: NOON, platform: 'web' }),
    row({ uid: 'a', at: NOON + 24 * H, platform: 'pwa' }),
    row({ uid: 'a', at: NOON + 24 * H + 1, type: 'ping', platform: 'pwa' }),
    // Their newest event has no trip (the trip list); the trip shown is still the one they were last in.
    row({ uid: 'a', at: NOON + 24 * H + 2, page: '/trips', platform: 'pwa', tripId: null }),
    row({ uid: 'b', at: NOON + H, platform: 'ios', tz: 'America/Chicago', tripId: 'U' }),
    row({ uid: 'c', at: NOON, page: '/login', tripId: null }),
  ];
  const p = peopleStats(rows, 'Europe/Berlin');
  assert.deepEqual(p.map(x => x.uid), ['a', 'b', 'c']);
  assert.deepEqual(p[0], { uid: 'a', platform: 'pwa', tz: 'Europe/Berlin', tripId: 'T', lastSeen: NOON + 24 * H + 2, views: 3, daysActive: 2, sessions: 0 });
  assert.equal(p[1].daysActive, 1);
  assert.equal(p[1].tripId, 'U');
  assert.equal(p[2].tripId, null);
});

test('tripStats summarises each trip, most recently active first', () => {
  const rows = [
    row({ uid: 'a', at: NOON, tripId: 'T', type: 'session' }),
    row({ uid: 'a', at: NOON + 1, tripId: 'T' }),
    row({ uid: 'b', at: NOON + 2, tripId: 'T' }),
    row({ uid: 'c', at: NOON + 3, tripId: 'U' }),
    row({ uid: 'd', at: NOON + 4, tripId: null, page: '/login' }),
  ];
  assert.deepEqual(tripStats(rows), [
    { tripId: null, users: 1, views: 1, sessions: 0, lastSeen: NOON + 4 },
    { tripId: 'U', users: 1, views: 1, sessions: 0, lastSeen: NOON + 3 },
    { tripId: 'T', users: 2, views: 2, sessions: 1, lastSeen: NOON + 2 },
  ]);
});

// ── new cards (2026-09-30): return rate, visits, around the trip, platform & version ──
import { returnCohorts, sessionStats, aroundTrips, platformPerDay, versionStats, countryStats } from '../public/pulse/stats.mjs';
const D = 24 * H;

test('returnCohorts groups people by first-seen week and counts who came back', () => {
  // NOON is Wed 2026-09-30 in Berlin → cohort week starts Mon 2026-09-28.
  const rows = [
    row({ uid: 'a', at: NOON }),                 // back next day and within 7
    row({ uid: 'a', at: NOON + D }),
    row({ uid: 'b', at: NOON }),                 // back on day 5 only
    row({ uid: 'b', at: NOON + 5 * D }),
    row({ uid: 'c', at: NOON }),                 // never back
    row({ uid: 'd', at: NOON + 7 * D }),         // next week's cohort, back on day 10
    row({ uid: 'd', at: NOON + 17 * D }),
  ];
  const c = returnCohorts(rows, 'Europe/Berlin');
  assert.deepEqual(c.map(x => x.week), ['2026-09-28', '2026-10-05']);
  assert.deepEqual(c[0].uids, ['a', 'b', 'c']);
  assert.deepEqual(c[0].nextDay, ['a']);
  assert.deepEqual(c[0].within7, ['a', 'b']);
  assert.deepEqual(c[0].within14, ['a', 'b']);
  assert.deepEqual(c[1].within14, ['d']);
  assert.deepEqual(c[1].within7, []);
});

test('sessionStats buckets visits by minutes and pages seen', () => {
  const rows = [
    row({ uid: 'a', at: NOON, sessionId: 's1', type: 'session' }),
    row({ uid: 'a', at: NOON, sessionId: 's1', page: '/home' }),
    row({ uid: 'a', at: NOON + 3 * 60_000, sessionId: 's1', page: '/map' }),
    row({ uid: 'a', at: NOON + 12 * 60_000, sessionId: 's1', type: 'ping', page: '/map' }),   // 12 min, 2 pages
    row({ uid: 'b', at: NOON, sessionId: 's2', page: '/home' }),                             // 0 min, 1 page
    row({ uid: 'b', at: NOON + 40 * 60_000, sessionId: 's3', page: '/home' }),
    row({ uid: 'b', at: NOON + 75 * 60_000, sessionId: 's3', type: 'ping', page: '/home' }),  // 35 min, 1 page
  ];
  const s = sessionStats(rows);
  assert.equal(s.sessions, 3);
  assert.deepEqual(s.duration.map(b => [b.label, b.count]), [['< 1 min', 1], ['1–5 min', 0], ['5–15 min', 1], ['15–30 min', 0], ['30+ min', 1]]);
  assert.deepEqual(s.duration[2].uids, ['a']);
  assert.deepEqual(s.pages.map(b => [b.label, b.count]), [['1 page', 2], ['2 pages', 1], ['3–5 pages', 0], ['6+ pages', 0]]);
});

test('aroundTrips aligns people per day to each trip start, split before / during / after', () => {
  const trips = [{ id: 'T', startDate: '2026-10-02', endDate: '2026-10-04' }, { id: 'U', startDate: '2026-09-30', endDate: '2026-09-30' }, { id: 'X' }];
  const rows = [
    row({ uid: 'a', at: NOON, tripId: 'T' }),             // Sep 30 = day -2 of T (before)
    row({ uid: 'a', at: NOON + 2 * D, tripId: 'T' }),     // Oct 2 = day 0 (during)
    row({ uid: 'b', at: NOON + 2 * D, tripId: 'T' }),
    row({ uid: 'a', at: NOON + 6 * D, tripId: 'T' }),     // Oct 6 = day 4 (after; T is 3 days)
    row({ uid: 'a', at: NOON, tripId: 'U' }),             // day 0 of U (during)
    row({ uid: 'a', at: NOON, tripId: 'X' }),             // undated: ignored
  ];
  const a = aroundTrips(rows, trips, 'Europe/Berlin');
  const at = o => a.find(x => x.offset === o);
  assert.deepEqual([at(-2).before, at(-2).during, at(-2).after], [1, 0, 0]);
  assert.deepEqual([at(0).before, at(0).during, at(0).after], [0, 3, 0]);   // a+b on T, a on U
  assert.deepEqual([at(4).before, at(4).during, at(4).after], [0, 0, 1]);
  assert.equal(a[0].offset, -14);
  assert.equal(a.at(-1).offset, 3 - 1 + 7);   // longest trip is 3 days, plus a week after
});

test('platformPerDay and versionStats', () => {
  const rows = [
    row({ uid: 'a', at: NOON, platform: 'web', appVersion: '0.9.0' }),
    row({ uid: 'a', at: NOON + H, platform: 'web', appVersion: '0.9.0' }),
    row({ uid: 'b', at: NOON, platform: 'ios', appVersion: '0.9.1' }),
    row({ uid: 'c', at: NOON + D, platform: 'pwa', appVersion: '0.9.1' }),
  ];
  const p = platformPerDay(rows, 'Europe/Berlin');
  assert.deepEqual(p.map(d => [d.day, d.web.length, d.pwa.length, d.ios.length]), [['2026-09-30', 1, 0, 1], ['2026-10-01', 0, 1, 0]]);
  const v = versionStats(rows);
  assert.deepEqual(v.map(x => [x.version, x.uids, x.lastSeen]), [['0.9.1', ['b', 'c'], NOON + D], ['0.9.0', ['a'], NOON + H]]);
});

test('countryStats groups people by the country of the zone their phone reported', () => {
  const countryOf = tz => ({ 'Europe/Berlin': 'Germany', 'Europe/Vienna': 'Austria', 'America/Chicago': 'USA' })[tz] ?? '';
  const rows = [
    row({ uid: 'a', at: NOON, type: 'session' }),                                            // Berlin
    row({ uid: 'a', at: NOON + H, tz: 'Europe/Vienna', tzOffsetMin: 120 }),                 // moved on to Innsbruck
    row({ uid: 'b', at: NOON, type: 'session', tz: 'America/Chicago', tzOffsetMin: -300 }),
    row({ uid: 'c', at: NOON, tz: 'America/Chicago', tzOffsetMin: -300 }),
    row({ uid: 'd', at: NOON, tz: 'Mars/Olympus' }),                                         // unknown zone: skipped
  ];
  const c = countryStats(rows, countryOf);
  assert.deepEqual(c.map(x => [x.country, x.uids, x.sessions, x.zones]), [
    ['USA', ['b', 'c'], 1, ['America/Chicago']],
    ['Austria', ['a'], 0, ['Europe/Vienna']],
    ['Germany', ['a'], 1, ['Europe/Berlin']],
  ]);
});

test('pageStats folds the "/" entry route into /home', () => {
  const rows = [row({ uid: 'a', at: NOON, page: '/' }), row({ uid: 'a', at: NOON + 1, page: '/home' }), row({ uid: 'b', at: NOON, page: '/' })];
  const p = pageStats(rows);
  assert.deepEqual(p.map(x => [x.page, x.views, x.users]), [['/home', 3, 2]]);
});

import { signupsPerDay } from '../public/pulse/stats.mjs';

test('signupsPerDay counts new accounts per day in the zone, within the range', () => {
  const users = new Map([
    ['a', { createdAt: NOON }], ['b', { createdAt: NOON + 2 * H }], ['c', { createdAt: NOON + 24 * H }],
    ['old', { createdAt: NOON - 40 * 24 * H }], ['none', {}],
  ]);
  const s = signupsPerDay(users, NOON - 7 * 24 * H, NOON + 7 * 24 * H, 'Europe/Berlin');
  assert.deepEqual(s, [{ day: '2026-09-30', uids: ['a', 'b'] }, { day: '2026-10-01', uids: ['c'] }]);
});


import { activityTimeline } from '../public/pulse/stats.mjs';

test('activityTimeline merges visits and writes per day with the hover details', () => {
  const w = (uid, at, kind) => ({ uid, tripId: 'T', kind, action: 'added', at });
  const rows = [row({ uid: 'a', at: NOON, page: '/home' }), row({ uid: 'a', at: NOON + 3 * H, page: '/map', type: 'ping' }), row({ uid: 'b', at: NOON + H, page: '/home' })];
  const writes = [w('b', NOON + 2 * H, 'itinerary'), w('c', NOON - 10 * D, 'rec'), w('c', NOON - 10 * D + H, 'rec')];
  const t = activityTimeline(rows, writes, 'Europe/Berlin');
  assert.deepEqual(t.map(d => [d.day, d.uids]), [['2026-09-20', ['c']], ['2026-09-30', ['a', 'b']]]);
  const today = t[1];
  assert.deepEqual(today.pages, ['/home', '/map']);
  assert.equal(today.firstMs, NOON); assert.equal(today.lastMs, NOON + 3 * H);
  assert.deepEqual(today.writes, { total: 1, byKind: { itinerary: 1 }, byPerson: { b: { itinerary: 1 } }, uids: ['b'] });
  assert.deepEqual(today.activity, { a: 2, b: 2 });   // a: 2 events; b: 1 event + 1 edit
  // a day known only from the write log still counts its writer as active
  assert.deepEqual(t[0].writes, { total: 2, byKind: { rec: 2 }, byPerson: { c: { rec: 2 } }, uids: ['c'] });
  assert.deepEqual(t[0].pages, []);
});

test('rows outside the sliding window are left out', () => {
  const rows = [{ at: 100 }, { at: 200 }, { at: 300 }];
  assert.deepEqual(inWindow(rows, 200).map(r => r.at), [200, 300]);
});

test('stampText: a moment on the dashboard\'s clock, with or without seconds', () => {
  // 2026-09-30 19:06:05 UTC = 9:06 PM in Berlin (CEST), 2:06 PM in Chicago (CDT).
  const t = Date.UTC(2026, 8, 30, 19, 6, 5);
  assert.equal(stampText(t, 'Europe/Berlin'), 'Sep 30, 2026 at 9:06 PM');
  assert.equal(stampText(t, 'Europe/Berlin', { seconds: true }), 'Sep 30, 2026 at 9:06:05 PM');
  assert.equal(stampText(t, 'America/Chicago'), 'Sep 30, 2026 at 2:06 PM');
  // The date follows the zone, not UTC: 23:30 UTC is already Oct 1 in Berlin.
  assert.equal(stampText(Date.UTC(2026, 8, 30, 23, 30), 'Europe/Berlin'), 'Oct 1, 2026 at 1:30 AM');
});

// ── Page visits: every signed-in page, zeros included ─────────────────────────
import { pageVisits } from '../public/pulse/stats.mjs';
import { APP_PAGES, SIGNED_OUT_PAGES } from '../public/pulse/app-pages.mjs';
import { readFileSync } from 'node:fs';

test('pageVisits lists every page, busiest first, with 0 for pages nobody opened', () => {
  const pages = [{ path: '/home', label: 'Home' }, { path: '/finance', label: 'Finance' }, { path: '/outfits', label: 'Outfits' }];
  const rows = [
    row({ uid: 'a', page: '/finance' }), row({ uid: 'b', page: '/finance' }), row({ uid: 'a', page: '/finance' }),
    row({ uid: 'a', page: '/' }),                           // the entry redirect counts as Home
    row({ uid: 'a', page: '/finance', type: 'ping' }),      // pings aren't visits
  ];
  assert.deepEqual(pageVisits(rows, pages), [
    { page: '/finance', label: 'Finance', views: 3, users: 2 },
    { page: '/home',    label: 'Home',    views: 1, users: 1 },
    { page: '/outfits', label: 'Outfits', views: 0, users: 0 },
  ]);
});

test('pageVisits keeps a page that is not in the list (an old or renamed route) rather than dropping it', () => {
  const out = pageVisits([row({ uid: 'a', page: '/old-page' })], [{ path: '/home', label: 'Home' }]);
  assert.deepEqual(out.map(p => [p.page, p.views]), [['/old-page', 1], ['/home', 0]]);
});

test('pageVisits leaves out pages it is told to ignore (sign-in moments recorded on /login)', () => {
  const out = pageVisits([row({ uid: 'a', page: '/login' }), row({ uid: 'a', page: '/home' })], [{ path: '/home', label: 'Home' }], ['/login']);
  assert.deepEqual(out.map(p => [p.page, p.views]), [['/home', 1]]);
});

test('the page list matches the app routes (signed-in pages), so no page is missed', () => {
  const routes = [...readFileSync(new URL('../src/app/app.routes.ts', import.meta.url), 'utf8').matchAll(/path: '([^']*)'/g)]
    .map(m => m[1]).filter(p => p && p !== '**').map(p => '/' + p);
  const signedIn = routes.filter(p => !SIGNED_OUT_PAGES.includes(p)).sort();
  assert.deepEqual(APP_PAGES.map(p => p.path).sort(), signedIn);
});

// ── Account deletions (#452) ────────────────────────────────────────────────
test('deletionStats: newest first, days after the last trip ended, account age, inside the range only', () => {
  const day = 86_400_000;
  const at = (iso) => Date.parse(iso);
  const records = [
    { uid: 'a', at: at('2026-10-12T15:00:00Z'), accountCreatedAt: at('2026-09-01T00:00:00Z'), trips: 1, lastTripEnd: '2026-10-09' },
    { uid: 'b', at: at('2026-10-05T09:00:00Z'), accountCreatedAt: at('2026-10-04T09:00:00Z'), trips: 0, lastTripEnd: null },
    { uid: 'c', at: at('2026-10-08T12:00:00Z'), accountCreatedAt: at('2026-08-01T00:00:00Z'), trips: 2, lastTripEnd: '2026-10-09' },
    { uid: 'old', at: at('2026-01-01T00:00:00Z'), accountCreatedAt: at('2025-12-01T00:00:00Z'), trips: 1, lastTripEnd: '2025-12-20' },
  ];
  const s = deletionStats(records, at('2026-10-01T00:00:00Z'), at('2026-10-13T00:00:00Z'));
  assert.deepEqual(s.list.map(d => d.uid), ['a', 'c', 'b']);                       // newest first; 'old' is outside the range
  assert.equal(s.list[0].daysAfterTrip, 3);                                        // trip ended Oct 9 (end of day), deleted Oct 12
  assert.equal(s.list[1].daysAfterTrip, -1);                                       // deleted before the trip was over
  assert.equal(s.list[2].daysAfterTrip, null);                                     // never on a trip
  assert.equal(s.list[0].accountAgeDays, 41);
  assert.equal(s.list[2].accountAgeDays, 1);
  assert.equal(s.count, 3);
  assert.equal(s.afterTrip, 1);        // deleted after a trip ended
  assert.equal(s.duringOrBefore, 1);   // while a trip was still on or ahead
  assert.equal(s.noTrip, 1);
  assert.equal(s.medianDaysAfterTrip, 3);
  void day;
});

test('deletionStats: nothing in range gives zeros and no median', () => {
  const s = deletionStats([], 0, 1);
  assert.deepEqual(s, { list: [], count: 0, afterTrip: 0, duringOrBefore: 0, noTrip: 0, medianDaysAfterTrip: null });
});

test('waitlistStats: unique emails (case and spaces ignored), first sign-up decides the range, latest time', () => {
  const at = (iso) => Date.parse(iso);
  const entries = [
    { email: 'maya@example.com', at: at('2026-10-02T10:00:00Z') },
    { email: ' Maya@Example.com', at: at('2026-10-12T10:00:00Z') },   // the same person again, on another device
    { email: 'theo@example.com', at: at('2026-10-11T09:00:00Z') },
    { email: 'jo@example.com', at: at('2026-10-14T18:30:00Z') },
    { email: 'rafa@example.com', at: 0 },                              // no server time yet: counted, never "latest"
  ];
  const s = waitlistStats(entries, at('2026-10-10T00:00:00Z'), at('2026-10-16T00:00:00Z'));
  assert.equal(s.total, 4);
  assert.equal(s.inRange, 2);                     // theo and jo; maya first signed up before the range
  assert.equal(s.lastAt, at('2026-10-14T18:30:00Z'));
  assert.deepEqual(Object.keys(s).sort(), ['inRange', 'lastAt', 'total']); // counts only: no emails come back
  assert.deepEqual(waitlistStats([], 0, 1), { total: 0, inRange: 0, lastAt: null });
});

// #596: the usage and write logs are append-only, so Pulse keeps them on the
// device and only asks the server for what it doesn't have.
test('historyCacheUsable: a recorded, recent cache that still holds rows', () => {
  const now = NOON;
  assert.equal(historyCacheUsable(null, now, 5), false);                               // never loaded here
  assert.equal(historyCacheUsable({ from: now - 30 * 24 * H, at: now - H, n: 40 }, now, 40), true);
  assert.equal(historyCacheUsable({ from: now - 30 * 24 * H, at: now - 8 * 24 * H, n: 40 }, now, 40), false); // a week old: read it all again
  assert.equal(historyCacheUsable({ from: now - 30 * 24 * H, at: now - H, n: 40 }, now, 0), false);  // the browser cleared it
  assert.equal(historyCacheUsable({ from: now - 30 * 24 * H, at: now - H, n: 0 }, now, 0), true);    // nothing to hold yet
});

test('liveFrom: listen from a little before the newest kept row, else from the window', () => {
  const need = NOON - 24 * H;
  assert.equal(liveFrom(NOON - H, need), NOON - H - 10 * 60_000);  // overlap catches rows committed out of order
  assert.equal(liveFrom(null, need), need);
  assert.equal(liveFrom(need - H, need), need);                     // never before the window itself
});

test('backfillRange: only the older part a wider range is missing', () => {
  const loaded = NOON - 24 * H;
  assert.equal(backfillRange(loaded, NOON - 2 * H), null);          // narrower: filter what's loaded
  assert.deepEqual(backfillRange(loaded, NOON - 7 * 24 * H), [NOON - 7 * 24 * H, loaded]);
  assert.deepEqual(backfillRange(null, NOON - 7 * 24 * H), null);   // nothing loaded yet: the first load reads it
});

test('mergeRows: one row per id, oldest first', () => {
  const a = [{ id: 'x', at: 3 }, { id: 'y', at: 1 }];
  const b = [{ id: 'x', at: 3 }, { id: 'z', at: 2 }];
  assert.deepEqual(mergeRows(a, b).map(r => r.id), ['y', 'z', 'x']);
});
