import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { ExpensesService } from '../../services/expenses.service';
import { UserService } from '../../services/user.service';
import { FinanceEntry, DEFAULT_RATES, ExchangeRates } from '../../models/trip.models';

const CATEGORIES = ['Food', 'Drink', 'Transport', 'Shopping', 'Accommodation', 'Lodging', 'Activity', 'Other'];

const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: '$ USD' },
  { code: 'EUR', symbol: '€',  label: '€ EUR' },
  { code: 'GBP', symbol: '£',  label: '£ GBP (N. Ireland)' },
  { code: 'ISK', symbol: 'kr', label: 'kr ISK (Iceland)' },
];

const DISPLAY_CURRENCIES_KEY = 'ireland_expenses_display_currencies';

interface DisplayExpense {
  id: string;
  date: string;
  vendor?: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  isPersonal: boolean;
}

@Component({
  selector: 'app-expenses',
  imports: [CommonModule, NgClass, FormsModule],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss'
})
export class ExpensesComponent implements OnInit {
  dataService     = inject(DataService);
  expensesService = inject(ExpensesService);
  userService     = inject(UserService);

  currentUser = this.userService.currentUser;
  loading     = this.dataService.loading;
  categories  = CATEGORIES;
  currencies  = CURRENCIES;

  // Add form state
  showForm = signal(false);
  form = {
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    description: '',
    amount: null as number | null,
    currency: 'USD',
    category: 'Food'
  };

  // Edit modal state
  editingExpense = signal<DisplayExpense | null>(null);
  editForm = {
    date: '',
    vendor: '',
    description: '',
    amount: null as number | null,
    currency: 'USD',
    category: 'Food'
  };

  // Finance entry edit state (shared expenses)
  financeEditDraft: Partial<FinanceEntry> = {};
  private financeOrigKey: { date: string; description: string } | null = null;

  categoryFilter      = signal<string>('All');
  selectedCurrencies  = signal<Set<string>>(this.loadSelectedCurrencies());
  showCurrencyPicker  = signal(false);

  private rates: ExchangeRates = (() => {
    try {
      const raw = localStorage.getItem('ireland_fx_rates');
      return raw ? { ...DEFAULT_RATES, ...JSON.parse(raw) } : { ...DEFAULT_RATES };
    } catch { return { ...DEFAULT_RATES }; }
  })();

  toCode(amount: number, from: string, to: string): number {
    const r = this.rates as unknown as Record<string, number>;
    const eur = amount / (r[from] ?? 1);
    return eur * (r[to] ?? 1);
  }

  selectedCurrencyConfigs = computed(() =>
    CURRENCIES.filter(c => this.selectedCurrencies().has(c.code))
  );

  isCurrencySelected(code: string): boolean { return this.selectedCurrencies().has(code); }

  toggleCurrency(code: string): void {
    const s = new Set(this.selectedCurrencies());
    if (s.has(code)) { if (s.size <= 1) return; s.delete(code); } else { s.add(code); }
    this.selectedCurrencies.set(s);
  }

  saveCurrencyPicker(): void {
    localStorage.setItem(DISPLAY_CURRENCIES_KEY, JSON.stringify([...this.selectedCurrencies()]));
    this.showCurrencyPicker.set(false);
  }

  private loadSelectedCurrencies(): Set<string> {
    try {
      const raw = localStorage.getItem(DISPLAY_CURRENCIES_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set(['USD']);
    } catch { return new Set(['USD']); }
  }

  /** Finance entries where the current user is in splitAmong, as their personal share. */
  private financeExpenses = computed((): DisplayExpense[] => {
    const user = this.currentUser();
    const data = this.dataService.data();
    if (!user || !data) return [];

    const allUserNames = data.users.map(u => u.name);

    return data.finance
      .filter(e => {
        const splits = e.splitAmong === 'All'
          ? allUserNames
          : e.splitAmong.split(',').map(s => s.trim());
        return splits.includes(user.name);
      })
      .map(e => {
        const splits = e.splitAmong === 'All'
          ? allUserNames
          : e.splitAmong.split(',').map(s => s.trim());
        return {
          id: `finance__${e.date}__${e.description}`,
          date: e.date,
          vendor: e.vendor,
          description: e.description,
          amount: e.amount / splits.length,
          currency: e.currency,
          category: e.category,
          isPersonal: false,
        };
      });
  });

  /** Personal expenses from local storage. */
  private personalExpenses = computed((): DisplayExpense[] =>
    this.expensesService.expenses().map(e => ({ ...e, isPersonal: true }))
  );

  /** All expenses combined, sorted by date. */
  allExpenses = computed(() =>
    [...this.financeExpenses(), ...this.personalExpenses()]
      .sort((a, b) => a.date.localeCompare(b.date))
  );

  filtered = computed(() => {
    const cat = this.categoryFilter();
    const all = this.allExpenses();
    return cat === 'All' ? all : all.filter(e => e.category === cat);
  });

  /** One total per selected display currency. */
  totals = computed(() =>
    [...this.selectedCurrencies()].map(code => ({
      code,
      symbol: CURRENCIES.find(c => c.code === code)?.symbol ?? '',
      amount: this.filtered().reduce((sum, e) => sum + this.toCode(e.amount, e.currency, code), 0),
    }))
  );

  ngOnInit(): void {
    this.expensesService.init();
  }

  addExpense(): void {
    if (!this.form.description || !this.form.amount) return;
    this.expensesService.add({
      date: this.form.date,
      vendor: this.form.vendor || undefined,
      description: this.form.description,
      amount: this.form.amount,
      currency: this.form.currency,
      category: this.form.category,
    });
    this.form.vendor = '';
    this.form.description = '';
    this.form.amount = null;
    this.form.category = 'Food';
    this.showForm.set(false);
  }

  openEdit(exp: DisplayExpense): void {
    this.editForm = {
      date: exp.date,
      vendor: exp.vendor ?? '',
      description: exp.description,
      amount: exp.amount,
      currency: exp.currency,
      category: exp.category,
    };
    if (!exp.isPersonal) {
      // Look up full FinanceEntry so we can edit all fields
      const full = this.dataService.data()?.finance.find(
        e => e.date === exp.date && e.description === exp.description
      );
      this.financeEditDraft = full ? { ...full } : {
        date: exp.date, description: exp.description,
        amount: exp.amount, currency: exp.currency, category: exp.category,
        paidBy: '', splitAmong: '', vendor: '', notes: '',
      };
      this.financeOrigKey = { date: exp.date, description: exp.description };
    }
    this.editingExpense.set(exp);
  }

  closeEdit(): void {
    this.editingExpense.set(null);
    this.financeOrigKey = null;
  }

  saveEdit(): void {
    const exp = this.editingExpense();
    if (!exp || !exp.isPersonal || !this.editForm.description || !this.editForm.amount) return;
    this.expensesService.update(exp.id, {
      date: this.editForm.date,
      vendor: this.editForm.vendor || undefined,
      description: this.editForm.description,
      amount: this.editForm.amount,
      currency: this.editForm.currency,
      category: this.editForm.category,
    });
    this.editingExpense.set(null);
  }

  saveFinanceEdit(): void {
    if (!this.financeOrigKey || !this.financeEditDraft.description || !this.financeEditDraft.amount) return;
    this.dataService.patchFinanceEntry(
      this.financeOrigKey.date,
      this.financeOrigKey.description,
      { ...this.financeEditDraft, amount: Number(this.financeEditDraft.amount) || 0 }
    );
    this.editingExpense.set(null);
    this.financeOrigKey = null;
  }

  remove(id: string): void {
    this.expensesService.remove(id);
    this.editingExpense.set(null);
  }

  catClass(cat: string): string {
    return 'cat-' + cat.toLowerCase();
  }

  setFilter(cat: string): void {
    this.categoryFilter.set(cat);
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
  }
}
