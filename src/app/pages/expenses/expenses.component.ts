import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpensesService } from '../../services/expenses.service';
import { FinanceService } from '../../services/finance.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import { FinanceEntryDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';
import { EmptyDateHintDirective } from '../../shared/empty-date-hint.directive';
import { CurrencySelectComponent } from '../../shared/currency-select/currency-select.component';
import { Rates, perCurrencySubtotals, amountText, groupCurrencies, totalsInEvery, tablesNeeded } from '../../utils/currency';
import { localTodayISO } from '../../utils/trip-destinations';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { money } from '../../utils/event-text';

const CATEGORIES = ['Food', 'Drink', 'Transport', 'Shopping', 'Accommodation', 'Activity', 'Other'];

interface DisplayExpense {
  id: string;
  date: string;
  vendor?: string;
  description: string;
  amount: number;       // your share for a shared expense
  currency: string;     // ISO code the amount is in: never assumed
  fullAmount?: number;  // the whole shared expense, when your share is part of it
  category: string;
  isPersonal: boolean;
  financeId?: string;
  createdAt?: number;
  per?: Record<string, number>;   // a shared expense's saved rates (#723)
}

@Component({
  selector: 'app-expenses',
  imports: [LoadingComponent, IconComponent, NoTripStateComponent, CommonModule, NgClass, FormsModule, EmptyDateHintDirective, CurrencySelectComponent],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss'
})
export class ExpensesComponent implements OnInit {
  expensesService = inject(ExpensesService);
  financeService  = inject(FinanceService);
  userService     = inject(UserService);
  usersService    = inject(UsersService);
  tripService = inject(TripService);
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);
  /** Spinner (delayed) until we know the trip and its data — no empty-state flash. */
  readonly loading = computed(() => !this.tripService.ready() || !this.expensesService.loaded());

  currentUser = this.userService.currentUser;
  categories  = CATEGORIES;
  /** The trip's own currency: the default for new expenses and the first total shown. */
  readonly homeCurrency = computed(() => this.tripService.activeTrip()?.currency ?? 'USD');
  readonly money = money;
  readonly amountText = amountText;

  showForm = signal(false);
  form = {
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    description: '',
    amount: null as number | null,
    currency: this.homeCurrency(),
    category: 'Food',
  };

  editingExpense  = signal<DisplayExpense | null>(null);
  editForm = {
    date: '',
    vendor: '',
    description: '',
    amount: null as number | null,
    currency: 'USD',
    category: 'Food',
  };

  financeEditDraft: Partial<FinanceEntryDoc> = {};

  categoryFilter = signal<string>('All');

  private financeExpenses = computed((): DisplayExpense[] => {
    const user = this.currentUser();
    if (!user) return [];
    const allNames = this.usersService.tripUsers().map(u => u.name);

    return this.financeService.entries()
      .filter(e => {
        const splits = e.splitAmong === 'All'
          ? allNames
          : e.splitAmong.split(',').map(s => s.trim());
        return splits.includes(user.name);
      })
      .map(e => {
        const splits = e.splitAmong === 'All'
          ? allNames
          : e.splitAmong.split(',').map(s => s.trim());
        const share = e.splits?.[user.name] ?? (e.amount / splits.length);
        return {
          id:         `finance__${e.id}`,
          date:       e.date,
          vendor:     e.vendor,
          description: e.description,
          amount:     share,
          currency:   e.currency || this.homeCurrency(),
          fullAmount: Math.abs(share - e.amount) > 0.005 ? e.amount : undefined,
          category:   e.category,
          isPersonal: false,
          financeId:  e.id,
          createdAt:  e.createdAt,
          per:        e.rates?.per,
        };
      });
  });

  private personalExpenses = computed((): DisplayExpense[] =>
    this.expensesService.expenses().map(e => ({ ...e, isPersonal: true }))
  );

  allExpenses = computed(() =>
    [...this.financeExpenses(), ...this.personalExpenses()]
      .sort((a, b) => a.date.localeCompare(b.date))
  );

  filtered = computed(() => {
    const cat = this.categoryFilter();
    return cat === 'All' ? this.allExpenses() : this.allExpenses().filter(e => e.category === cat);
  });

  /** One total per currency, the trip's own first: different currencies are never added together. */
  readonly totals = computed((): { currency: string; amount: number }[] => {
    const home = this.homeCurrency();
    const sums = perCurrencySubtotals(this.filtered());
    const list = Object.entries(sums).map(([currency, amount]) => ({ currency, amount }));
    if (!list.length) return [{ currency: home, amount: 0 }];
    return list.sort((a, b) => (a.currency === home ? -1 : b.currency === home ? 1 : a.currency.localeCompare(b.currency)));
  });
  readonly totalEmpty = computed(() => this.filtered().length === 0);

  // ── Totals (#724): one that stands out, in my currency (the trip's if I have
  //    none), then the same total in every other currency the group uses. Each
  //    expense counts at its saved rate (#723), else its day's rate, which
  //    never changes once the day has passed. ──
  private rateService = inject(ExchangeRateService);
  readonly mixedCurrencies = computed(() => new Set(this.filtered().map(e => e.currency)).size > 1);
  private readonly lead = computed(() => this.userService.firestoreUser()?.ownCurrency || this.homeCurrency());
  private readonly targets = computed(() => {
    const all = groupCurrencies(this.homeCurrency(), this.tripService.activeMembers());
    return [this.lead(), ...all.filter(c => c !== this.lead())];
  });
  private readonly tables = signal<Record<string, Rates>>({});
  private readonly loadTables = effect(() => {
    const today = localTodayISO(), have = untracked(this.tables);
    for (const { currency, day } of tablesNeeded(this.filtered(), this.targets(), today)) {
      const key = `${currency}|${day}`;
      if (have[key]) continue;
      void this.rateService.ratesFor(currency, day).then(r => { if (r) this.tables.update(t => ({ ...t, [key]: r })); });
    }
  });
  private readonly everyTotal = computed(() => totalsInEvery(this.filtered(), this.targets(), this.tables(), localTodayISO()));
  /** The total that stands out: "≈ $375.00", or "€300.00" when nothing needed converting. */
  readonly bigTotal = computed(() => {
    const t = this.everyTotal()[0];
    const converted = this.filtered().some(e => e.currency !== t.currency);
    return `${converted ? '≈ ' : ''}${amountText(t.total, t.currency)}`;
  });
  /** The same total in the group's other currencies, once each has a rate for every expense. */
  readonly otherTotals = computed(() => this.everyTotal().slice(1).filter(t => !t.missing)
    .map(t => `≈ ${amountText(t.total, t.currency)}`));

  ngOnInit(): void {
    this.expensesService.init();
  }

  /** Open the add form in the trip's currency (the trip may load after the page). */
  openForm(): void {
    this.form.currency = this.homeCurrency();
    this.showForm.set(true);
  }

  addExpense(): void {
    if (!this.form.description || !this.form.amount) return;
    this.expensesService.add({
      date:        this.form.date,
      vendor:      this.form.vendor || undefined,
      description: this.form.description,
      amount:      this.form.amount,
      currency:    this.form.currency,
      category:    this.form.category,
    });
    this.form.vendor      = '';
    this.form.description = '';
    this.form.amount      = null;
    this.form.category    = 'Food';
    this.showForm.set(false);
  }

  openEdit(exp: DisplayExpense): void {
    this.editForm = {
      date:        exp.date,
      vendor:      exp.vendor ?? '',
      description: exp.description,
      amount:      exp.amount,
      currency:    exp.currency,
      category:    exp.category,
    };
    if (!exp.isPersonal && exp.financeId) {
      const full = this.financeService.entries().find(e => e.id === exp.financeId);
      this.financeEditDraft = full ? { ...full } : {};
    }
    this.editingExpense.set(exp);
  }

  closeEdit(): void {
    this.editingExpense.set(null);
    this.financeEditDraft = {};
  }

  saveEdit(): void {
    const exp = this.editingExpense();
    if (!exp || !exp.isPersonal || !this.editForm.description || !this.editForm.amount) return;
    this.expensesService.update(exp.id, {
      date:        this.editForm.date,
      vendor:      this.editForm.vendor || undefined,
      description: this.editForm.description,
      amount:      this.editForm.amount,
      currency:    this.editForm.currency,
      category:    this.editForm.category,
    });
    this.editingExpense.set(null);
  }

  async saveFinanceEdit(): Promise<void> {
    const exp = this.editingExpense();
    if (!exp?.financeId || !this.financeEditDraft.description || !this.financeEditDraft.amount) return;
    await this.financeService.updateEntry(exp.financeId, {
      ...this.financeEditDraft,
      amount: Number(this.financeEditDraft.amount) || 0,
    });
    this.editingExpense.set(null);
    this.financeEditDraft = {};
  }

  remove(id: string): void {
    this.expensesService.remove(id);
    this.editingExpense.set(null);
  }

  catClass(cat: string): string { return 'cat-' + cat.toLowerCase(); }
  setFilter(cat: string): void  { this.categoryFilter.set(cat); }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
