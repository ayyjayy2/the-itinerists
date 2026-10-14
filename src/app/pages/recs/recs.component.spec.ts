import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RecsComponent } from './recs.component';
import { RecsService } from '../../services/recs.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { OfferCard, OfferCardsService } from '../../services/offer-cards.service';
import { UsageService } from '../../services/usage.service';

const CARDS: OfferCard[] = [
  { id: 'esim', icon: '📶', title: 'Need data abroad?', subline: 'Skip roaming fees in Germany',
    partners: [{ id: 'esim-a', name: 'eSIM A', offer: '$3 off', url: 'https://example.com/a' }] },
];
const rec = (id: string, category: string, title: string, destination?: string) =>
  ({ id, category, title, description: '', extra: '', addedByUid: 'u', createdAt: 1, ...(destination ? { destination } : {}) });
const ONE_STOP = { id: 'T1', name: 'Berlin', destination: 'Berlin, Germany', timeZone: 'Europe/Berlin', startDate: '2026-11-01', endDate: '2026-11-05', currency: 'EUR' };
const TWO_STOPS = {
  ...ONE_STOP,
  destinations: [
    { destination: 'Berlin, Germany', startDate: '2026-11-01', endDate: '2026-11-03', currency: 'EUR', timeZone: 'Europe/Berlin' },
    { destination: 'Prague, Czechia', startDate: '2026-11-03', endDate: '2026-11-05', currency: 'CZK', timeZone: 'Europe/Prague' },
  ],
};

describe('RecsComponent: partner offers in the Tips group (#476)', () => {
  let fixture: ComponentFixture<RecsComponent>;
  let el: HTMLElement;
  const recs = signal<any[]>([]);
  const trip = signal<any>(ONE_STOP);
  const cards = signal<OfferCard[]>(CARDS);

  beforeEach(() => {
    recs.set([]); trip.set(ONE_STOP); cards.set(CARDS);
    TestBed.configureTestingModule({
      imports: [RecsComponent],
      providers: [
        provideRouter([]),
        { provide: RecsService, useValue: { recs, loaded: signal(true) } },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'u' }), isAdmin: signal(false) } },
        { provide: TripService, useValue: { activeTrip: trip, ready: signal(true) } },
        { provide: OfferCardsService, useValue: { cards } },
        { provide: UsageService, useValue: { recordOffer: () => {} } },
      ],
    });
    fixture = TestBed.createComponent(RecsComponent);
    el = fixture.nativeElement;
  });

  const render = () => fixture.detectChanges();
  const group = (name: string, root: ParentNode = el) =>
    [...root.querySelectorAll('.rec-group')].find(g => g.querySelector('.rec-group-title')!.textContent!.trim() === name);
  const dropdowns = () => [...el.querySelectorAll('.recs-filters app-multi-select')];
  const dropdown = (label: string) => dropdowns().find(d => d.querySelector('.ms-label')!.textContent!.startsWith(label))!;
  /** Opens the dropdown if needed and ticks (or unticks) an option (#482). */
  const tick = (label: string, option: string) => {
    const d = dropdown(label);
    if (!d.querySelector('.ms-panel')) { d.querySelector<HTMLButtonElement>('.ms-trigger')!.click(); render(); }
    [...d.querySelectorAll('.ms-option')].find(o => o.textContent!.trim() === option)!.querySelector('input')!.click();
    render();
  };
  const titles = () => [...el.querySelectorAll('.rec-group-title')].map(t => t.textContent!.trim());

  it('puts the cards at the end of the Tips group, after the group\'s own tips', () => {
    recs.set([rec('a', 'Food', 'Currywurst'), rec('b', 'Tips', 'Carry cash')]);
    render();
    const tips = group('Tips')!;
    const items = [...tips.querySelectorAll('.rec-card')].map(c => c.classList.contains('offer-card') ? 'offer' : c.querySelector('.rec-title')!.textContent!.trim());
    expect(items).toEqual(['Carry cash', 'offer']);
    expect(group('Food')!.querySelector('.offer-card')).toBeNull();
  });

  it('adds a Tips group for the cards when the trip has no tips yet', () => {
    recs.set([rec('a', 'Food', 'Currywurst')]);
    render();
    expect([...el.querySelectorAll('.rec-group-title')].map(t => t.textContent!.trim())).toEqual(['Food', 'Tips']);
    expect(group('Tips')!.querySelectorAll('.offer-card').length).toBe(1);
  });

  it('shows them when no category is ticked, or Tips is among those ticked', () => {
    recs.set([rec('a', 'Food', 'Currywurst')]);
    render();
    tick('Categories', 'Food');
    expect(el.querySelector('.offer-card')).toBeNull();
    tick('Categories', 'Tips');
    expect(el.querySelector('.offer-card')).not.toBeNull();
    expect(titles()).toEqual(['Food', 'Tips']);
    tick('Categories', 'Food');
    expect(titles()).toEqual(['Tips']);
    expect(el.textContent).not.toContain('No recs match');
  });

  it('adds nothing when there are no cards', () => {
    cards.set([]);
    recs.set([rec('a', 'Food', 'Currywurst')]);
    render();
    expect(group('Tips')).toBeUndefined();
  });

  it('on a multi-stop trip, puts them in the Anywhere section, also when one stop is chosen', () => {
    trip.set(TWO_STOPS);
    recs.set([rec('a', 'Food', 'Currywurst', 'Berlin, Germany')]);
    render();
    const sections = () => [...el.querySelectorAll('.dest-section')];
    const titleOf = (s: Element) => s.querySelector('.dest-title')!.textContent!.trim();
    expect(sections().map(titleOf)).toEqual(['Berlin, Germany', 'Anywhere']);
    expect(group('Tips', sections()[1])!.querySelector('.offer-card')).not.toBeNull();
    expect(sections()[0].querySelector('.offer-card')).toBeNull();

    tick('Places', 'Prague, Czechia');
    expect(sections().map(titleOf)).toEqual(['Anywhere']);
    expect(el.querySelector('.offer-card')).not.toBeNull();
  });
});

describe('RecsComponent: place and category dropdowns (#482)', () => {
  let fixture: ComponentFixture<RecsComponent>;
  let el: HTMLElement;
  const recs = signal<any[]>([]);
  const trip = signal<any>(ONE_STOP);

  beforeEach(() => {
    recs.set([]); trip.set(ONE_STOP);
    TestBed.configureTestingModule({
      imports: [RecsComponent],
      providers: [
        provideRouter([]),
        { provide: RecsService, useValue: { recs, loaded: signal(true) } },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'u' }), isAdmin: signal(false) } },
        { provide: TripService, useValue: { activeTrip: trip, ready: signal(true) } },
        { provide: OfferCardsService, useValue: { cards: signal([]) } },
        { provide: UsageService, useValue: { recordOffer: () => {} } },
      ],
    });
    fixture = TestBed.createComponent(RecsComponent);
    el = fixture.nativeElement;
  });

  const render = () => fixture.detectChanges();
  const labels = () => [...el.querySelectorAll('.recs-filters .ms-trigger')].map(b => b.textContent!.replace(/\s+/g, ' ').trim());
  const dropdown = (label: string) =>
    [...el.querySelectorAll('.recs-filters app-multi-select')].find(d => d.querySelector('.ms-label')!.textContent!.startsWith(label))!;
  const open = (label: string) => { dropdown(label).querySelector<HTMLButtonElement>('.ms-trigger')!.click(); render(); };
  const options = (label: string) => [...dropdown(label).querySelectorAll('.ms-option')].map(o => o.textContent!.trim());
  const tick = (label: string, option: string) => {
    if (!dropdown(label).querySelector('.ms-panel')) open(label);
    [...dropdown(label).querySelectorAll('.ms-option')].find(o => o.textContent!.trim() === option)!.querySelector('input')!.click();
    render();
  };
  const recTitles = () => [...el.querySelectorAll('.rec-title')].map(t => t.textContent!.trim());

  it('replaces the chip rows: one-stop trips get only the Categories dropdown', () => {
    render();
    expect(el.querySelector('.filter-chips')).toBeNull();
    expect(labels()).toEqual(['Categories: All']);
  });

  it('multi-stop trips get Places, then Categories, on one row', () => {
    trip.set(TWO_STOPS);
    render();
    expect(labels()).toEqual(['Places: All', 'Categories: All']);
    open('Places');
    expect(options('Places')).toEqual(['Berlin, Germany', 'Prague, Czechia', 'Anywhere']);
  });

  it('lists the group\'s own categories after the usual ones', () => {
    recs.set([rec('a', 'Nightlife', 'Berghain')]);
    render();
    open('Categories');
    expect(options('Categories')).toEqual(['Food', 'Drink', 'Places', 'Activities', 'Tips', 'Culture', 'Nightlife']);
  });

  it('shows the recs of every ticked category, and the button names them', () => {
    recs.set([rec('a', 'Food', 'Currywurst'), rec('b', 'Drink', 'Club Mate'), rec('c', 'Tips', 'Carry cash')]);
    render();
    tick('Categories', 'Food');
    tick('Categories', 'Drink');
    expect(recTitles()).toEqual(['Currywurst', 'Club Mate']);
    expect(labels()).toEqual(['Categories: Food, Drink']);
  });

  it('shows the recs of every ticked place', () => {
    trip.set(TWO_STOPS);
    recs.set([rec('a', 'Food', 'Currywurst', 'Berlin, Germany'), rec('b', 'Food', 'Trdelník', 'Prague, Czechia'), rec('c', 'Tips', 'Carry cash')]);
    render();
    tick('Places', 'Prague, Czechia');
    tick('Places', 'Anywhere');
    expect(recTitles()).toEqual(['Trdelník', 'Carry cash']);
  });
});
