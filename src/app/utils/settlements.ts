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

type IsPaid = (from: string, to: string, itemId: string) => boolean;

/** What `from` still owes `to` in the home currency: their unpaid items only. */
export function unpaidBetween(debts: readonly DirectDebt[], from: string, to: string, isPaid: IsPaid): number {
  return debts
    .filter(d => d.from === from && d.to === to)
    .reduce((sum, d) => sum + d.items.filter(i => !isPaid(d.from, d.to, i.id)).reduce((s, i) => s + i.amount, 0), 0);
}

/**
 * What a person is still owed and still owes across everyone, before netting:
 * the working behind a netted balance ("4,940.00 − 308.00", #519).
 */
export function personTotals(debts: readonly DirectDebt[], name: string, isPaid: IsPaid): { owed: number; owes: number } {
  let owed = 0, owes = 0;
  for (const d of debts) {
    const unpaid = d.items.filter(i => !isPaid(d.from, d.to, i.id)).reduce((s, i) => s + i.amount, 0);
    if (d.to === name) owed += unpaid;
    if (d.from === name) owes += unpaid;
  }
  return { owed, owes };
}

/** One netted balance and its working: `gross − less = amountHome`. */
export interface NetLine {
  name: string;
  direction: 'owed' | 'owes' | 'settled';
  /** The netted amount, always positive (0 when settled). */
  amountHome: number;
  /** The larger side, before netting. */
  gross: number;
  /** What the other side takes off it; 0 when only one side owes. */
  less: number;
}

/** Nets what `name` is owed against what they owe (amounts in the home currency). */
export function netLine(name: string, owed: number, owes: number): NetLine {
  const net = owed - owes;
  if (net > 0.005)  return { name, direction: 'owed', amountHome: net, gross: owed, less: owes };
  if (net < -0.005) return { name, direction: 'owes', amountHome: -net, gross: owes, less: owed };
  return { name, direction: 'settled', amountHome: 0, gross: owed, less: owes };
}

/** What "they" and "you" owe, larger side first. */
const WORDS: Record<'owed' | 'owes', [string, string]> = {
  owed: ['they owe', 'you owe'],
  owes: ['you owe', 'they owe'],
};

/**
 * One amount in the working, with its currency's symbol ($10, €10, ฿4,940),
 * or its code where it has none (CHF 10). Cents only when there are some.
 */
function money(v: number, currency: string): string {
  const cents = Math.round(v * 100) % 100 !== 0;
  const digits = { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 };
  try {
    return v.toLocaleString('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...digits })
      .replace(/\u00a0/g, ' ');
  } catch {
    return `${v.toLocaleString('en-US', digits)} ${currency}`;   // not a currency code Intl knows
  }
}

/**
 * The working behind my balance with someone, as a subtraction, larger side
 * first, each amount after its label: "they owe ฿4,940 − you owe ฿308" (#519).
 * When only one side owes, the other side is shown as nothing ("you owe $0").
 * Empty when settled.
 */
export function workingText(line: NetLine, currency: string): string {
  if (line.direction === 'settled') return '';
  const [first, second] = WORDS[line.direction];
  return `${first} ${money(line.gross, currency)} − ${second} ${money(line.less, currency)}`;
}
