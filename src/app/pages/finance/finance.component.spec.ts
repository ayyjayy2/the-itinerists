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
import { NATIVE_PLATFORM } from '../../native-platform';
import { ItineraryService } from '../../services/itinerary.service';

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
        { provide: UserService, useValue: { currentUser: signal({ uid: 'Maya', name: 'Maya' }), firestoreUser: signal({ uid: 'Maya' }), isAdmin: () => false, isGuest: signal(false) } },
        { provide: UsersService, useValue: { tripUsers: () => people } },
        { provide: TripService, useValue: { activeTrip: signal({ id: 't', name: 'Trip', currency: 'USD' }), ready: signal(true), activeMembers: signal([]) } },
        { provide: ExchangeRateService, useValue: { ratesFor: () => Promise.resolve(null) } },
        { provide: FocusService, useValue: { id: signal(null), clear: () => {} } },
        { provide: ItineraryService, useValue: { items: signal([]) } },
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

  function create(paidBy: string, claims = new Map<string, unknown>(), opts: { endDate?: string; reminders?: Map<string, number>; native?: boolean; own?: string; theirs?: string; latest?: Record<string, number>; saved?: Record<string, number> } = {}) {
    finance = {
      entries: signal([{ ...entry(paidBy), ...(opts.saved ? { rates: { on: '2026-09-14', per: opts.saved } } : {}) }]), loaded: signal(true), paidItems: signal(new Set<string>()),
      updateEntry: jasmine.createSpy().and.resolveTo(), addEntry: jasmine.createSpy().and.resolveTo(),
      deleteEntry: jasmine.createSpy().and.resolveTo(), togglePaidItem: jasmine.createSpy('togglePaidItem'),
      markAllPaid: jasmine.createSpy('markAllPaid'), reminders: signal(opts.reminders ?? new Map()), claims: signal(claims),
      claimPaid: jasmine.createSpy('claimPaid').and.resolveTo(), clearClaim: jasmine.createSpy('clearClaim').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      imports: [FinanceComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: finance },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'Maya', name: 'Maya' }), firestoreUser: signal({ uid: 'Maya', ownCurrency: opts.own }), isAdmin: () => false, isGuest: signal(false) } },
        { provide: UsersService, useValue: { tripUsers: () => people } },
        { provide: TripService, useValue: {
          activeTrip: signal({ id: 't', name: 'Lisbon', currency: 'USD', endDate: opts.endDate }), ready: signal(true),
          activeMembers: signal([{ uid: 'Maya', displayName: 'Maya' }, { uid: 'Theo', displayName: 'Theo', ownCurrency: opts.theirs }]),
        } },
        { provide: ExchangeRateService, useValue: { ratesFor: (_: string, d: string) => Promise.resolve(d === 'latest' ? opts.latest ?? null : null) } },
        { provide: FocusService, useValue: { id: signal(null), clear: () => {} } },
        { provide: ItineraryService, useValue: { items: signal([]) } },
        { provide: NATIVE_PLATFORM, useValue: !!opts.native },
      ],
    });
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  // #681: in the iPhone app, Venmo opens with its own app link, not through Safari.
  describe('opening Venmo', () => {
    function tapVenmo(native: boolean) {
      const { fixture, comp, el } = create('Theo', new Map(), { native });
      const go = spyOn(comp, 'goTo');
      const web = spyOn(window, 'open');
      comp.openPay('Theo', 30);
      fixture.detectChanges();
      const venmo = el.querySelector<HTMLAnchorElement>('.pay-sheet a.pay-app')!;
      const ev = new MouseEvent('click', { cancelable: true });
      if (!native) venmo.addEventListener('click', e => e.defaultPrevented || e.preventDefault(), { once: true }); // keep the test page here
      venmo.dispatchEvent(ev);
      return { comp, go, web };
    }
    afterEach(() => jasmine.clock().uninstall());

    it('in the iPhone app: the Venmo app link, then the web link only if Venmo did not open', () => {
      jasmine.clock().install();
      const { comp, go, web } = tapVenmo(true);
      expect(go).toHaveBeenCalledWith('venmo://paycharge?txn=pay&amount=30.00&note=Lisbon');
      expect(comp.pendingPay()?.app).toBe('venmo');
      jasmine.clock().tick(1600);                                   // still here: Venmo isn't installed
      expect(web).toHaveBeenCalledWith('https://venmo.com/?txn=pay&amount=30.00&note=Lisbon', '_blank');
    });

    it('in the iPhone app: no web link once Venmo has opened', () => {
      jasmine.clock().install();
      const { comp, web } = tapVenmo(true);
      comp.leftForApp();                                            // the app went to the background
      jasmine.clock().tick(1600);
      expect(web).not.toHaveBeenCalled();
    });

    it('on the website: the plain web link', () => {
      const { comp, go } = tapVenmo(false);
      expect(go).not.toHaveBeenCalled();
      expect(comp.pendingPay()?.app).toBe('venmo');
    });
  });

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
    // #716: Theo's bell hears it was received
    expect(finance['clearClaim']).toHaveBeenCalledWith('Theo', 'Maya', { answer: 'received', amount: 30, currency: 'USD' });
  });

  // #429: what's owed also shows in my own currency, worked out from the trip's.
  describe('in my own currency', () => {
    async function render(own: string | undefined, paidBy = 'Theo', theirs?: string) {
      const r = create(paidBy, new Map(), { own, theirs, latest: { GBP: 0.8, EUR: 0.9 } });
      await r.fixture.whenStable();
      r.fixture.detectChanges();
      return r;
    }
    // #714: with a currency of my own, Finance leads with it; the trip amount goes small beside it.
    it('shows what I owe in my currency first, the trip amount small beside it', async () => {
      const { el } = await render('GBP');
      expect(el.querySelector('.banner-negative .banner-amount')!.textContent!.trim()).toBe('≈ £24.00');
      expect(el.querySelector('.banner-negative .banner-own')!.textContent!.trim()).toBe('30.00 USD');
      expect(el.querySelector('.banner-negative .banner-person-amounts')!.textContent!.trim()).toBe('≈ £24.00');
    });
    it('and what I am owed', async () => {
      const { el } = await render('GBP', 'Maya');
      expect(el.querySelector('.banner-positive .banner-amount')!.textContent!.trim()).toBe('≈ £24.00');
      expect(el.querySelector('.banner-positive .banner-own')!.textContent!.trim()).toBe('30.00 USD');
    });
    it('sits on the same line as the trip amount', async () => {
      const { el } = await render('GBP');
      expect(el.querySelector('.banner-negative .banner-amounts .banner-own')).not.toBeNull();
    });
    // #723: amounts in my currency come from each expense's saved rate, so they never move.
    it('uses the expense\'s saved rate for my currency and theirs, not today\'s', async () => {
      const r = create('Theo', new Map(), { own: 'GBP', theirs: 'EUR', latest: { GBP: 0.8, EUR: 0.9 }, saved: { GBP: 0.5, EUR: 0.6 } });
      await r.fixture.whenStable(); r.fixture.detectChanges();
      expect(r.el.querySelector('.banner-negative .banner-amount')!.textContent!.trim()).toBe('≈ £15.00');
      expect(r.el.querySelector('.banner-negative .banner-person-amounts')!.textContent!.trim()).toBe('≈ £15.00');
      r.comp.openPay('Theo', 30);
      r.fixture.detectChanges();
      expect(r.el.querySelector('.pay-summary-amount')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ £15.00 30.00 USD ≈ €18.00 (Theo)');
    });
    // #724: the expenses total leads with my currency, then the group's others, each expense at its saved rate.
    it('leads the expenses total with my currency, then the group\'s others', async () => {
      const r = create('Theo', new Map(), { own: 'GBP', theirs: 'EUR', latest: { GBP: 0.8, EUR: 0.9 }, saved: { GBP: 0.5, EUR: 0.6 } });
      await r.fixture.whenStable();
      r.comp.showExpenses.set(true);
      r.fixture.detectChanges();
      expect(r.el.querySelector('.totals-amount')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ £30.00 $60.00 · ≈ €36.00');
    });
    it('leads the Pay now pop-up with my currency', async () => {
      const { comp, fixture, el } = await render('GBP');
      comp.openPay('Theo', 30);
      fixture.detectChanges();
      expect(el.querySelector('.pay-summary-amount')!.textContent!.replace(/\s+/g, ' ')).toContain('≈ £24.00 30.00 USD');
    });
    // #688: the pop-up also shows the payee's own currency, when it differs from mine.
    it('the Pay now pop-up shows mine, then the trip amount, then theirs', async () => {
      const { comp, fixture, el } = await render('GBP', 'Theo', 'EUR');
      comp.openPay('Theo', 30);
      fixture.detectChanges();
      expect(el.querySelector('.pay-summary-amount')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ £24.00 30.00 USD ≈ €27.00 (Theo)');
    });
    it('shows one converted amount when we share a currency', async () => {
      const { comp, fixture, el } = await render('GBP', 'Theo', 'GBP');
      comp.openPay('Theo', 30);
      fixture.detectChanges();
      expect(el.querySelector('.pay-summary-amount')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ £24.00 30.00 USD');
    });
    it('shows theirs even when I have none of my own', async () => {
      const { comp, fixture, el } = await render(undefined, 'Theo', 'EUR');
      comp.openPay('Theo', 30);
      fixture.detectChanges();
      expect(el.querySelector('.pay-summary-amount')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('30.00 USD ≈ €27.00 (Theo)');
    });
    it('shows nothing extra without a currency of my own, or when it is the trip\'s', async () => {
      const plain = (await render(undefined)).el;
      expect(plain.querySelector('.banner-own')).toBeNull();
      expect(plain.querySelector('.banner-negative .banner-amount')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('30.00 USD');
      TestBed.resetTestingModule();
      expect((await render('USD')).el.querySelector('.banner-own')).toBeNull();
    });
  });

  // #719: Maya, with no currency of her own, saw bare numbers on each person's line.
  it('shows each person\'s amount with its currency', () => {
    const { el } = create('Theo');
    expect(el.querySelector('.banner-negative .banner-person-amounts')!.textContent!.trim()).toBe('$30.00');
  });

  // #682: the arrows that open the owe/owed working were still too small to spot.
  it('draws the owe/owed arrows big enough to see, on a tap target of at least 44px', () => {
    const { el } = create('Theo');
    const arrow = el.querySelector<HTMLElement>('.banner-negative .working-arrow')!;
    expect(parseFloat(getComputedStyle(arrow).fontSize)).toBeGreaterThanOrEqual(18);
    expect(el.querySelector<HTMLElement>('.banner-negative .banner-person-tap')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  // #674: a reminder sent before #664 still showed "Reminded today" before the trip's last day.
  describe('"Reminded today"', () => {
    const justNow = () => new Map([['Maya_Theo', Date.now() - 60_000]]);
    const owed = (el: HTMLElement) => el.querySelector('.banner-positive')!.textContent!;

    it('shows from the last day on, after a reminder today', () => {
      const { el } = create('Maya', new Map(), { reminders: justNow() });
      expect(owed(el)).toContain('Reminded today');
    });

    it('is hidden before the trip’s last day, like Remind', () => {
      const { el } = create('Maya', new Map(), { endDate: '2999-01-01', reminders: justNow() });
      expect(owed(el)).not.toContain('Reminded today');
      expect(owed(el)).not.toContain('Remind Theo');
    });

    it('is hidden while they say they paid', () => {
      const { el } = create('Maya', new Map([['Theo_Maya', { from: 'Theo', to: 'Maya', amount: 30, currency: 'USD', app: 'cashapp' }]]), { reminders: justNow() });
      expect(owed(el)).not.toContain('Reminded today');
    });
  });

  it('Not received clears the claim without settling', async () => {
    const { el } = create('Maya', new Map([['Theo_Maya', { from: 'Theo', to: 'Maya', amount: 30, currency: 'USD', app: 'cashapp' }]]));
    (Array.from(el.querySelectorAll('.banner-positive .pay-check button')).find(b => b.textContent!.includes('Not received')) as HTMLButtonElement).click();
    await Promise.resolve();
    expect(finance['clearClaim']).toHaveBeenCalledWith('Theo', 'Maya', { answer: 'not-received', amount: 30, currency: 'USD' });
    expect(finance['markAllPaid']).not.toHaveBeenCalled();
  });
});

// #747: a guest who logged out stays on the trip, marked left; the group checks what they were in.
describe('FinanceComponent: a guest who left', () => {
  const people = ['Maya', 'Theo', 'Robin'].map(name => ({ uid: name, name, color: '#8BAF7C', avatarEmoji: '🙂' }));
  const dinner = {
    id: 'dinner', date: '2026-11-18', vendor: 'Dash!', description: 'Farewell dinner', amount: 300, currency: 'THB', paidBy: 'Maya',
    splitAmong: 'All', splits: null, category: '', addedByUid: 'Maya', createdAt: 1,
  } as unknown as FinanceEntryDoc;
  const taxi = { ...dinner, id: 'taxi', vendor: 'Mr. Kwan', date: '2026-11-16', splitAmong: 'Maya, Theo' } as FinanceEntryDoc;
  const park = { ...dinner, id: 'park', vendor: 'Elephant Nature Park', date: '2026-11-16' } as FinanceEntryDoc;
  let trips: { [k: string]: unknown; checkLeaverItem: jasmine.Spy; finishLeaverReview: jasmine.Spy; activeTrip: ReturnType<typeof signal<object>> };
  let updateEntry: jasmine.Spy;

  function create(entries: FinanceEntryDoc[], leaverReviews: object = {}) {
    TestBed.resetTestingModule();
    updateEntry = jasmine.createSpy('updateEntry').and.resolveTo();
    trips = {
      activeTrip: signal({ id: 't', name: 'Trip', currency: 'THB', leaverReviews }), ready: signal(true),
      activeMembers: signal([{ uid: 'Maya', displayName: 'Maya' }, { uid: 'Theo', displayName: 'Theo' }, { uid: 'Robin', displayName: 'Robin', leftAt: 1 }]),
      checkLeaverItem: jasmine.createSpy('checkLeaverItem').and.resolveTo(),
      finishLeaverReview: jasmine.createSpy('finishLeaverReview').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      imports: [FinanceComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: {
          entries: signal(entries), loaded: signal(true), paidItems: signal(new Set<string>()), updateEntry,
          addEntry: jasmine.createSpy().and.resolveTo(), deleteEntry: jasmine.createSpy().and.resolveTo(), togglePaidItem: jasmine.createSpy(),
          reminders: signal(new Map()), claims: signal(new Map()) } },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'Maya', name: 'Maya' }), firestoreUser: signal({ uid: 'Maya' }), isAdmin: () => false, isGuest: signal(false) } },
        { provide: UsersService, useValue: { tripUsers: () => people } },
        { provide: TripService, useValue: trips },
        { provide: ExchangeRateService, useValue: { ratesFor: () => Promise.resolve(null) } },
        { provide: FocusService, useValue: { id: signal(null), clear: () => {} } },
        { provide: ItineraryService, useValue: { items: signal([]) } },
      ],
    });
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  const card = (el: HTMLElement) => el.querySelector('.leaver-review') as HTMLElement | null;
  const rows = (el: HTMLElement) => Array.from(card(el)?.querySelectorAll('li') ?? []).map(li => li.querySelector('b')!.textContent!.trim());
  const button = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll('button')).find(b => b.textContent!.trim() === text) as HTMLButtonElement;

  it('lists the expenses they are still in, each with Edit', () => {
    const { el } = create([dinner, taxi, park]);
    expect(card(el)!.querySelector('h3')!.textContent).toContain('Robin (guest) left the trip');
    expect(rows(el)).toEqual(['Elephant Nature Park', 'Dash!']);
    expect(card(el)!.textContent).toContain('Robin’s share ฿100');
  });

  it('Edit opens the expense\'s edit pop-up; Save takes it off the list and says so', async () => {
    const { fixture, comp, el } = create([dinner, park]);
    button(card(el)!.querySelector('li')!, 'Edit').click();
    fixture.detectChanges();
    expect(comp.editingEntry()?.id).toBe('park');
    await comp.saveEditEntry('park');
    expect(updateEntry).toHaveBeenCalled();
    expect(trips.checkLeaverItem).toHaveBeenCalledWith('Robin', 'park');
    trips.activeTrip.set({ id: 't', name: 'Trip', currency: 'THB', leaverReviews: { Robin: { checked: ['park'] } } });
    fixture.detectChanges();
    expect(card(el)!.querySelector('.leaver-saved')!.textContent).toContain('Saved: Elephant Nature Park');
    expect(rows(el)).toEqual(['Dash!']);
  });

  it('an edit opened anywhere else is not counted as checked', async () => {
    const { comp } = create([dinner]);
    comp.startEditEntry(dinner);
    await comp.saveEditEntry('dinner');
    expect(trips.checkLeaverItem).not.toHaveBeenCalled();
  });

  it('Looks right finishes it for everyone, with a short message', async () => {
    const { el, comp } = create([dinner]);
    button(card(el)!, 'Looks right').click();
    await Promise.resolve();
    expect(trips.finishLeaverReview).toHaveBeenCalledWith('Robin');
    expect(comp.toast()).toBe('That’s everything Robin was in, checked.');
  });

  it('saving the last one says everything is checked', async () => {
    const { el, comp } = create([dinner]);
    button(card(el)!, 'Edit').click();
    await comp.saveEditEntry('dinner');
    expect(comp.toast()).toBe('That’s everything Robin was in, checked.');
  });

  it('shows no card to a guest, who can\'t edit (#768)', () => {
    const { el, fixture } = create([dinner]);
    (TestBed.inject(UserService) as unknown as { isGuest: ReturnType<typeof signal<boolean>> }).isGuest.set(true);
    fixture.detectChanges();
    expect(card(el)).toBeNull();
  });

  it('shows no card for a guest who came back under the same name (#768)', () => {
    const { el, fixture } = create([dinner]);
    (trips['activeMembers'] as ReturnType<typeof signal<object[]>>).update(ms => [...ms, { uid: 'Robin2', displayName: 'Robin' }]);
    fixture.detectChanges();
    expect(card(el)).toBeNull();
  });

  it('shows no card once it is done, or when nothing is left', () => {
    expect(card(create([dinner], { Robin: { done: true } }).el)).toBeNull();
    expect(card(create([dinner], { Robin: { checked: ['dinner'] } }).el)).toBeNull();
    expect(card(create([taxi]).el)).toBeNull();
  });
});
