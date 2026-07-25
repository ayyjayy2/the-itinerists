import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NotificationBellComponent } from './notification-bell.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ActivityLogEntry } from '../../models/trip.models';

const entries: ActivityLogEntry[] = [
  { id: 'e1', action: 'member_added', targetUid: 't', targetName: 'Tess',
    performedByUid: 'other', performedByName: 'Pat', timestamp: 2000 },
  { id: 'e2', action: 'member_added', targetUid: 't', targetName: 'Ann',
    performedByUid: 'me', performedByName: 'Me', timestamp: 3000 },
];

describe('NotificationBellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeActivity: signal(entries) } },
        { provide: UserService, useValue: { firestoreUser: signal({ uid: 'me', lastSeenActivityAt: 1000 }) } },
      ],
    });
  });

  it('badges only others’ unseen entries and lists them in the dropdown', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bell-badge')?.textContent?.trim()).toBe('1');
    (el.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.bell-head')?.textContent).toContain('1 update');
    expect(el.textContent).toContain('Tess joined the trip');
  });
});
