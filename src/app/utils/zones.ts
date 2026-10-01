/**
 * Time zone arithmetic on top of Intl, no library. Trip times are wall-clock
 * times somewhere else (the destination, an airport), while the phone's clock
 * is wherever the person is. Everything that compares a trip time with "now"
 * goes through here.
 */

/** The phone's own zone, e.g. "America/Chicago". */
export function deviceZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    partsCache.set(zone, f);
  }
  return f;
}

/** Wall-clock parts of a UTC instant in `zone`. */
export function wallClockIn(zone: string, utcMs: number): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of formatter(zone).formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p['year'], m: p['month'], d: p['day'], h: p['hour'] === 24 ? 0 : p['hour'], min: p['minute'], s: p['second'] };
}

/** Minutes east of UTC that `zone` is at the given instant (Lisbon in October: +60). */
export function utcOffsetMinutes(zone: string, utcMs: number): number {
  const w = wallClockIn(zone, utcMs);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** The instant at which the wall clock in `zone` reads date + h:min. */
export function wallToUtcMs(dateISO: string, h: number, min: number, zone: string): number {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, min);
  let utc = guess - utcOffsetMinutes(zone, guess) * 60_000;
  const second = guess - utcOffsetMinutes(zone, utc) * 60_000;   // settles across a DST edge
  if (second !== utc) utc = second;
  return utc;
}

/** Today's YYYY-MM-DD as the clock in `zone` sees it. */
export function todayISOInZone(zone: string, utcMs: number = Date.now()): string {
  const w = wallClockIn(zone, utcMs);
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/** "WEST", "EDT", "CEST"; falls back to "GMT+1" where English has no name for it. */
export function zoneAbbr(zone: string, utcMs: number = Date.now()): string {
  const at = new Date(utcMs);
  const abbr = (locale: string) => {
    try { return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''; }
    catch { return ''; }
  };
  const named = ['en-US', 'en-GB', 'en-AU'].map(abbr).find(a => a && !/^(GMT|UTC)/.test(a));
  return named || abbr('en-US') || zone;
}

/** The abbreviation when `zone` differs from the phone's clock, else "" (no label needed at home). */
export function zoneLabelIfForeign(zone: string | undefined, utcMs: number = Date.now()): string {
  if (!zone) return '';
  const here = deviceZone();
  if (zone === here) return '';
  return utcOffsetMinutes(zone, utcMs) === utcOffsetMinutes(here, utcMs) ? '' : zoneAbbr(zone, utcMs);
}
