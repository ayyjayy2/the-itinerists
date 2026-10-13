import { parseTimeString } from './first-up';

/**
 * Start/end date pairs (trip dates, stay check-in/out, pick-up/drop-off,
 * departure/arrival): the end may not come before the start. Dates are the
 * ISO "YYYY-MM-DD" strings that <input type="date"> produces, which compare
 * correctly as plain strings. Returns '' while either side is still empty so
 * a half-filled form isn't nagged.
 */
export function dateRangeProblem(
  start: string | null | undefined,
  end: string | null | undefined,
  endLabel = 'End date',
  startLabel = 'start date',
): string {
  if (!start || !end) return '';
  return end < start ? `${endLabel} can't be before the ${startLabel}.` : '';
}

/**
 * Start/end times on the same day (an itinerary item, #412): the end must be
 * after the start. Untimed items, a start with no end and an end with no start
 * are all fine; a time the field can't read is left to the field. Overnight is
 * never guessed, so the message says what to do instead.
 */
export function timeRangeProblem(start: string | null | undefined, end: string | null | undefined): string {
  const s = parseTimeString(start ?? ''), e = parseTimeString(end ?? '');
  if (!s || !e) return '';
  return e.h * 60 + e.min <= s.h * 60 + s.min
    ? 'End time must be after the start time. For something that runs past midnight, leave the end time empty.'
    : '';
}
