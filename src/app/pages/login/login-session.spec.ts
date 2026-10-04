import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { LocalCacheService } from '../../services/local-cache.service';

describe('LoginComponent after a session ends', () => {
  function create(sessionEnded: boolean) {
    const userService = { sessionEnded: signal(sessionEnded) };
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: UserService, useValue: userService },
        { provide: TripService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { text: (fixture.nativeElement as HTMLElement).textContent ?? '', userService };
  }

  it('says why the person was signed out, once', () => {
    const { text, userService } = create(true);
    expect(text).toContain('For your security, please sign in again');
    expect(userService.sessionEnded()).toBeFalse();
  });

  it('says nothing on an ordinary visit', () => {
    expect(create(false).text).not.toContain('please sign in again');
  });
});
