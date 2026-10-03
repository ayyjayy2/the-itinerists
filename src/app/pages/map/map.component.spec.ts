import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';
import { MapComponent } from './map.component';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { AirportZoneService } from '../../services/airport-zone.service';
import { FocusService } from '../../services/focus.service';

const trip = {
  id: 't1', name: 'Berlin', destination: 'Berlin, Germany',
  startDate: '2026-10-01', endDate: '2026-10-09', currency: 'EUR', memberCount: 2,
};

describe('MapComponent', () => {
  let activeTrip: ReturnType<typeof signal<any>>;

  beforeEach(async () => {
    activeTrip = signal<any>(null);
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeTrip, ready: signal(true) } },
        // No trip data yet: boot() waits for it, which is enough to see the map start.
        { provide: DataService, useValue: { data: signal(null) } },
        { provide: UserService, useValue: { currentUser: signal({ uid: 'me', name: 'Maya' }) } },
        { provide: Firestore, useValue: {} },
        { provide: AirportZoneService, useValue: {} },
        { provide: FocusService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('starts the map when the trip arrives after the page opened (direct load)', async () => {
    const fixture = TestBed.createComponent(MapComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#trip-map')).toBeNull();

    activeTrip.set(trip);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement | null = fixture.nativeElement.querySelector('#trip-map');
    expect(el).not.toBeNull();
    expect(el!.classList).toContain('leaflet-container');
    fixture.destroy();
  });

  it('starts the map straight away when the trip is already loaded', async () => {
    activeTrip.set(trip);
    const fixture = TestBed.createComponent(MapComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#trip-map').classList).toContain('leaflet-container');
    fixture.destroy();
  });
});
