/**
 * Sort nav items by a user's saved path order. Items the saved order doesn't
 * know keep their default relative position, appended after the ordered ones —
 * so new pages show up even for users with an old saved order.
 */
export function applyNavOrder<T extends { path: string }>(
  items: readonly T[], order: readonly string[] | undefined,
): T[] {
  if (!order?.length) return [...items];
  const rank = new Map(order.map((p, i) => [p, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.path) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.path) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb; // Array.prototype.sort is stable: unknowns keep default order
  });
}
