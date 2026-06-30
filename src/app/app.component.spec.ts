import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

import { AppComponent } from './app.component';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { DataService } from './services/data.service';
import { TripService } from './services/trip.service';
import { UsersService } from './services/users.service';
import { ExpensesService } from './services/expenses.service';
import { PackingService } from './services/packing.service';
import { FlightsService } from './services/flights.service';
import { ItineraryService } from './services/itinerary.service';
import { StaysService } from './services/stays.service';
import { FinanceService } from './services/finance.service';
import { RecsService } from './services/recs.service';
import { OutfitsService } from './services/outfits.service';

/**
 * AppComponent pulls in the full service graph (UserService → Firebase Auth,
 * the per-feature Firestore services, TripService, etc.). Rather than spin up
 * real Firebase in a unit test, we stub every injected service so the
 * component can be constructed in isolation. The data services expose a no-op
 * `init()` because AppComponent calls them from its login effect.
 */
const initStub = () => ({ init: () => {} });

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: UserService,
          useValue: {
            currentUser: signal(null),
            isAdmin: signal(false),
            authInitialized: signal(true),
          },
        },
        {
          provide: TripService,
          useValue: {
            activeTrip: signal(null),
            activeMembers: signal([]),
            hiddenPages: signal<string[]>([]),
          },
        },
        { provide: AuthService, useValue: {} },
        { provide: DataService, useValue: initStub() },
        { provide: UsersService, useValue: initStub() },
        { provide: ExpensesService, useValue: initStub() },
        { provide: PackingService, useValue: initStub() },
        { provide: FlightsService, useValue: initStub() },
        { provide: ItineraryService, useValue: initStub() },
        { provide: StaysService, useValue: initStub() },
        { provide: FinanceService, useValue: initStub() },
        { provide: RecsService, useValue: initStub() },
        { provide: OutfitsService, useValue: initStub() },
        { provide: SwUpdate, useValue: { isEnabled: false } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('exposes the base navigation items', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const paths = app.navItems().map(i => i.path);
    expect(paths).toContain('/home');
    expect(paths).toContain('/trip-settings');
  });

  it('hides pages the member toggled off and excludes Admin for non-admins', () => {
    const tripService = TestBed.inject(TripService) as unknown as { hiddenPages: WritableSignal<string[]> };
    tripService.hiddenPages.set(['outfits']);
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const paths = app.navItems().map(i => i.path);
    expect(paths).not.toContain('/outfits');
    expect(paths).not.toContain('/admin');
  });
});
