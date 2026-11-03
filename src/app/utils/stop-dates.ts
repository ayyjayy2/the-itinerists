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

/**
 * A whole trip's dates for headings: the short range plus the year ("Nov 12 – 19, 2026"),
 * with both years when it crosses a new year ("Dec 28, 2026 – Jan 3, 2027") (#536).
 */
export function tripDateRange(startISO: string, endISO: string): string {
  if (!startISO || !endISO) return '';
  const startYear = startISO.slice(0, 4), endYear = endISO.slice(0, 4);
  if (startYear !== endYear) return `${stopDateRange(startISO, startISO)}, ${startYear} – ${stopDateRange(endISO, endISO)}, ${endYear}`;
  return `${stopDateRange(startISO, endISO)}, ${endYear}`;
}
