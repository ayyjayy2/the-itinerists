/** Unit tests for the Pulse dashboard aggregations. Run: npm run test:pulse */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey, hourIn, startOfDay, onlineNow, usersPerHour, usersPerDay, hourOfDay, hourOfDayDetail, pageStats, peopleStats, tripStats,
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
  assert.deepEqual(detail[14], { count: 3, uids: ['a', 'b'], zones: ['America/Chicago', 'Europe/Berlin'] });
  assert.deepEqual(detail[7], { count: 0, uids: [], zones: [] });
  // On each person's own clock the bar also says which zones those hours were in.
  const own = hourOfDayDetail(rows, 'local');
  assert.deepEqual(own[14], { count: 2, uids: ['a'], zones: ['Europe/Berlin'] });
  assert.deepEqual(own[7], { count: 1, uids: ['b'], zones: ['America/Chicago'] });
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
    row({ uid: 'b', at: NOON + H, platform: 'ios', tz: 'America/Chicago', tripId: 'U' }),
  ];
  const p = peopleStats(rows, 'Europe/Berlin');
  assert.deepEqual(p.map(x => x.uid), ['a', 'b']);
  assert.deepEqual(p[0], { uid: 'a', platform: 'pwa', tz: 'Europe/Berlin', tripId: 'T', lastSeen: NOON + 24 * H + 1, views: 2, daysActive: 2, sessions: 0 });
  assert.equal(p[1].daysActive, 1);
  assert.equal(p[1].tripId, 'U');
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
