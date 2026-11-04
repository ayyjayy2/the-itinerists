/**
 * A guest who logs out (#747) stays on the trip, marked left, with everything
 * they were in. The group checks each of those expenses and plans once: this
 * finds them. Pure; Finance shows the card and the services save what's checked.
 */

/** What the group has checked for one guest who left, kept on the trip doc. */
export interface LeaverReview {
  /** Someone tapped Looks right: nothing more to check. */
  done?: boolean;
  /** Expenses and plans saved from the card. */
  checked?: string[];
}

export interface LeaverItem {
  kind: 'expense' | 'plan';
  id: string;
  title: string;
  date: string;
  /** Expenses they're in: their share, and how many it's split between (equal splits). */
  share?: number;
  currency?: string;
  ways?: number;
  /** They paid it. */
  paid?: boolean;
}

interface ExpenseLike {
  id: string; date: string; vendor?: string; description: string; amount: number; currency: string;
  paidBy: string; splitAmong: string; splits?: Record<string, number> | null;
}
interface PlanLike { id: string; date: string; activity: string; forWho: string }

const names = (list: string): string[] => list.split(',').map(s => s.trim()).filter(Boolean);

/** Everything `name` is still in, minus what's been checked: expenses first, then plans, each by date. */
export function leaverItems(name: string, everyone: readonly string[], expenses: readonly ExpenseLike[],
                            plans: readonly PlanLike[], checked: readonly string[]): LeaverItem[] {
  const done = new Set(checked);
  const byDate = (a: LeaverItem, b: LeaverItem) => a.date.localeCompare(b.date);
  const money = expenses.filter(e => !done.has(e.id)).flatMap((e): LeaverItem[] => {
    const split = e.splitAmong === 'All' ? [...everyone] : names(e.splitAmong);
    const inSplit = split.includes(name);
    const paid = e.paidBy === name;
    if (!inSplit && !paid) return [];
    const own = e.splits?.[name];
    return [{
      kind: 'expense', id: e.id, title: e.vendor || e.description, date: e.date, currency: e.currency, paid,
      ...(inSplit ? { share: own ?? e.amount / (split.length || 1), ...(own == null ? { ways: split.length } : {}) } : {}),
    }];
  });
  // Plans for everyone don't name them, so only plans that do.
  const going = plans.filter(p => !done.has(p.id) && p.forWho !== 'All' && names(p.forWho).includes(name))
    .map((p): LeaverItem => ({ kind: 'plan', id: p.id, title: p.activity, date: p.date }));
  return [...money.sort(byDate), ...going.sort(byDate)];
}

/** The card shows until someone taps Looks right or nothing is left to check. */
export function reviewOpen(review: LeaverReview | undefined, itemsLeft: number): boolean {
  return !review?.done && itemsLeft > 0;
}
