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
