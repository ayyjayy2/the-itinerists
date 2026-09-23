/**
 * Grouping for the Recs page: by category, and — on multi-destination trips —
 * by destination first, with categories inside each destination section.
 */

/** Section label for recs that aren't tied to one leg of the trip. */
export const ANYWHERE = 'Anywhere';

export interface CategoryGroup<T> { category: string; recs: T[] }
export interface DestinationSection<T> { destination: string; groups: CategoryGroup<T>[] }

/** Groups by category: known categories in `order`, then custom ones alphabetically. */
export function groupRecsByCategory<T extends { category: string }>(
  recs: readonly T[], order: readonly string[],
): CategoryGroup<T>[] {
  const byCat = new Map<string, T[]>();
  for (const r of recs) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }
  const rank = (c: string) => { const i = order.indexOf(c); return i === -1 ? Infinity : i; };
  return [...byCat.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, recs]) => ({ category, recs }));
}

const key = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Sections in leg order for legs that have recs, then an "Anywhere" section
 * for recs with no destination or one that no longer matches a leg.
 */
export function groupRecsByDestination<T extends { category: string; destination?: string }>(
  recs: readonly T[], legs: readonly string[], categoryOrder: readonly string[],
): DestinationSection<T>[] {
  const byLeg = new Map<string, T[]>(legs.map(l => [key(l), []]));
  const anywhere: T[] = [];
  for (const r of recs) {
    const bucket = byLeg.get(key(r.destination));
    (bucket ?? anywhere).push(r);
  }
  const sections: DestinationSection<T>[] = [];
  for (const leg of legs) {
    const legRecs = byLeg.get(key(leg))!;
    if (legRecs.length) sections.push({ destination: leg, groups: groupRecsByCategory(legRecs, categoryOrder) });
  }
  if (anywhere.length) sections.push({ destination: ANYWHERE, groups: groupRecsByCategory(anywhere, categoryOrder) });
  return sections;
}
