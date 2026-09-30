import { usagePage, usagePlatform, localClock } from './usage';

describe('usagePage', () => {
  it('keeps the path and drops query strings and fragments', () => {
    expect(usagePage('/itinerary')).toBe('/itinerary');
    expect(usagePage('/get-started?mode=code')).toBe('/get-started');
    expect(usagePage('/join?code=ABC123')).toBe('/join');
    expect(usagePage('/finance#totals')).toBe('/finance');
  });

  it('normalises the root and trailing slashes', () => {
    expect(usagePage('')).toBe('/');
    expect(usagePage('/')).toBe('/');
    expect(usagePage('/trips/')).toBe('/trips');
    expect(usagePage('/trips/new')).toBe('/trips/new');
  });
});

describe('usagePlatform', () => {
  it('reports the Capacitor shell as ios', () => {
    expect(usagePlatform(true, true)).toBe('ios');
    expect(usagePlatform(true, false)).toBe('ios');
  });

  it('reports an installed web app as pwa and a browser tab as web', () => {
    expect(usagePlatform(false, true)).toBe('pwa');
    expect(usagePlatform(false, false)).toBe('web');
  });
});

describe('localClock', () => {
  it('reads the hour and offset from the user\'s clock', () => {
    const d = new Date(2026, 8, 30, 14, 5); // 14:05 local, whatever the zone
    const c = localClock(d, 'Europe/Berlin');
    expect(c.localHour).toBe(14);
    expect(c.tz).toBe('Europe/Berlin');
    expect(c.tzOffsetMin).toBe(-d.getTimezoneOffset());
  });

  it('falls back to UTC when the zone is unknown', () => {
    expect(localClock(new Date(), '').tz).toBe('UTC');
    expect(localClock(new Date(), undefined).tz).toBe('UTC');
  });
});
