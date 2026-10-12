import { TestBed } from '@angular/core/testing';
import { Component, signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EmailConfirmService } from '../../services/email-confirm.service';
import { HomeComponent } from './home.component';
import { DayMapCardComponent } from '../../shared/day-map-card/day-map-card.component';
import { UserService } from '../../services/user.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';
import { FlightsService } from '../../services/flights.service';
import { TripService } from '../../services/trip.service';
import { TripContextService } from '../../services/trip-context.service';
import { ItineraryService } from '../../services/itinerary.service';
import { FinanceService } from '../../services/finance.service';
import { PackingService } from '../../services/packing.service';
import { WeatherService } from '../../services/weather.service';
import { StaysService } from '../../services/stays.service';
import { RecsService } from '../../services/recs.service';
import { ExpensesService } from '../../services/expenses.service';
import { DataService } from '../../services/data.service';
import { SurveyService } from '../../services/survey.service';

/** The real card boots a map; a stub with the same selector keeps the test cheap. */
@Component({ selector: 'app-day-map-card', template: '<div data-stub="day-map"></div>' })
class StubDayMapCard {}

const trip = {
  id: 't1', name: 'Berlin', destination: 'Berlin, Germany',
  startDate: '2026-10-01', endDate: '2026-10-09', currency: 'EUR', memberCount: 2,
};

describe('HomeComponent (hidden pages)', () => {
  let hidden: WritableSignal<string[]>;
  let financeEntries: WritableSignal<any[]>;
  let firestoreUser: WritableSignal<any>;
  let activeMembers: ReturnType<typeof signal<any[]>>;
  let survey: { config: WritableSignal<any>; text: WritableSignal<any>; view: WritableSignal<string>; pending: WritableSignal<boolean>; popupOpen: WritableSignal<boolean>; take: jasmine.Spy; closePopup: jasmine.Spy; dismissBanner: jasmine.Spy };
  let confirmStub: { waiting: ReturnType<typeof signal<string>>; sentAt: ReturnType<typeof signal<number>>; send: jasmine.Spy };

  beforeEach(async () => {
    hidden = signal<string[]>([]);
    financeEntries = signal<any[]>([]);
    // homeLayout is honoured only for picker accounts (layoutPicker).
    activeMembers = signal<any[]>([]);
    survey = {
      config: signal({ id: 's1', active: true, url: 'https://example.com/form', title: 'Hi, I made this', body: 'How did it go?', bannerText: 'Got 5 minutes?' }),
      text: signal({ title: 'Hi, I made this', body: 'How did Berlin go?', bannerText: 'Got 5 minutes? Tell me how Berlin went.' }),
      view: signal('none'), pending: signal(false), popupOpen: signal(false),
      take: jasmine.createSpy('take'), closePopup: jasmine.createSpy('closePopup'), dismissBanner: jasmine.createSpy('dismissBanner'),
    };
    confirmStub = { waiting: signal(''), sentAt: signal(0), send: jasmine.createSpy('send').and.resolveTo(true) };
    try { sessionStorage.removeItem('confirmNudgeDismissed'); } catch { /* none */ }
    firestoreUser = signal<any>({ uid: 'me', username: 'maya', layoutPicker: true, homeLayout: 'C', homePins: ['/finance', '/packing'] });

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: {
          currentUser: signal({ uid: 'me', name: 'Alayna' }), isAdmin: signal(false),
          firestoreUser, updateHomePins: () => Promise.resolve(),
        } },
        { provide: TripService, useValue: {
          activeTrip: signal(trip), ready: signal(true), activeMembers,
          hiddenPages: hidden, activeActivity: signal([]),
          getUserTrips: () => Promise.resolve([trip]), switchTrip: () => Promise.resolve(),
        } },
        { provide: TripContextService, useValue: { activeTripId: signal('t1') } },
        { provide: FlightCountdownService, useValue: {} },
        { provide: FlightsService,   useValue: { flights: signal([]), loaded: signal(true) } },
        { provide: ItineraryService, useValue: { items: signal([]), loaded: signal(true) } },
        { provide: FinanceService,   useValue: { entries: financeEntries } },
        { provide: PackingService,   useValue: { items: signal([]) } },
        { provide: WeatherService,   useValue: { weather: signal({}), loadMany: () => {} } },
        { provide: StaysService,     useValue: { stays: signal([]) } },
        { provide: RecsService,      useValue: { recs: signal([]) } },
        { provide: ExpensesService,  useValue: { expenses: signal([]) } },
        { provide: DataService,      useValue: { data: signal(null) } },
        { provide: EmailConfirmService, useValue: confirmStub },
        { provide: SurveyService, useValue: survey },
      ],
    })
    .overrideComponent(HomeComponent, {
      remove: { imports: [DayMapCardComponent] },
      add:    { imports: [StubDayMapCard] },
    })
    .compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }
  const widgets = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-widget]')).map(n => n.getAttribute('data-widget'));

  it('shows only the four default widgets when nothing is hidden', () => {
    const el = render().nativeElement as HTMLElement;
    expect(widgets(el)).toEqual(['itinerary', 'finance', 'packing', 'outfits']);
    expect(el.querySelector('[data-stub="day-map"]')).not.toBeNull();
  });

  it('hiding a default widget backfills it with the next visible page, keeping four', () => {
    hidden.set(['finance', 'transportation']);
    const el = render().nativeElement as HTMLElement;
    expect(widgets(el)).toEqual(['itinerary', 'packing', 'outfits', 'flights']);
  });

  it('hiding a backup page changes nothing while the defaults are all shown', () => {
    hidden.set(['flights', 'recs']);
    const el = render().nativeElement as HTMLElement;
    expect(widgets(el)).toEqual(['itinerary', 'finance', 'packing', 'outfits']);
  });

  it('hiding Map removes the day-map card', () => {
    hidden.set(['map']);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('[data-stub="day-map"]')).toBeNull();
  });

  it('a hidden page has no pin tile and is not offered in the pin editor', () => {
    hidden.set(['finance']);
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const tiles = Array.from(el.querySelectorAll('.pin-tile')).map(a => a.textContent?.trim());
    expect(tiles).toEqual(['Packing']);

    fixture.componentInstance.togglePinEdit();
    fixture.detectChanges();
    const options = Array.from(el.querySelectorAll('.pin-opt')).map(b => b.textContent?.replace('✓', '').trim());
    expect(options).not.toContain('Finance');
    expect(options).toContain('Packing');
  });

  it('the Simple layout quick-access grid skips hidden pages', () => {
    firestoreUser.set({ ...firestoreUser(), homeLayout: 'B' });
    hidden.set(['map', 'recs']);
    const el = render().nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('.link-label')).map(n => n.textContent?.trim());
    expect(labels).toContain('Itinerary');
    expect(labels).not.toContain('Map');
    expect(labels).not.toContain('Recs');
  });

  it('shows a live fact on the backup widgets once they are in', () => {
    hidden.set(['packing', 'outfits', 'flights', 'transportation', 'expenses']);   // → itinerary, finance, accommodations, recs
    const stays = TestBed.inject(StaysService) as unknown as { stays: WritableSignal<any[]> };
    stays.stays.set([{ id: 's', name: 'Adlon', checkIn: '2000-01-01', checkOut: '2999-01-01' }]);
    const recs = TestBed.inject(RecsService) as unknown as { recs: WritableSignal<any[]> };
    recs.recs.set([{ id: 'r', title: 'Café Einstein', createdAt: 5, category: 'Food' }]);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('[data-widget="accommodations"]')?.textContent).toContain('Tonight: Adlon');
    expect(el.querySelector('[data-widget="recs"]')?.textContent).toContain('1 rec');
    expect(el.querySelector('[data-widget="recs"]')?.textContent).toContain('Café Einstein');
  });

  it('the hero counts the members it shows, not the stored counter', () => {
    // Stored counter says 2, but three people are on the trip.
    activeMembers.set([
      { uid: 'me', displayName: 'Alayna', joinedAt: 1 },
      { uid: 'tico', displayName: 'Tico', joinedAt: 2 },
      { uid: 'rafa', displayName: 'Rafa', joinedAt: 3 },
    ]);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.hero-people-label')?.textContent?.trim()).toBe('you + 2 friends');
  });

  it('reminds a person to confirm their email, offers the link, and never blocks the page', () => {
    // A new account: a real email on file (so no recovery prompt), not yet confirmed.
    firestoreUser.update((u: any) => ({ ...u, authEmail: 'makaela@gmail.com' }));
    confirmStub.waiting.set('makaela@gmail.com');
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const nudge = el.querySelector('.confirm-nudge');
    expect(nudge?.textContent).toContain('Confirm your email');
    expect(nudge?.textContent).toContain('m•••@gmail.com');
    expect(el.querySelector('.hero-people-label, .welcome-card, [data-widget]')).not.toBeNull();   // the page is all there
    (nudge!.querySelector('button.btn') as HTMLButtonElement).click();
    expect(confirmStub.send).toHaveBeenCalled();
  });

  it('shows no confirmation reminder once the email is confirmed', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.confirm-nudge')).toBeNull();
  });

  it('shows the survey banner on a later visit, with the link and a close button', () => {
    survey.view.set('banner'); survey.pending.set(true);
    const el = render().nativeElement as HTMLElement;
    const banner = el.querySelector('.survey-nudge')!;
    expect(banner.textContent).toContain('Got 5 minutes? Tell me how Berlin went.');
    expect(banner.querySelector<HTMLAnchorElement>('a.btn')!.href).toBe('https://example.com/form');
    (banner.querySelector('button[aria-label="Not now"]') as HTMLButtonElement).click();
    expect(survey.dismissBanner).toHaveBeenCalled();
  });

  it('puts the survey banner first: no email reminder while it shows', () => {
    survey.view.set('banner'); survey.pending.set(true);
    confirmStub.waiting.set('maya@example.com');                 // unconfirmed email
    const el = render().nativeElement as HTMLElement;            // and no recovery email on file
    expect(el.querySelector('.survey-nudge')).not.toBeNull();
    expect(el.querySelector('.confirm-nudge')).toBeNull();
    expect(el.querySelectorAll('.recovery-nudge').length).toBe(1);
  });

  it('holds back the email reminders while the survey is still pending, even with no survey banner this visit', () => {
    survey.pending.set(true);                 // e.g. the pop-up was just closed
    confirmStub.waiting.set('maya@example.com');
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.recovery-nudge')).toBeNull();
  });

  it('brings the email reminders back once the survey banner is gone', () => {
    confirmStub.waiting.set('maya@example.com');
    firestoreUser.update((u: any) => ({ ...u, authEmail: 'maya@example.com' }));
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.confirm-nudge')).not.toBeNull();
    expect(el.querySelector('.survey-nudge')).toBeNull();
  });

  it('the expenses widget never adds different currencies together (#409)', () => {
    const e = (amount: number, currency: string) => ({ id: currency, date: '2026-10-02', description: 'x', amount, currency, paidBy: 'Alayna', splitAmong: 'All', category: 'Food', addedByUid: 'me', createdAt: 1 });
    financeEntries.set([e(300, 'EUR'), e(12, 'USD')]);
    const el = render().nativeElement as HTMLElement;
    const widget = el.querySelector('[data-widget="finance"]')!.textContent!;
    expect(widget).toContain('€300.00 + $12.00 tracked so far');
    expect(widget).not.toContain('312');
    expect(widget).not.toMatch(/You('re owed| owe)/);   // a single balance would mix currencies: Finance converts properly
  });

  it('the expenses widget keeps the balance when everything is in the trip currency', () => {
    const e = (amount: number) => ({ id: String(amount), date: '2026-10-02', description: 'x', amount, currency: 'EUR', paidBy: 'Alayna', splitAmong: 'All', category: 'Food', addedByUid: 'me', createdAt: 1 });
    financeEntries.set([e(300)]);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('[data-widget="finance"]')!.textContent).toContain('€300.00 tracked so far');
  });

  it('shows no survey banner when there is nothing to show', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.survey-nudge')).toBeNull();
  });
});
