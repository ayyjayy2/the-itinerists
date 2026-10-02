import { TestBed } from '@angular/core/testing';
import { Component, signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
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

/** The real card boots a map; a stub with the same selector keeps the test cheap. */
@Component({ selector: 'app-day-map-card', template: '<div data-stub="day-map"></div>' })
class StubDayMapCard {}

const trip = {
  id: 't1', name: 'Berlin', destination: 'Berlin, Germany',
  startDate: '2026-10-01', endDate: '2026-10-09', currency: 'EUR', memberCount: 2,
};

describe('HomeComponent (hidden pages)', () => {
  let hidden: WritableSignal<string[]>;
  let firestoreUser: WritableSignal<any>;
  let activeMembers: ReturnType<typeof signal<any[]>>;

  beforeEach(async () => {
    hidden = signal<string[]>([]);
    // homeLayout is honoured only for picker accounts; username 'alayna' is one.
    activeMembers = signal<any[]>([]);
    firestoreUser = signal<any>({ uid: 'me', username: 'alayna', homeLayout: 'C', homePins: ['/finance', '/packing'] });

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
        { provide: FinanceService,   useValue: { entries: signal([]) } },
        { provide: PackingService,   useValue: { items: signal([]) } },
        { provide: WeatherService,   useValue: { weather: signal({}), loadMany: () => {} } },
        { provide: StaysService,     useValue: { stays: signal([]) } },
        { provide: RecsService,      useValue: { recs: signal([]) } },
        { provide: ExpensesService,  useValue: { expenses: signal([]) } },
        { provide: DataService,      useValue: { data: signal(null) } },
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
});

