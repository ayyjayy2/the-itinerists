import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FinanceComponent } from './finance.component';
import { FinanceService } from '../../services/finance.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { FocusService } from '../../services/focus.service';
import { FinanceEntryDoc } from '../../models/trip.models';

// #447: an "Everyone" expense with individual amounts typed before two people
// joined used to count them as owing nothing, silently.
describe('FinanceComponent: expenses that leave people out', () => {
  const people = ['Maya', 'Theo', 'Jo', 'Rafa', 'Sam', 'Ana'].map(name => ({ uid: name, name, color: '#8BAF7C', avatarEmoji: '🙂' }));
  const car: FinanceEntryDoc = {
    id: 'car', date: '2026-09-14', vendor: 'Car hire', description: '', amount: 341.5, currency: 'USD', paidBy: 'Maya',
    splitAmong: 'All', splits: { Maya: 170.74, Theo: 56.92, Jo: 56.92, Rafa: 56.92 }, category: '', addedByUid: 'Maya', createdAt: 1,
  } as FinanceEntryDoc;
  const dinner: FinanceEntryDoc = { ...car, id: 'dinner', vendor: 'Dinner', amount: 60, splits: undefined } as FinanceEntryDoc;
  let finance: { entries: ReturnType<typeof signal<FinanceEntryDoc[]>>; updateEntry: jasmine.Spy; [k: string]: unknown };

  function create(entries: FinanceEntryDoc[]) {
    finance = {
      entries: signal(entries), loaded: signal(true), paidItems: signal(new Set<string>()),
      updateEntry: jasmine.createSpy('updateEntry').and.resolveTo(), addEntry: jasmine.createSpy().and.resolveTo(),
      deleteEntry: jasmine.createSpy().and.resolveTo(), togglePaidItem: jasmine.createSpy(), reminders: signal(new Map()), claims: signal(new Map()),
    };
    TestBed.configureTestingModule({
      imports: [FinanceComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: finance },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'Maya', name: 'Maya' }), isAdmin: () => false } },
        { provide: UsersService, useValue: { tripUsers: () => people } },
        { provide: TripService, useValue: { activeTrip: signal({ id: 't', name: 'Trip', currency: 'USD' }), ready: signal(true), activeMembers: signal([]) } },
        { provide: ExchangeRateService, useValue: { ratesFor: () => Promise.resolve(null) } },
        { provide: FocusService, useValue: { id: signal(null), clear: () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('says which expense leaves out whom, and nothing about equal splits', () => {
    const { el } = create([car, dinner]);
    const notice = el.querySelector('.split-gap-notice')!;
    expect(notice).withContext('notice').not.toBeNull();
    expect(notice.textContent!.replace(/\s+/g, ' ')).toContain('Car hire was split before Sam and Ana joined, so Sam and Ana owe nothing for it.');
    expect(el.querySelectorAll('.split-gap').length).toBe(1);
  });

  it('shows no notice when every split covers everyone', () => {
    const { el } = create([dinner]);
    expect(el.querySelector('.split-gap-notice')).toBeNull();
  });

  it('"Split equally with everyone" clears the old amounts (null, not undefined, so the save removes them)', async () => {
    const { el } = create([car]);
    (Array.from(el.querySelectorAll('.split-gap button')).find(b => b.textContent!.includes('Split equally')) as HTMLButtonElement).click();
    await Promise.resolve();
    expect(finance.updateEntry).toHaveBeenCalledWith('car', { splitAmong: 'All', splits: null });
  });

  it('editing an expense back to an equal split really clears its individual amounts', async () => {
    const { comp } = create([car]);
    comp.startEditEntry(car);
    comp.editSplitMode.set('equal');
    await comp.saveEditEntry('car');
    expect(finance.updateEntry.calls.mostRecent().args[1].splits).toBeNull();
  });

  it("'Set amounts' opens the expense for editing with everyone ticked", () => {
    const { comp, el } = create([car]);
    (Array.from(el.querySelectorAll('.split-gap button')).find(b => b.textContent!.includes('Set amounts')) as HTMLButtonElement).click();
    expect(comp.editingEntryId()).toBe('car');
    expect(people.every(p => comp.editSplitMap[p.name])).toBeTrue();
  });
});

// #666: Pay now for everyone you owe, and the person owed confirms before anything is settled.
describe('FinanceComponent: settling up', () => {
  const people = ['Maya', 'Theo'].map(name => ({ uid: name, name, color: '#8BAF7C', avatarEmoji: '🙂' }));
  const entry = (paidBy: string): FinanceEntryDoc => ({
    id: 'dinner', date: '2026-09-14', vendor: 'Dinner', description: '', amount: 60, currency: 'USD', paidBy,
    splitAmong: 'Maya, Theo', category: '', addedByUid: paidBy, createdAt: 1,
  } as FinanceEntryDoc);
  let finance: Record<string, any>;

  function create(paidBy: string, claims = new Map<string, unknown>()) {
    finance = {
      entries: signal([entry(paidBy)]), loaded: signal(true), paidItems: signal(new Set<string>()),
      updateEntry: jasmine.createSpy().and.resolveTo(), addEntry: jasmine.createSpy().and.resolveTo(),
      deleteEntry: jasmine.createSpy().and.resolveTo(), togglePaidItem: jasmine.createSpy('togglePaidItem'),
      markAllPaid: jasmine.createSpy('markAllPaid'), reminders: signal(new Map()), claims: signal(claims),
      claimPaid: jasmine.createSpy('claimPaid').and.resolveTo(), clearClaim: jasmine.createSpy('clearClaim').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      imports: [FinanceComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: finance },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'Maya', name: 'Maya' }), isAdmin: () => false } },
        { provide: UsersService, useValue: { tripUsers: () => people } },
        { provide: TripService, useValue: {
          activeTrip: signal({ id: 't', name: 'Lisbon', currency: 'USD' }), ready: signal(true),
          activeMembers: signal([{ uid: 'Maya', displayName: 'Maya' }, { uid: 'Theo', displayName: 'Theo' }]),
        } },
        { provide: ExchangeRateService, useValue: { ratesFor: () => Promise.resolve(null) } },
        { provide: FocusService, useValue: { id: signal(null), clear: () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('offers Pay now even when the person owed has no payment app, with every app in the pop-up', () => {
    const { fixture, el } = create('Theo');
    const payNow = Array.from(el.querySelectorAll('.banner-negative button')).find(b => b.textContent!.trim() === 'Pay now') as HTMLButtonElement;
    expect(payNow).withContext('Pay now').toBeTruthy();
    payNow.click();
    fixture.detectChanges();
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.pay-sheet a.pay-app'));
    expect(links.map(a => a.textContent!.replace('›', '').trim())).toEqual(['Venmo', 'PayPal', 'Cash App']);
    expect(links[0].getAttribute('href')).toBe('https://venmo.com/?txn=pay&amount=30.00&note=Lisbon');
  });

  it('Mark as paid tells the person owed instead of settling it', async () => {
    const { comp } = create('Theo');
    comp.openPay('Theo', 30);
    comp.choosePay('venmo');
    await comp.markPaid();
    expect(finance['claimPaid']).toHaveBeenCalledWith({ uid: 'Theo' }, 30, 'venmo');
    expect(finance['markAllPaid']).not.toHaveBeenCalled();
    expect(comp.pendingPay()).toBeNull();
  });

  it('shows "waiting to confirm" once I have said I paid', () => {
    const { el } = create('Theo', new Map([['Maya_Theo', { from: 'Maya', to: 'Theo', amount: 30, currency: 'USD', app: 'venmo' }]]));
    expect(el.querySelector('.banner-negative')!.textContent).toContain('Waiting for Theo to confirm');
    expect(el.querySelector('.banner-negative')!.textContent).not.toContain('Pay now');
  });

  it('the person owed confirms: Got it settles and clears the claim', async () => {
    const { el } = create('Maya', new Map([['Theo_Maya', { from: 'Theo', to: 'Maya', amount: 30, currency: 'USD', app: 'cashapp' }]]));
    const box = el.querySelector('.banner-positive .pay-check')!;
    expect(box.textContent!.replace(/\s+/g, ' ')).toContain('Theo says they paid you 30.00 USD with Cash App');
    (Array.from(box.querySelectorAll('button')).find(b => b.textContent!.includes('Got it')) as HTMLButtonElement).click();
    await Promise.resolve();
    expect(finance['markAllPaid']).toHaveBeenCalled();
    expect(finance['clearClaim']).toHaveBeenCalledWith('Theo', 'Maya');
  });

  it('Not received clears the claim without settling', async () => {
    const { el } = create('Maya', new Map([['Theo_Maya', { from: 'Theo', to: 'Maya', amount: 30, currency: 'USD', app: 'cashapp' }]]));
    (Array.from(el.querySelectorAll('.banner-positive .pay-check button')).find(b => b.textContent!.includes('Not received')) as HTMLButtonElement).click();
    await Promise.resolve();
    expect(finance['clearClaim']).toHaveBeenCalledWith('Theo', 'Maya');
    expect(finance['markAllPaid']).not.toHaveBeenCalled();
  });
});
