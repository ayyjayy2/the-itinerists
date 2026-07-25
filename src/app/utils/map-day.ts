/**
 * Which itinerary day the home map card should show:
 * today if events exist today, otherwise the next planned day,
 * otherwise null (no upcoming events — trip over or itinerary empty).
 * Dates are YYYY-MM-DD strings, so plain string comparison sorts correctly.
 */
export function pickMapDay(itemDates: readonly string[], today: string): string | null {
  const future = [...new Set(itemDates)].filter(d => d >= today).sort();
  return future[0] ?? null;
}
