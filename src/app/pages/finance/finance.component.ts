import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { FinanceEntryDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';

interface DirectDebt {
  from: string;
  to:   string;
  amountUsd: number;
  items: Array<{ id: string; label: string; date: string; description: string; notes?: string; amount: number }>;
}

@Component({
  selector: 'app-finance',
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.scss'
})
export class FinanceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('addBtnRef') addBtnRef!: ElementRef<HTMLButtonElement>;

  financeService = inject(FinanceService);
  userService    = inject(UserService);
  usersService   = inject(UsersService);

  currentUser  = this.userService.currentUser;
  financeUsers = this.usersService.tripUsers;

  showFab = signal(false);
  private _fabObserver?: IntersectionObserver;

  // ── View state ────────────────────────────────────────────────────────────────
  settlementsStatus  = signal<'owed' | 'paid'>('owed');
  settlementsScope   = signal<'mine' | 'all'>('mine');
  expandedDebt       = signal<string | null>(null);
  showExpenses       = signal(false);
  showGroupSummary   = signal(false);
  expandedGroupUsers = signal<Set<string>>(new Set());

  // ── User filter ───────────────────────────────────────────────────────────────
  selectedUsers    = signal<Set<string> | null>(null);
  showUserDropdown = signal(false);

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
    base.has(name) ? base.delete(name) : base.add(name);
    this.selectedUsers.set(base.size === allNames.length ? null : base);
  }
  userFilterLabel = computed(() => {
    const s = this.selectedUsers();
    if (s === null)  return 'All people';
    if (s.size === 0) return 'Select person…';
    if (s.size === 1) return [...s][0];
    return `${s.size} selected`;
  });

  // ── Core data ─────────────────────────────────────────────────────────────────
  entries = this.financeService.entries;

  directDebts = computed((): DirectDebt[] => {
    const userNames = this.financeUsers().map(u => u.name);
    const map = new Map<string, DirectDebt>();

    for (const e of this.entries()) {
      if (!e.amount || e.amount <= 0) continue;
      const splitNames = (e.splitAmong === 'All'
        ? userNames
        : e.splitAmong.split(',').map(s => s.trim())
      ).filter(Boolean);
      if (!splitNames.length) continue;

      for (const debtor of splitNames) {
        if (debtor === e.paidBy) continue;
        const share = e.splits ? (e.splits[debtor] ?? 0) : e.amount / splitNames.length;
        const key   = `${debtor}__${e.paidBy}`;
        if (!map.has(key)) map.set(key, { from: debtor, to: e.paidBy, amountUsd: 0, items: [] });
        const d = map.get(key)!;
        d.amountUsd += share;
        d.items.push({ id: e.id, label: e.vendor || e.description, date: e.date, description: e.description, notes: e.notes, amount: share });
      }
    }

    return [...map.values()].filter(d => d.amountUsd > 0.005);
  });

  personNetBreakdown = computed((): { owed: Array<{ name: string; amountUsd: number }>; owing: Array<{ name: string; amountUsd: number }> } => {
    const me = this.currentUser()?.name ?? '';
    if (!me) return { owed: [], owing: [] };

    const others = new Set<string>();
    for (const d of this.directDebts()) {
      const hasUnpaid = d.items.some(item => !this.isItemPaid(d.from, d.to, item.id));
      if (!hasUnpaid) continue;
      if (d.from === me) others.add(d.to);
      if (d.to   === me) others.add(d.from);
    }

    const owed:  Array<{ name: string; amountUsd: number }> = [];
    const owing: Array<{ name: string; amountUsd: number }> = [];

    for (const other of others) {
      const unpaid = (from: string, to: string) =>
        this.directDebts()
          .filter(d => d.from === from && d.to === to)
          .flatMap(d => d.items.filter(item => !this.isItemPaid(d.from, d.to, item.id)))
          .reduce((s, item) => s + item.amount, 0);

      const net = unpaid(other, me) - unpaid(me, other);
      if      (net >  0.005) owed .push({ name: other, amountUsd:  net });
      else if (net < -0.005) owing.push({ name: other, amountUsd: -net });
    }

    return { owed, owing };
  });

  totalOwedToMeUsd = computed(() => this.personNetBreakdown().owed .reduce((s, p) => s + p.amountUsd, 0));
  totalIOweUsd     = computed(() => this.personNetBreakdown().owing.reduce((s, p) => s + p.amountUsd, 0));

  paidBalanceUsd = computed(() => {
    const me = this.currentUser()?.name ?? '';
    if (!me) return 0;
    return this.directDebts().reduce((sum, d) => {
      const paidUsd = d.items
        .filter(item => this.isItemPaid(d.from, d.to, item.id))
        .reduce((s, item) => s + item.amount, 0);
      if (d.to   === me) return sum + paidUsd;
      if (d.from === me) return sum - paidUsd;
      return sum;
    }, 0);
  });

  allUsersNetBalance = computed(() =>
    this.financeUsers().map(u => {
      const net = this.directDebts().reduce((sum, d) => {
        const unpaidUsd = d.items
          .filter(item => !this.isItemPaid(d.from, d.to, item.id))
          .reduce((s, item) => s + item.amount, 0);
        if (d.to   === u.name) return sum + unpaidUsd;
        if (d.from === u.name) return sum - unpaidUsd;
        return sum;
      }, 0);
      return { name: u.name, emoji: u.avatarEmoji, amountUsd: net };
    })
  );

  userDebtDetails(name: string): Array<{ counterpart: string; emoji: string; amountUsd: number; direction: 'owes' | 'owed' }> {
    const details: Array<{ counterpart: string; emoji: string; amountUsd: number; direction: 'owes' | 'owed' }> = [];
    for (const u of this.financeUsers()) {
      if (u.name === name) continue;
      const unpaid = (from: string, to: string) =>
        this.directDebts()
          .filter(d => d.from === from && d.to === to)
          .reduce((sum, d) => sum + d.items
            .filter(item => !this.isItemPaid(d.from, d.to, item.id))
            .reduce((s, item) => s + item.amount, 0), 0);
      const net = unpaid(u.name, name) - unpaid(name, u.name);
      if      (net >  0.005) details.push({ counterpart: u.name, emoji: u.avatarEmoji, amountUsd:  net, direction: 'owed' });
      else if (net < -0.005) details.push({ counterpart: u.name, emoji: u.avatarEmoji, amountUsd: -net, direction: 'owes' });
    }
    return details;
  }

  // ── Search & filter ───────────────────────────────────────────────────────────
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
        if (status === 'owed' &&  fullyPaid) return [];
        const items = status === 'owed'
          ? d.items.filter(item => !this.isItemPaid(d.from, d.to, item.id))
          : d.items;
        if (q) {
          const nameMatch  = this.matchesSearch(q, d.from, d.to);
          const itemsMatch = items.filter(item => this.matchesSearch(q, item.label, item.description, item.notes));
          if (!nameMatch && itemsMatch.length === 0) return [];
          const visible    = nameMatch ? items : itemsMatch;
          return [{ ...d, items: visible, amountUsd: visible.reduce((s, i) => s + i.amount, 0) }];
        }
        return [{ ...d, items, amountUsd: items.reduce((s, i) => s + i.amount, 0) }];
      });
  });

  // ── Paid tracking ─────────────────────────────────────────────────────────────
  paidKey(from: string, to: string, id: string): string { return `${from}__${to}__${id}`; }
  isItemPaid(from: string, to: string, id: string): boolean {
    return this.financeService.paidItems().has(this.paidKey(from, to, id));
  }
  toggleItemPaid(from: string, to: string, id: string): void {
    this.financeService.togglePaidItem(this.paidKey(from, to, id));
  }
  isSettlementFullyPaid(d: DirectDebt): boolean {
    return d.items.length > 0 && d.items.every(item => this.isItemPaid(d.from, d.to, item.id));
  }

  debtKey(d: DirectDebt): string { return `${d.from}__${d.to}`; }
  isExpanded(d: DirectDebt): boolean { return this.expandedDebt() === this.debtKey(d); }
  toggleDebt(d: DirectDebt): void {
    const k = this.debtKey(d);
    this.expandedDebt.set(this.expandedDebt() === k ? null : k);
  }

  toggleGroupUser(name: string): void {
    const s = new Set(this.expandedGroupUsers());
    s.has(name) ? s.delete(name) : s.add(name);
    this.expandedGroupUsers.set(s);
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
    const q         = this.searchQuery().trim().toLowerCase();
    const userNames = this.financeUsers().map(u => u.name);
    return this.entries()
      .filter(e => !q || this.matchesSearch(q, e.vendor, e.description, e.paidBy, e.category, e.notes))
      .map(e => {
        const split       = e.splitAmong === 'All' ? userNames : e.splitAmong.split(',').map(s => s.trim()).filter(Boolean);
        const ppCount     = split.length || 1;
        const isIndivSplit = !!e.splits && Object.keys(e.splits).length > 0;
        return { ...e, ppCount, ppAmount: e.amount / ppCount, isIndivSplit };
      });
  });

  expenseTotal = computed(() =>
    this.enrichedEntries().reduce((sum, e) => sum + e.amount, 0)
  );

  // ── Add expense ───────────────────────────────────────────────────────────────
  showAddForm      = signal(false);
  addFormSubmitted = signal(false);
  newEntry: Partial<FinanceEntryDoc> = {};
  addSplitMap: Record<string, boolean> = {};
  splitMode       = signal<'equal' | 'individual'>('equal');
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

  async saveAdd(): Promise<void> {
    this.addFormSubmitted.set(true);
    if (!this.newEntry.vendor || !this.newEntry.amount || !this.splitIsValid) return;
    const selected = this.splitSelectedNames;
    const entry: Omit<FinanceEntryDoc, 'id'> = {
      date:        this.newEntry.date        ?? '',
      vendor:      this.newEntry.vendor      ?? '',
      description: this.newEntry.description ?? '',
      amount:      Number(this.newEntry.amount) || 0,
      currency:    'USD',
      paidBy:      this.newEntry.paidBy      ?? '',
      splitAmong:  selected.length === this.financeUsers().length ? 'All' : selected.join(', '),
      category:    this.newEntry.category    ?? '',
      notes:       this.newEntry.notes       ?? '',
      link:        this.newEntry.link        ?? '',
      addedByUid:  this.currentUser()?.uid   ?? '',
      createdAt:   Date.now(),
    };
    if (this.splitMode() === 'individual') {
      entry.splits = Object.fromEntries(selected.map(n => [n, Number(this.addIndivSplits[n]) || 0]));
    }
    await this.financeService.addEntry(entry);
    this.addFormSubmitted.set(false);
    this.showAddForm.set(false);
    this.showToast(`✓ "${entry.vendor}" added`);
  }

  cancelAdd(): void { this.addFormSubmitted.set(false); this.showAddForm.set(false); }

  // ── Edit expense ──────────────────────────────────────────────────────────────
  editingEntryId   = signal<string | null>(null);
  editFormSubmitted = signal(false);
  editEntryDraft: Partial<FinanceEntryDoc> = {};
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

  isEditingEntry(e: FinanceEntryDoc): boolean { return this.editingEntryId() === e.id; }

  startEditEntry(e: FinanceEntryDoc): void {
    this.editFormSubmitted.set(false);
    this.editingEntryId.set(e.id);
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

  async saveEditEntry(id: string): Promise<void> {
    this.editFormSubmitted.set(true);
    if (!this.editEntryDraft.vendor || !this.editEntryDraft.amount || !this.editSplitIsValid) return;
    const selected = this.financeUsers().filter(u => this.editSplitMap[u.name]).map(u => u.name);
    const patch: Partial<FinanceEntryDoc> = {
      ...this.editEntryDraft,
      amount:     Number(this.editEntryDraft.amount) || 0,
      splitAmong: selected.length === this.financeUsers().length ? 'All' : selected.join(', '),
    };
    if (this.editSplitMode() === 'individual') {
      patch.splits = Object.fromEntries(selected.map(n => [n, Number(this.editIndivSplits[n]) || 0]));
    } else {
      patch.splits = undefined;
    }
    await this.financeService.updateEntry(id, patch);
    this.editingEntryId.set(null);
  }

  cancelEditEntry(): void { this.editFormSubmitted.set(false); this.editingEntryId.set(null); }

  async deleteEntry(e: FinanceEntryDoc): Promise<void> {
    if (!confirm(`Delete "${e.vendor || e.description}"?`)) return;
    this.editingEntryId.set(null);
    await this.financeService.deleteEntry(e.id);
  }

  isAllSplitSelected(map: Record<string, boolean>): boolean {
    return this.financeUsers().every(u => map[u.name]);
  }
  toggleAllSplit(map: Record<string, boolean>): void {
    const all = this.isAllSplitSelected(map);
    for (const u of this.financeUsers()) map[u.name] = !all;
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  toast = signal<string | null>(null);
  private _toastTimer?: ReturnType<typeof setTimeout>;
  showToast(message: string): void {
    clearTimeout(this._toastTimer);
    this.toast.set(message);
    this._toastTimer = setTimeout(() => this.toast.set(null), 3000);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {}

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
    return new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
