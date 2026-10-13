import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ExpensesComponent } from './expenses.component';
import { ExpensesService } from '../../services/expenses.service';
import { FinanceService } from '../../services/finance.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';

/** My Expenses keeps every amount in its own currency (#409). */
describe('ExpensesComponent currencies', () => {
  let entries: WritableSignal<any[]>;
  let personal: WritableSignal<any[]>;
  let expenses: { expenses: WritableSignal<any[]>; loaded: () => boolean; init: () => void; add: jasmine.Spy; update: jasmine.Spy; remove: jasmine.Spy };
  let finance: { entries: WritableSignal<any[]>; updateEntry: jasmine.Spy };

  const hotel = {
    id: 'f1', date: '2027-05-10', vendor: 'Lisbon hotel', description: 'Three nights', amount: 300, currency: 'EUR',
    paidBy: 'Maya', splitAmong: 'All', category: 'Lodging', addedByUid: 'u1', createdAt: 1,
  };

  beforeEach(() => {
    entries = signal<any[]>([hotel]);
    personal = signal<any[]>([]);
    expenses = {
      expenses: personal, loaded: () => true, init: () => {},
      add: jasmine.createSpy('add'), update: jasmine.createSpy('update'), remove: jasmine.createSpy('remove'),
    };
    finance = { entries, updateEntry: jasmine.createSpy('updateEntry').and.resolveTo() };
    TestBed.configureTestingModule({
      imports: [ExpensesComponent],
      providers: [
        provideRouter([]),
        { provide: ExpensesService, useValue: expenses },
        { provide: FinanceService, useValue: finance },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'u1', name: 'Maya' }) } },
        { provide: UsersService, useValue: { tripUsers: () => [{ name: 'Maya' }] } },
        { provide: TripService, useValue: { activeTrip: signal({ id: 't1', currency: 'EUR' }), ready: signal(true) } },
        // 1 EUR = 1.25 USD on every date: $12 is €9.60.
        { provide: ExchangeRateService, useValue: { ratesByDate: (_home: string, dates: string[]) => Promise.resolve(Object.fromEntries(dates.map(d => [d, { USD: 1.25 }]))) } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows a EUR shared expense in euros in the row and the total, never as USD', () => {
    const { el } = render();
    expect(el.querySelector('.exp-amount')!.textContent).toContain('€300.00');
    const total = el.querySelector('.total-chip')!.textContent!;
    expect(total).toContain('€300.00');
    expect(el.textContent).not.toContain('USD');
    expect(el.textContent).not.toContain('$');
  });

  it('labels the shared expense details in its own currency, and saving unchanged keeps it', async () => {
    const { fixture, comp, el } = render();
    comp.openEdit(comp.filtered()[0]);
    fixture.detectChanges();
    expect(el.querySelector('.modal-card')!.textContent).toContain('Amount (EUR)');
    await comp.saveFinanceEdit();
    const [, saved] = finance.updateEntry.calls.mostRecent().args;
    expect(saved.currency).toBe('EUR');
    expect(saved.amount).toBe(300);
  });

  it('shows your share of a split expense next to the full amount', () => {
    entries.set([{ ...hotel, splitAmong: 'Maya, Theo' }]);
    const { el } = render();
    const row = el.querySelector('.expense-row')!.textContent!;
    expect(row).toContain('€150.00');
    expect(row).toContain('of €300.00');
  });

  it('shows a currency code once in the total, even for currencies without a symbol', () => {
    entries.set([{ ...hotel, currency: 'THB', amount: 6000 }]);
    const { el } = render();
    const total = el.querySelector('.total-chip')!.textContent!;
    expect(total.match(/THB/g)?.length).toBe(1);
  });

  it('never adds different currencies into one total', () => {
    personal.set([{ id: 'p1', date: '2027-05-11', description: 'Taxi', amount: 12, currency: 'USD', category: 'Transport' }]);
    const { el } = render();
    const total = el.querySelector('.total-chip')!.textContent!;
    expect(total).toContain('€300.00');
    expect(total).toContain('$12.00');
    expect(total).not.toContain('312');
  });

  it("adds a converted total in the trip's currency when currencies are mixed", async () => {
    personal.set([{ id: 'p1', date: '2027-05-11', description: 'Taxi', amount: 12, currency: 'USD', category: 'Transport' }]);
    const { fixture, el } = render();
    await fixture.whenStable(); fixture.detectChanges();
    const converted = el.querySelector('.total-converted')!.textContent!;
    expect(converted).toContain('≈ €309.60');                         // 300 + 12 / 1.25
    expect(converted).toContain("converted to EUR at each expense's date rate");
  });

  it('shows no converted line when everything is in one currency', async () => {
    const { fixture, el } = render();
    await fixture.whenStable(); fixture.detectChanges();
    expect(el.querySelector('.total-converted')).toBeNull();
  });

  it("starts a new personal expense in the trip's currency, and saves the one you pick", () => {
    const { comp } = render();
    expect(comp.form.currency).toBe('EUR');
    comp.form.description = 'Pastéis'; comp.form.amount = 4.5;
    comp.addExpense();
    expect(expenses.add.calls.mostRecent().args[0].currency).toBe('EUR');
    comp.form.description = 'Snack'; comp.form.amount = 3; comp.form.currency = 'GBP';
    comp.addExpense();
    expect(expenses.add.calls.mostRecent().args[0].currency).toBe('GBP');
  });

  it("uses the trip's currency even when the trip loads after the page", () => {
    const trip = TestBed.inject(TripService) as any;
    trip.activeTrip.set(null);
    const { comp } = render();
    trip.activeTrip.set({ id: 't1', currency: 'JPY' });
    comp.openForm();
    expect(comp.form.currency).toBe('JPY');
  });

  it('keeps a personal expense in the currency it was saved in when edited', () => {
    personal.set([{ id: 'p1', date: '2027-05-11', description: 'Taxi', amount: 12, currency: 'USD', category: 'Transport' }]);
    const { comp } = render();
    comp.openEdit(comp.filtered().find(e => e.isPersonal)!);
    comp.saveEdit();
    expect(expenses.update.calls.mostRecent().args[1].currency).toBe('USD');
  });
});
