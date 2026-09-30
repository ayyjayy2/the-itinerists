/**
 * Settlement ("who owes who") filtering for the Finance page. Pure so the
 * Owed/Paid tab logic can be unit-tested without the component.
 */
export interface DebtItem {
  id: string;
  label: string;
  date: string;
  description?: string;
  notes?: string;
  amount: number;        // share in the home currency
  origAmount: number;    // share as entered
  origCurrency: string;
  estimated: boolean;
}

export interface DirectDebt {
  from: string;
  to:   string;
  amountHome: number;
  items: DebtItem[];
}

export interface SettlementFilter {
  me: string;
  status: 'owed' | 'paid';
  scope: 'mine' | 'all';
  /** null = everyone */
  selectedUsers: Set<string> | null;
  /** lower-cased, trimmed search text; '' = none */
  query: string;
  isPaid: (from: string, to: string, itemId: string) => boolean;
}

function matches(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q) return true;
  return fields.some(f => f?.toLowerCase().includes(q));
}

export function filterSettlements(debts: readonly DirectDebt[], f: SettlementFilter): DirectDebt[] {
  const { me, status, scope, selectedUsers, query: q, isPaid } = f;
  return debts
    .filter(d => scope === 'mine' ? d.from === me || d.to === me : true)
    .filter(d => selectedUsers === null || selectedUsers.has(d.from) || selectedUsers.has(d.to))
    .flatMap(d => {
      // Each tab shows the items in its state. A pair that is partly paid
      // appears on both tabs, each with its own slice — a paid item must
      // always be findable somewhere.
      const wantPaid = status === 'paid';
      const items = d.items.filter(item => isPaid(d.from, d.to, item.id) === wantPaid);
      if (!items.length) return [];
      if (q) {
        const nameMatch  = matches(q, d.from, d.to);
        const itemsMatch = items.filter(item => matches(q, item.label, item.description, item.notes));
        if (!nameMatch && itemsMatch.length === 0) return [];
        const visible    = nameMatch ? items : itemsMatch;
        return [{ ...d, items: visible, amountHome: visible.reduce((s, i) => s + i.amount, 0) }];
      }
      return [{ ...d, items, amountHome: items.reduce((s, i) => s + i.amount, 0) }];
    });
}
