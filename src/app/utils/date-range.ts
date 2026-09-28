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
