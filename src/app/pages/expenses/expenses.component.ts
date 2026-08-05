import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpensesService } from '../../services/expenses.service';
import { FinanceService } from '../../services/finance.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import { FinanceEntryDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';

const CATEGORIES = ['Food', 'Drink', 'Transport', 'Shopping', 'Accommodation', 'Activity', 'Other'];

interface DisplayExpense {
  id: string;
  date: string;
  vendor?: string;
  description: string;
  amount: number;
  category: string;
  isPersonal: boolean;
  financeId?: string;
}

@Component({
  selector: 'app-expenses',
  imports: [IconComponent, NoTripStateComponent, CommonModule, NgClass, FormsModule],
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

  currentUser = this.userService.currentUser;
  categories  = CATEGORIES;

  showForm = signal(false);
  form = {
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    description: '',
    amount: null as number | null,
    category: 'Food',
  };

  editingExpense  = signal<DisplayExpense | null>(null);
  editForm = {
    date: '',
    vendor: '',
    description: '',
    amount: null as number | null,
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
          category:   e.category,
          isPersonal: false,
          financeId:  e.id,
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

  total = computed(() =>
    this.filtered().reduce((sum, e) => sum + e.amount, 0)
  );

  ngOnInit(): void {
    this.expensesService.init();
  }

  addExpense(): void {
    if (!this.form.description || !this.form.amount) return;
    this.expensesService.add({
      date:        this.form.date,
      vendor:      this.form.vendor || undefined,
      description: this.form.description,
      amount:      this.form.amount,
      currency:    'USD',
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
      currency:    'USD',
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
