/**
 * A stop's dates as short as they can be while staying unambiguous:
 * "Oct 6 – 9" within a month, "Sep 30 – Oct 3" across two, "Oct 6" for one day.
 */
export function stopDateRange(startISO: string, endISO: string): string {
  if (!startISO) return '';
  const d = (s: string) => new Date(s + 'T00:00');
  const month = (s: string) => d(s).toLocaleDateString('en-US', { month: 'short' });
  const day = (s: string) => d(s).getDate();
  if (!endISO || endISO === startISO) return `${month(startISO)} ${day(startISO)}`;
  if (startISO.slice(0, 7) === endISO.slice(0, 7)) return `${month(startISO)} ${day(startISO)} – ${day(endISO)}`;
  return `${month(startISO)} ${day(startISO)} – ${month(endISO)} ${day(endISO)}`;
}
