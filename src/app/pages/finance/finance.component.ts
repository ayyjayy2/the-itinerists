import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';
import { FinanceEntry, TripUser, ALL_CURRENCIES, DEFAULT_RATES, ExchangeRates, CurrencyConfig } from '../../models/trip.models';

interface DirectDebt {
  from: string;
  to: string;
  amountEur: number;
  items: Array<{ label: string; date: string; description: string; notes?: string; amount: number; currency: string; symbol: string }>;
}

const RATES_KEY        = 'ireland_fx_rates';
const PREFS_KEY_PREFIX = 'ireland_currency_prefs_';
const ARIELLE: TripUser = { name: 'Arielle', color: '#B5D5F5', avatarEmoji: '🌙' };
const STINKY:  TripUser = { name: 'Stinky',  color: '#C8E6C9', avatarEmoji: '🦨' };

@Component({
  selector: 'app-finance',
  imports: [CommonModule, FormsModule],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.scss'
})
export class FinanceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('addBtnRef') addBtnRef!: ElementRef<HTMLButtonElement>;
  showFab = signal(false);
  private _fabObserver?: IntersectionObserver;
  dataService = inject(DataService);
  userService = inject(UserService);

  currentUser = this.userService.currentUser;

  /** Finance keeps Arielle and Stinky (Graham) even though they're removed from other pages */
  financeUsers = computed((): TripUser[] => {
    const u = this.dataService.data()?.users ?? [];
    const withArielle = u.some(x => x.name === 'Arielle') ? u : [...u, ARIELLE];
    return withArielle.some(x => x.name === 'Stinky') ? withArielle : [...withArielle, STINKY];
  });

  // ── Currency ──────────────────────────────────────────────────────────────────
  allCurrencies     = ALL_CURRENCIES;
  enabledOptional   = signal<Set<string>>(this.loadPrefs());
  rates             = signal<ExchangeRates>(this.loadRates());
  showCurrencyPanel = signal(false);
  showRateEditor    = signal(false);
  rateForm          = { ...this.loadRates() };

  activeCurrencies = computed((): CurrencyConfig[] =>
    this.allCurrencies.filter(c => this.enabledOptional().has(c.code))
  );

  isCurrencyEnabled(code: string): boolean { return this.enabledOptional().has(code); }

  toggleCurrency(code: string): void {
    const s = new Set(this.enabledOptional());
    if (s.has(code)) { if (s.size <= 1) return; s.delete(code); } else { s.add(code); }
    this.enabledOptional.set(s);
    this.savePrefs(s);
  }

  // ── View state ────────────────────────────────────────────────────────────────
  settlementsStatus = signal<'owed' | 'paid'>('owed');
  settlementsScope  = signal<'mine' | 'all'>('mine');
  expandedDebt      = signal<string | null>(null);
  showExpenses      = signal(false);

  // ── User filter ───────────────────────────────────────────────────────────────
  /** null = all users shown. Set = explicit selection (empty Set = nobody). */
  selectedUsers = signal<Set<string> | null>(null);

  isAllPeopleSelected(): boolean { return this.selectedUsers() === null; }

  isUserSelected(name: string): boolean {
    const s = this.selectedUsers();
    return s === null || s.has(name);
  }

  toggleAllPeople(): void {
    this.selectedUsers.set(this.selectedUsers() === null ? new Set() : null);
  }

  toggleUserFilter(name: string): void {
    const allNames = this.financeUsers().map(u => u.name);
    const current  = this.selectedUsers();
    const base     = current === null ? new Set(allNames) : new Set(current);
    if (base.has(name)) { base.delete(name); } else { base.add(name); }
    this.selectedUsers.set(base.size === allNames.length ? null : base);
  }

  clearUserFilter(): void { this.selectedUsers.set(null); }

  showUserDropdown = signal(false);

  userFilterLabel = computed(() => {
    const s = this.selectedUsers();
    if (s === null) return 'All people';
    if (s.size === 0) return 'Select person...';
    if (s.size === 1) return [...s][0];
    return `${s.size} selected`;
  });

  // ── Currency math ─────────────────────────────────────────────────────────────
  toEur(amount: number, currency: string): number {
    return amount / ((this.rates() as any)[currency] ?? 1);
  }
  fromEur(eurAmount: number, targetCode: string): number {
    return eurAmount * ((this.rates() as any)[targetCode] ?? 1);
  }
  convert(amount: number, from: string, to: string): number {
    return from === to ? amount : this.fromEur(this.toEur(amount, from), to);
  }

  // ── Core data ─────────────────────────────────────────────────────────────────
  entries = computed(() => this.dataService.data()?.finance ?? []);

  directDebts = computed((): DirectDebt[] => {
    if (!this.dataService.data()) return [];
    const userNames = this.financeUsers().map(u => u.name);
    const map = new Map<string, DirectDebt>();

    for (const e of this.entries()) {
      if (!e.amount || e.amount <= 0) continue;
      const splitNames = (e.splitAmong === 'All'
        ? userNames
        : e.splitAmong.split(',').map(s => s.trim())
      ).filter(Boolean);
      if (!splitNames.length) continue;

      const symbol = this.allCurrencies.find(c => c.code === e.currency)?.symbol ?? '$';

      for (const debtor of splitNames) {
        if (debtor === e.paidBy) continue;
        const shareNative = e.splits ? (e.splits[debtor] ?? 0) : e.amount / splitNames.length;
        const shareEur    = this.toEur(shareNative, e.currency);
        const key = `${debtor}__${e.paidBy}`;
        if (!map.has(key)) map.set(key, { from: debtor, to: e.paidBy, amountEur: 0, items: [] });
        const d = map.get(key)!;
        d.amountEur += shareEur;
        d.items.push({ label: e.vendor || e.description, date: e.date, description: e.description, notes: e.notes, amount: shareNative, currency: e.currency, symbol });
      }
    }

    const result = [...map.values()].filter(d => d.amountEur > 0.005);

    // TEMP DEBUG — remove after diagnosing Dad↔Alayna discrepancy
    const dadAlayna = result.filter(d =>
      (d.from === 'Dad' && d.to === 'Alayna') || (d.from === 'Alayna' && d.to === 'Dad')
    );
    if (dadAlayna.length) {
      console.group('[Finance Debug] Dad ↔ Alayna direct debts');
      for (const d of dadAlayna) {
        console.log(`${d.from} → ${d.to}:`);
        for (const item of d.items) {
          console.log(`  ${item.date} | ${item.description} | ${item.symbol}${item.amount.toFixed(2)} ${item.currency} | paid=${this.isItemPaid(d.from, d.to, item.date, item.description)}`);
        }
      }
      console.groupEnd();
    } else {
      console.log('[Finance Debug] No Dad ↔ Alayna debts found');
    }

    return result;
  });

  /** Net of UNPAID items: positive = still owed TO you, negative = you still OWE */
  remainingBalanceEur = computed(() => {
    const me = this.currentUser()?.name ?? '';
    if (!me) return 0;
    return this.directDebts().reduce((sum, d) => {
      const unpaidEur = d.items
        .filter(item => !this.isItemPaid(d.from, d.to, item.date, item.description))
        .reduce((s, item) => s + this.toEur(item.amount, item.currency), 0);
      if (d.to === me)   return sum + unpaidEur;
      if (d.from === me) return sum - unpaidEur;
      return sum;
    }, 0);
  });

  /**
   * Per-person net breakdown (unpaid only).
   * Nets mutual debts: if Linda owes me $50 and I owe Linda $20, net = Linda owes me $30.
   * owed  = people who net-owe me
   * owing = people I net-owe
   */
  personNetBreakdown = computed((): {
    owed:  Array<{ name: string; amountEur: number }>;
    owing: Array<{ name: string; amountEur: number }>;
  } => {
    const me = this.currentUser()?.name ?? '';
    if (!me) return { owed: [], owing: [] };

    const others = new Set<string>();
    for (const d of this.directDebts()) {
      const hasUnpaid = d.items.some(item => !this.isItemPaid(d.from, d.to, item.date, item.description));
      if (!hasUnpaid) continue;
      if (d.from === me) others.add(d.to);
      if (d.to   === me) others.add(d.from);
    }

    const owed:  Array<{ name: string; amountEur: number }> = [];
    const owing: Array<{ name: string; amountEur: number }> = [];

    for (const other of others) {
      const unpaidItems = (from: string, to: string) =>
        this.directDebts()
          .filter(d => d.from === from && d.to === to)
          .flatMap(d => d.items.filter(item => !this.isItemPaid(d.from, d.to, item.date, item.description)))
          .reduce((s, item) => s + this.toEur(item.amount, item.currency), 0);

      const net = unpaidItems(other, me) - unpaidItems(me, other);
      if      (net >  0.005) owed .push({ name: other, amountEur:  net });
      else if (net < -0.005) owing.push({ name: other, amountEur: -net });
    }

    return { owed, owing };
  });

  totalOwedToMeEur = computed(() =>
    this.personNetBreakdown().owed .reduce((s, p) => s + p.amountEur, 0)
  );
  totalIOweEur = computed(() =>
    this.personNetBreakdown().owing.reduce((s, p) => s + p.amountEur, 0)
  );

  toast = signal<string | null>(null);
  private _toastTimer?: ReturnType<typeof setTimeout>;

  showToast(message: string): void {
    clearTimeout(this._toastTimer);
    this.toast.set(message);
    this._toastTimer = setTimeout(() => this.toast.set(null), 3000);
  }

  showGroupSummary  = signal(false);
  expandedGroupUsers = signal<Set<string>>(new Set());

  toggleGroupUser(name: string): void {
    const s = new Set(this.expandedGroupUsers());
    s.has(name) ? s.delete(name) : s.add(name);
    this.expandedGroupUsers.set(s);
  }

  /** Net unpaid balance for every user. Positive = owed to them, negative = they owe. */
  allUsersNetBalance = computed((): Array<{ name: string; emoji: string; amountEur: number }> =>
    this.financeUsers().map(u => {
      const net = this.directDebts().reduce((sum, d) => {
        const unpaidEur = d.items
          .filter(item => !this.isItemPaid(d.from, d.to, item.date, item.description))
          .reduce((s, item) => s + this.toEur(item.amount, item.currency), 0);
        if (d.to   === u.name) return sum + unpaidEur;
        if (d.from === u.name) return sum - unpaidEur;
        return sum;
      }, 0);
      return { name: u.name, emoji: u.avatarEmoji, amountEur: net };
    })
  );

  /** Per-counterpart net breakdown for any given user (unpaid only). */
  userDebtDetails(name: string): Array<{ counterpart: string; emoji: string; amountEur: number; direction: 'owes' | 'owed' }> {
    const details: Array<{ counterpart: string; emoji: string; amountEur: number; direction: 'owes' | 'owed' }> = [];
    for (const u of this.financeUsers()) {
      if (u.name === name) continue;
      const unpaid = (from: string, to: string) =>
        this.directDebts()
          .filter(d => d.from === from && d.to === to)
          .reduce((sum, d) => sum + d.items
            .filter(item => !this.isItemPaid(d.from, d.to, item.date, item.description))
            .reduce((s, item) => s + this.toEur(item.amount, item.currency), 0), 0);
      const net = unpaid(u.name, name) - unpaid(name, u.name);
      if      (net >  0.005) details.push({ counterpart: u.name, emoji: u.avatarEmoji, amountEur:  net, direction: 'owed' });
      else if (net < -0.005) details.push({ counterpart: u.name, emoji: u.avatarEmoji, amountEur: -net, direction: 'owes' });
    }
    return details;
  }

  /** Net of PAID items: positive = net received, negative = net paid out */
  paidBalanceEur = computed(() => {
    const me = this.currentUser()?.name ?? '';
    if (!me) return 0;
    return this.directDebts().reduce((sum, d) => {
      const paidEur = d.items
        .filter(item => this.isItemPaid(d.from, d.to, item.date, item.description))
        .reduce((s, item) => s + this.toEur(item.amount, item.currency), 0);
      if (d.to === me)   return sum + paidEur;
      if (d.from === me) return sum - paidEur;
      return sum;
    }, 0);
  });

  searchQuery = signal('');

  private matchesSearch(q: string, ...fields: (string | undefined)[]): boolean {
    if (!q) return true;
    return fields.some(f => f?.toLowerCase().includes(q));
  }

  filteredSettlementItems = computed(() => {
    const me       = this.currentUser()?.name ?? '';
    const status   = this.settlementsStatus();
    const scope    = this.settlementsScope();
    const selUsers = this.selectedUsers();
    const q        = this.searchQuery().trim().toLowerCase();

    return this.directDebts()
      .filter(d => scope === 'mine' ? d.from === me || d.to === me : true)
      .filter(d => selUsers === null || selUsers.has(d.from) || selUsers.has(d.to))
      .flatMap(d => {
        const fullyPaid = this.isSettlementFullyPaid(d);
        if (status === 'paid' && !fullyPaid) return [];
        if (status === 'owed' && fullyPaid)  return [];
        const items = status === 'owed'
          ? d.items.filter(item => !this.isItemPaid(d.from, d.to, item.date, item.description))
          : d.items;
        if (q) {
          const nameMatch  = this.matchesSearch(q, d.from, d.to);
          const itemsMatch = items.filter(item => this.matchesSearch(q, item.label, item.description, item.notes));
          if (!nameMatch && itemsMatch.length === 0) return [];
          // Name match → show all items; item match → show only matching items
          const visibleItems = nameMatch ? items : itemsMatch;
          const amountEur = visibleItems.reduce((sum, item) => sum + this.toEur(item.amount, item.currency), 0);
          return [{ ...d, items: visibleItems, amountEur }];
        }
        const amountEur = items.reduce((sum, item) => sum + this.toEur(item.amount, item.currency), 0);
        return [{ ...d, items, amountEur }];
      });
  });

  // ── Paid tracking ─────────────────────────────────────────────────────────────
  settlementItemKey(from: string, to: string, date: string, desc: string): string {
    return `${from}__${to}__${date}__${desc}`;
  }
  isItemPaid(from: string, to: string, date: string, desc: string): boolean {
    return this.dataService.paidItems().has(this.settlementItemKey(from, to, date, desc));
  }
  toggleItemPaid(from: string, to: string, date: string, desc: string): void {
    this.dataService.togglePaidItem(this.settlementItemKey(from, to, date, desc));
  }
  isSettlementFullyPaid(d: DirectDebt): boolean {
    return d.items.length > 0 && d.items.every(item => this.isItemPaid(d.from, d.to, item.date, item.description));
  }

  // ── Debt accordion ────────────────────────────────────────────────────────────
  debtKey(d: DirectDebt): string { return `${d.from}__${d.to}`; }
  isExpanded(d: DirectDebt): boolean { return this.expandedDebt() === this.debtKey(d); }
  toggleDebt(d: DirectDebt): void {
    const k = this.debtKey(d);
    this.expandedDebt.set(this.expandedDebt() === k ? null : k);
  }

  // ── User lookup ───────────────────────────────────────────────────────────────
  getUserColor(name: string): string {
    return this.financeUsers().find(u => u.name === name)?.color ?? '#E2EDE8';
  }
  getUserEmoji(name: string): string {
    return this.financeUsers().find(u => u.name === name)?.avatarEmoji ?? '👤';
  }

  // ── Expense log ───────────────────────────────────────────────────────────────
  enrichedEntries = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const userNames = this.financeUsers().map(u => u.name);
    return this.entries()
      .filter(e => !q || this.matchesSearch(q, e.vendor, e.description, e.paidBy, e.category, e.notes))
      .map(e => {
        const split        = e.splitAmong === 'All' ? userNames : e.splitAmong.split(',').map(s => s.trim()).filter(Boolean);
        const ppCount      = split.length || 1;
        const isIndivSplit = !!e.splits && Object.keys(e.splits).length > 0;
        const nativeSym    = this.allCurrencies.find(c => c.code === e.currency)?.symbol ?? '$';
        return { ...e, ppCount, ppAmount: e.amount / ppCount, isIndivSplit, nativeSymbol: nativeSym };
      });
  });

  /** Per-currency totals for the visible expense log rows (respects search). */
  expenseTotals = computed(() => {
    const byCode = new Map<string, number>();
    for (const e of this.enrichedEntries()) {
      byCode.set(e.currency, (byCode.get(e.currency) ?? 0) + e.amount);
    }
    return [...byCode.entries()].map(([code, total]) => ({
      code,
      total,
      symbol: this.allCurrencies.find(c => c.code === code)?.symbol ?? '',
    }));
  });

  /** Total trip spend in EUR equivalent (visible rows). */
  expenseTotalEur = computed(() =>
    this.enrichedEntries().reduce((sum, e) => sum + this.toEur(e.amount, e.currency), 0)
  );

  // ── Add expense ───────────────────────────────────────────────────────────────
  showAddForm       = signal(false);
  addFormSubmitted  = signal(false);
  newEntry: Partial<FinanceEntry> = {};
  addSplitMap: Record<string, boolean> = {};
  splitMode      = signal<'equal' | 'individual'>('equal');
  addIndivSplits: Record<string, number | null | undefined> = {};

  get addIndivTotal(): number {
    return Object.values(this.addIndivSplits).reduce((s: number, v) => s + (Number(v) || 0), 0);
  }
  get splitIsValid(): boolean {
    if (this.splitMode() !== 'individual') return true;
    return Math.abs(this.addIndivTotal - (Number(this.newEntry.amount) || 0)) < 0.01;
  }
  get splitSelectedNames(): string[] {
    return this.financeUsers().filter(u => this.addSplitMap[u.name]).map(u => u.name);
  }

  startAdd(): void {
    this.newEntry = { date: '', vendor: '', description: '', amount: 0, currency: 'USD',
      paidBy: this.currentUser()?.name ?? '', category: '', notes: '', link: '' };
    this.addSplitMap = {};
    for (const u of this.financeUsers()) this.addSplitMap[u.name] = true;
    this.addIndivSplits = {};
    for (const u of this.financeUsers()) this.addIndivSplits[u.name] = null;
    this.splitMode.set('equal');
    this.showAddForm.set(true);
    this.showExpenses.set(false);
  }

  saveAdd(): void {
    this.addFormSubmitted.set(true);
    if (!this.newEntry.vendor || !this.newEntry.amount || !this.splitIsValid) return;
    const selected = this.splitSelectedNames;
    const entry: FinanceEntry = {
      date: this.newEntry.date ?? '', vendor: this.newEntry.vendor ?? '',
      description: this.newEntry.description ?? '', amount: Number(this.newEntry.amount) || 0,
      currency: this.newEntry.currency ?? 'USD', paidBy: this.newEntry.paidBy ?? '',
      splitAmong: selected.length === this.financeUsers().length ? 'All' : selected.join(', '),
      category: this.newEntry.category ?? '', notes: this.newEntry.notes ?? '', link: this.newEntry.link ?? ''
    };
    if (this.splitMode() === 'individual') {
      entry.splits = Object.fromEntries(selected.map(n => [n, Number(this.addIndivSplits[n]) || 0]));
    }
    this.dataService.addFinanceEntry(entry);
    this.addFormSubmitted.set(false);
    this.showAddForm.set(false);
    this.showToast(`✓ "${entry.vendor}" added successfully`);
  }

  cancelAdd(): void { this.addFormSubmitted.set(false); this.showAddForm.set(false); }

  // ── Edit expense ──────────────────────────────────────────────────────────────
  editingEntryKey  = signal<string | null>(null);
  editFormSubmitted = signal(false);
  editEntryDraft: Partial<FinanceEntry> = {};
  editSplitMap: Record<string, boolean> = {};
  editSplitMode = signal<'equal' | 'individual'>('equal');
  editIndivSplits: Record<string, number | null | undefined> = {};

  get editIndivTotal(): number {
    return Object.values(this.editIndivSplits).reduce((s: number, v) => s + (Number(v) || 0), 0);
  }
  get editSplitIsValid(): boolean {
    if (this.editSplitMode() === 'equal') return true;
    return Math.abs(this.editIndivTotal - (Number(this.editEntryDraft.amount) || 0)) < 0.01;
  }

  isEditingEntry(e: FinanceEntry): boolean {
    return this.editingEntryKey() === `${e.date}__${e.description}`;
  }
  startEditEntry(e: FinanceEntry): void {
    this.editFormSubmitted.set(false);
    this.editingEntryKey.set(`${e.date}__${e.description}`);
    this.editEntryDraft = { ...e };
    const split = e.splitAmong === 'All' ? this.financeUsers().map(u => u.name) : e.splitAmong.split(',').map(s => s.trim());
    this.editSplitMap = {};
    for (const u of this.financeUsers()) this.editSplitMap[u.name] = split.includes(u.name);
    if (e.splits && Object.keys(e.splits).length > 0) {
      this.editSplitMode.set('individual');
      this.editIndivSplits = { ...e.splits };
    } else {
      this.editSplitMode.set('equal');
      this.editIndivSplits = {};
    }
  }
  saveEditEntry(origDate: string, origDesc: string): void {
    this.editFormSubmitted.set(true);
    if (!this.editEntryDraft.vendor || !this.editEntryDraft.amount || !this.editSplitIsValid) return;
    const selected = this.financeUsers().filter(u => this.editSplitMap[u.name]).map(u => u.name);
    const patch: Partial<FinanceEntry> = {
      ...this.editEntryDraft,
      amount: Number(this.editEntryDraft.amount) || 0,
      splitAmong: selected.length === this.financeUsers().length ? 'All' : selected.join(', '),
    };
    if (this.editSplitMode() === 'individual') {
      patch.splits = Object.fromEntries(selected.map(n => [n, Number(this.editIndivSplits[n]) || 0]));
    } else {
      patch.splits = undefined;
    }
    this.dataService.patchFinanceEntry(origDate, origDesc, patch);
    this.editingEntryKey.set(null);
  }
  cancelEditEntry(): void { this.editFormSubmitted.set(false); this.editingEntryKey.set(null); }
  deleteEntry(date: string, description: string): void {
    if (!confirm(`Delete "${description}"?`)) return;
    this.editingEntryKey.set(null);
    this.dataService.deleteFinanceEntry(date, description);
  }

  isAllSplitSelected(map: Record<string, boolean>): boolean {
    return this.financeUsers().every(u => map[u.name]);
  }
  toggleAllSplit(map: Record<string, boolean>): void {
    const all = this.isAllSplitSelected(map);
    for (const u of this.financeUsers()) map[u.name] = !all;
  }

  // ── Rate editor ───────────────────────────────────────────────────────────────
  saveRates(): void {
    const updated: ExchangeRates = { EUR: 1,
      USD: Number(this.rateForm.USD) || DEFAULT_RATES.USD,
      GBP: Number(this.rateForm.GBP) || DEFAULT_RATES.GBP,
      ISK: Number(this.rateForm.ISK) || DEFAULT_RATES.ISK,
    };
    this.rates.set(updated);
    localStorage.setItem(RATES_KEY, JSON.stringify(updated));
    this.showRateEditor.set(false);
  }
  resetRates(): void {
    this.rateForm = { ...DEFAULT_RATES };
    this.rates.set({ ...DEFAULT_RATES });
    localStorage.removeItem(RATES_KEY);
    this.showRateEditor.set(false);
  }

  ngOnInit(): void { this.rateForm = { ...this.loadRates() }; }

  ngAfterViewInit(): void {
    this._fabObserver = new IntersectionObserver(
      ([entry]) => this.showFab.set(!entry.isIntersecting),
      { threshold: 0 }
    );
    if (this.addBtnRef) this._fabObserver.observe(this.addBtnRef.nativeElement);
  }

  ngOnDestroy(): void { this._fabObserver?.disconnect(); }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
  }
  refresh(): void { this.dataService.refresh(); }

  private loadRates(): ExchangeRates {
    try { const r = localStorage.getItem(RATES_KEY); return r ? { ...DEFAULT_RATES, ...JSON.parse(r) } : { ...DEFAULT_RATES }; }
    catch { return { ...DEFAULT_RATES }; }
  }
  private loadPrefs(): Set<string> {
    try {
      const user = this.userService.currentUser()?.name ?? 'unknown';
      const raw  = localStorage.getItem(PREFS_KEY_PREFIX + user);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set(['EUR', 'USD']);
    } catch { return new Set(['EUR', 'USD']); }
  }
  private savePrefs(enabled: Set<string>): void {
    const user = this.userService.currentUser()?.name ?? 'unknown';
    localStorage.setItem(PREFS_KEY_PREFIX + user, JSON.stringify([...enabled]));
  }
}
