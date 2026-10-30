/**
 * Open-Meteo's free forecast serves 16 days counting today, and keeps about
 * three months of past days. It counts from today's UTC date, wherever the
 * place is, and answers 400 for a start or end date outside that range (#552).
 */
const DAYS_AHEAD = 15;
const DAYS_BACK  = 92;

function utcDay(now: Date, offsetDays: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

/**
 * The part of a trip leg (YYYY-MM-DD dates) that Open-Meteo can answer for,
 * or null when none of it is in range.
 */
export function forecastRange(startDate: string, endDate: string, now: Date): { start: string; end: string } | null {
  const first = utcDay(now, -DAYS_BACK);
  const last  = utcDay(now, DAYS_AHEAD);
  const start = startDate > first ? startDate : first;
  const end   = endDate < last ? endDate : last;
  return start <= end ? { start, end } : null;
}

/** A past day's numbers settle about this many days on; only then is it saved. */
const SETTLED_AFTER_DAYS = 6;

export interface WeatherRequest { source: 'forecast' | 'history'; start: string; end: string }

/** Every YYYY-MM-DD date from start to end, both included. */
function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [y, m, d] = start.split('-').map(Number);
  for (let t = Date.UTC(y, m - 1, d); ; t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (iso > end) return out;
    out.push(iso);
  }
}

/**
 * What to ask Open-Meteo for, for one trip leg (#558): days that have passed
 * come from its history service (what the weather was), leaving out days the
 * trip has already saved; today on comes from the forecast.
 */
export function weatherRequests(startDate: string, endDate: string, now: Date, saved: ReadonlySet<string>): WeatherRequest[] {
  const requests: WeatherRequest[] = [];
  const yesterday = utcDay(now, -1);
  const pastEnd = endDate < yesterday ? endDate : yesterday;
  if (startDate <= pastEnd) {
    const missing = datesBetween(startDate, pastEnd).filter(d => !saved.has(d));
    if (missing.length) requests.push({ source: 'history', start: missing[0], end: missing[missing.length - 1] });
  }
  const today = utcDay(now, 0);
  const ahead = forecastRange(startDate > today ? startDate : today, endDate, now);
  if (ahead) requests.push({ source: 'forecast', ...ahead });
  return requests;
}

/** The fetched days to save to the trip: settled past days it doesn't have yet. */
export function daysToSave(dates: string[], saved: ReadonlySet<string>, now: Date): string[] {
  const lastSettled = utcDay(now, -SETTLED_AFTER_DAYS);
  return dates.filter(d => d <= lastSettled && !saved.has(d));
}
