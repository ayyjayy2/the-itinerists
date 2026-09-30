import {
  UsageRow, dayKey, hourIn, onlineNow, usersPerHour, usersPerDay, hourOfDay, pageStats, peopleStats,
} from './usage-stats';

const H = 3_600_000;
// 2026-09-30 12:00:00 UTC = 14:00 in Berlin, 07:00 in Chicago.
const NOON = Date.UTC(2026, 8, 30, 12, 0, 0);

function row(o: Partial<UsageRow> & { uid: string; at: number }): UsageRow {
  return {
    tripId: 'T', type: 'page', page: '/home', localHour: 14, tz: 'Europe/Berlin', tzOffsetMin: 120,
    platform: 'web', sessionId: 's', appVersion: '0.9.0', ...o,
  };
}

describe('dayKey / hourIn', () => {
  it('reads the calendar day and hour in a zone', () => {
    expect(dayKey(NOON, 'Europe/Berlin')).toBe('2026-09-30');
    expect(hourIn(NOON, 'Europe/Berlin')).toBe(14);
    expect(hourIn(NOON, 'America/Chicago')).toBe(7);
    // 23:30 UTC is already the next day in Berlin.
    expect(dayKey(Date.UTC(2026, 8, 30, 23, 30), 'Europe/Berlin')).toBe('2026-10-01');
    expect(hourIn(Date.UTC(2026, 8, 30, 23, 30), 'Europe/Berlin')).toBe(1);
  });
});

describe('onlineNow', () => {
  it('lists each user once, by their latest event inside the window', () => {
    const rows = [
      row({ uid: 'a', at: NOON - 10 * 60_000, page: '/home' }),
      row({ uid: 'a', at: NOON - 60_000, page: '/finance', type: 'ping' }),
      row({ uid: 'b', at: NOON - 5 * 60_000, page: '/map' }),
      row({ uid: 'c', at: NOON - 7 * 60_000, page: '/home' }),
    ];
    const online = onlineNow(rows, NOON, 6 * 60_000);
    expect(online.map(o => o.uid)).toEqual(['a', 'b']);
    expect(online[0].page).toBe('/finance');
    expect(online[0].lastSeen).toBe(NOON - 60_000);
  });
});

describe('usersPerHour', () => {
  it('counts distinct users in each clock hour of the window', () => {
    const rows = [
      row({ uid: 'a', at: NOON + 5 * 60_000 }),
      row({ uid: 'a', at: NOON + 20 * 60_000, type: 'ping' }),
      row({ uid: 'b', at: NOON + 30 * 60_000 }),
      row({ uid: 'b', at: NOON + H + 10 * 60_000 }),
    ];
    const buckets = usersPerHour(rows, NOON, NOON + 3 * H, 'Europe/Berlin');
    expect(buckets.length).toBe(3);
    expect(buckets.map(b => b.users)).toEqual([2, 1, 0]);
    expect(buckets[0].start).toBe(NOON);
    expect(buckets[0].label).toBe('14:00');
  });

  it('aligns the first bucket to the hour', () => {
    const buckets = usersPerHour([], NOON + 25 * 60_000, NOON + 2 * H, 'UTC');
    expect(buckets[0].start).toBe(NOON);
    expect(buckets.length).toBe(2);
  });
});

describe('usersPerDay', () => {
  it('counts distinct users per calendar day in the display zone', () => {
    const rows = [
      row({ uid: 'a', at: NOON }),
      row({ uid: 'b', at: NOON + H }),
      row({ uid: 'a', at: Date.UTC(2026, 8, 30, 23, 30) }), // Oct 1 in Berlin, Sep 30 in UTC
    ];
    expect(usersPerDay(rows, 'Europe/Berlin')).toEqual([
      { day: '2026-09-30', users: 2 },
      { day: '2026-10-01', users: 1 },
    ]);
    expect(usersPerDay(rows, 'UTC')).toEqual([{ day: '2026-09-30', users: 2 }]);
  });
});

describe('hourOfDay', () => {
  const rows = [
    row({ uid: 'a', at: NOON, localHour: 14, tz: 'Europe/Berlin', tzOffsetMin: 120 }),
    row({ uid: 'a', at: NOON + 10 * 60_000, localHour: 14, tz: 'Europe/Berlin', tzOffsetMin: 120 }),
    row({ uid: 'b', at: NOON, localHour: 7, tz: 'America/Chicago', tzOffsetMin: -300 }),
    row({ uid: 'a', at: NOON + 24 * H, localHour: 14, tz: 'Europe/Berlin', tzOffsetMin: 120 }),
  ];

  it('in local mode uses each person\'s own clock and counts a user once per hour per day', () => {
    const h = hourOfDay(rows, 'local');
    expect(h.length).toBe(24);
    expect(h[14]).toBe(2); // a on two different days
    expect(h[7]).toBe(1);  // b
    expect(h.reduce((s, n) => s + n, 0)).toBe(3);
  });

  it('in a fixed zone converts everyone to that zone', () => {
    const h = hourOfDay(rows, 'Europe/Berlin');
    expect(h[14]).toBe(3); // a twice (two days) + b once, all at 14:00 Berlin
    expect(h[7]).toBe(0);
  });
});

describe('pageStats', () => {
  it('counts page views and the distinct people on each page, busiest first', () => {
    const rows = [
      row({ uid: 'a', at: NOON, page: '/home' }),
      row({ uid: 'a', at: NOON + 1, page: '/home', type: 'ping' }),
      row({ uid: 'b', at: NOON + 2, page: '/home' }),
      row({ uid: 'b', at: NOON + 3, page: '/map' }),
      row({ uid: 'b', at: NOON + 4, page: '/map' }),
      row({ uid: 'b', at: NOON + 5, page: '/map' }),
      row({ uid: 'c', at: NOON + 6, page: '/login', type: 'session' }),
    ];
    expect(pageStats(rows)).toEqual([
      { page: '/map', views: 3, users: 1 },
      { page: '/home', views: 2, users: 2 },
      { page: '/login', views: 0, users: 1 },
    ]);
  });
});

describe('peopleStats', () => {
  it('summarises each person, most recently seen first', () => {
    const rows = [
      row({ uid: 'a', at: NOON, platform: 'web' }),
      row({ uid: 'a', at: NOON + 24 * H, platform: 'pwa', tz: 'Europe/Berlin' }),
      row({ uid: 'a', at: NOON + 24 * H + 1, type: 'ping', platform: 'pwa' }),
      row({ uid: 'b', at: NOON + H, platform: 'ios', tz: 'America/Chicago' }),
    ];
    const people = peopleStats(rows, 'Europe/Berlin');
    expect(people.map(p => p.uid)).toEqual(['a', 'b']);
    expect(people[0]).toEqual({ uid: 'a', platform: 'pwa', tz: 'Europe/Berlin', lastSeen: NOON + 24 * H + 1, views: 2, daysActive: 2, sessions: 0 });
    expect(people[1].daysActive).toBe(1);
    expect(people[1].platform).toBe('ios');
  });
});
