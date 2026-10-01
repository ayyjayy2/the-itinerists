import { utcOffsetMinutes, wallToUtcMs, todayISOInZone, zoneAbbr, wallClockIn } from './zones';

describe('zones', () => {
  // 2026-10-01 16:35 UTC: 11:35 in Chicago (CDT), 17:35 in Lisbon (WEST), 18:35 in Berlin (CEST).
  const T = Date.UTC(2026, 9, 1, 16, 35);

  it('knows each zone\'s offset at an instant', () => {
    expect(utcOffsetMinutes('America/Chicago', T)).toBe(-300);
    expect(utcOffsetMinutes('Europe/Lisbon', T)).toBe(60);
    expect(utcOffsetMinutes('Europe/Berlin', T)).toBe(120);
    expect(utcOffsetMinutes('Asia/Tokyo', T)).toBe(540);
  });

  it('turns a wall-clock time in a zone into the right instant', () => {
    // 10:30 in Lisbon on Oct 1 is 09:30 UTC; 9:45 PM in New York on Sep 30 is 01:45 UTC Oct 1.
    expect(wallToUtcMs('2026-10-01', 10, 30, 'Europe/Lisbon')).toBe(Date.UTC(2026, 9, 1, 9, 30));
    expect(wallToUtcMs('2026-09-30', 21, 45, 'America/New_York')).toBe(Date.UTC(2026, 9, 1, 1, 45));
    // so that flight (JFK 9:45 PM → LIS 10:30 AM) is in the air at 05:00 UTC
    const dep = wallToUtcMs('2026-09-30', 21, 45, 'America/New_York'), arr = wallToUtcMs('2026-10-01', 10, 30, 'Europe/Lisbon');
    const t = Date.UTC(2026, 9, 1, 5, 0);
    expect(dep <= t && t < arr).toBeTrue();
    expect((arr - dep) / 3_600_000).toBeCloseTo(7.75, 2);
  });

  it('handles the daylight-saving edge', () => {
    // Europe/Berlin falls back on 2026-10-25 at 03:00 → 02:00. 01:30 is unambiguous (CEST), 04:00 is CET.
    expect(wallToUtcMs('2026-10-25', 1, 30, 'Europe/Berlin')).toBe(Date.UTC(2026, 9, 24, 23, 30));
    expect(wallToUtcMs('2026-10-25', 4, 0, 'Europe/Berlin')).toBe(Date.UTC(2026, 9, 25, 3, 0));
  });

  it('reads today and the wall clock in a zone', () => {
    const late = Date.UTC(2026, 9, 1, 23, 30); // 18:30 in Chicago, already Oct 2 in Tokyo
    expect(todayISOInZone('America/Chicago', late)).toBe('2026-10-01');
    expect(todayISOInZone('Asia/Tokyo', late)).toBe('2026-10-02');
    expect(wallClockIn('Europe/Lisbon', T)).toEqual(jasmine.objectContaining({ h: 17, min: 35 }));
  });

  it('names zones the way people write them', () => {
    expect(zoneAbbr('America/Chicago', T)).toBe('CDT');
    expect(zoneAbbr('Europe/Lisbon', T)).toBe('WEST');
    expect(zoneAbbr('Europe/Berlin', T)).toBe('CEST');
    expect(zoneAbbr('America/New_York', T)).toBe('EDT');
    expect(zoneAbbr('Europe/London', T)).toBe('BST');
  });

  it('always has a code, never a bare offset, for places English locale data leaves out', () => {
    expect(zoneAbbr('Asia/Bangkok', T)).toBe('ICT');
    expect(zoneAbbr('Asia/Tokyo', T)).toBe('JST');
    expect(zoneAbbr('Asia/Seoul', T)).toBe('KST');
    expect(zoneAbbr('Asia/Jakarta', T)).toBe('WIB');
    expect(zoneAbbr('Asia/Makassar', T)).toBe('WITA');
    expect(zoneAbbr('America/Sao_Paulo', T)).toBe('BRT');
    expect(zoneAbbr('Europe/Moscow', T)).toBe('MSK');
    expect(zoneAbbr('Africa/Abidjan', T)).toBe('GMT');
    expect(zoneAbbr('Europe/Jersey', T)).toBe('BST');
    for (const z of Intl.supportedValuesOf('timeZone')) {
      expect(zoneAbbr(z, T)).withContext(z).not.toMatch(/^(GMT|UTC)[+\-]\d/);
    }
  });
});
