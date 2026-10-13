/**
 * Shared-expense splits (Finance). "All" means everyone on the trip: an equal
 * split follows the trip as people join, but individual amounts only cover
 * the people who were there when they were typed. leftOutOfSplit finds the
 * members such an expense has no amount for, so Finance can point them out
 * instead of quietly counting them as owing nothing (#447).
 */

export interface SplitShape {
  splitAmong: string;
  splits?: Record<string, number> | null;
}

/** Members an "Everyone" split with individual amounts has no amount for. An amount of 0 counts as chosen. */
export function leftOutOfSplit(entry: SplitShape, members: readonly string[]): string[] {
  if (entry.splitAmong !== 'All' || !entry.splits || !Object.keys(entry.splits).length) return [];
  return members.filter(name => !(name in entry.splits!));
}

/**
 * The split fields to save from the form. An equal split stores `splits: null`
 * so it clears any old individual amounts (an `undefined` is dropped before
 * saving and left them in place).
 */
export function splitPatch(
  mode: 'equal' | 'individual',
  selected: readonly string[],
  amounts: Record<string, number | string | null | undefined>,
  everyone: readonly string[],
): { splitAmong: string; splits: Record<string, number> | null } {
  const splitAmong = selected.length === everyone.length ? 'All' : selected.join(', ');
  if (mode === 'equal') return { splitAmong, splits: null };
  return { splitAmong, splits: Object.fromEntries(selected.map(n => [n, Number(amounts[n]) || 0])) };
}
