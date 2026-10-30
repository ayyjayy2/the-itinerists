import { parseTimeString } from './first-up';

/**
 * A day's map pins, numbered 1, 2, 3… in the day's order (the Itinerary's
 * order, then time). Only places that are on the map count, so the first pin
 * is always 1; a place visited twice keeps its first number.
 */
export function numberPins(
  stops: { loc: string | null; sortOrder?: number; time?: string }[],
  onMap: (loc: string) => boolean,
): Map<string, number> {
  const minutes = (t?: string) => { const p = parseTimeString(t); return p ? p.h * 60 + p.min : Infinity; };
  const ordered = stops
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
      || minutes(a.time) - minutes(b.time) || a.i - b.i);
  const nums = new Map<string, number>();
  for (const s of ordered) {
    if (s.loc && !nums.has(s.loc) && onMap(s.loc)) nums.set(s.loc, nums.size + 1);
  }
  return nums;
}
