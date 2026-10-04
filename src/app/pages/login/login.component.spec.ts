import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService, UseEmailToSignInError } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { LocalCacheService } from '../../services/local-cache.service';

describe('LoginComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['login']);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: { sessionEnded: signal(false) } },
        { provide: TripService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  it('asks for an email', () => {
    const { fixture } = create();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input#email') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('you@example.com');
  });

  it('tells someone who typed their username to use their email', async () => {
    auth.login.and.rejectWith(new UseEmailToSignInError());
    const { comp } = create();
    comp.email = 'maya';
    comp.password = 'Sunshine2026';
    await comp.submit();
    expect(comp.error()).toContain('Use your email address');
  });

  it('gives one message for a wrong email or password', async () => {
    auth.login.and.rejectWith({ code: 'auth/invalid-credential' });
    const { comp } = create();
    comp.email = 'maya@example.com';
    comp.password = 'nope';
    await comp.submit();
    expect(comp.error()).toBe('Wrong email or password. Check them and try again.');
  });
});
