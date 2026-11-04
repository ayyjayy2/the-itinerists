import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService, UseEmailToSignInError } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { LocalCacheService } from '../../services/local-cache.service';
import { ErrorLoggerService } from '../../services/error-logger.service';

describe('LoginComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let logger: { logDiagnostic: jasmine.Spy };
  let user: { sessionEnded: ReturnType<typeof signal<boolean>>; signInStalled: ReturnType<typeof signal<boolean>> };

  beforeEach(() => {
    user = { sessionEnded: signal(false), signInStalled: signal(false) };
    logger = { logDiagnostic: jasmine.createSpy('logDiagnostic') };
    auth = jasmine.createSpyObj('AuthService', ['login']);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: user },
        { provide: TripService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
        { provide: ErrorLoggerService, useValue: logger },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  // #703: sign-in gave up waiting for the account; say what happened, once.
  it('says so when the last sign-in couldn\'t reach the account', () => {
    user.signInStalled.set(true);
    const { fixture } = create();
    expect((fixture.nativeElement as HTMLElement).querySelector('.auth-notice')!.textContent).toContain("couldn't reach your account");
    expect(user.signInStalled()).toBeFalse();
  });

  // #712: a hang left no trace of which step it was stuck on. A slow step is noted in the app's log.
  describe('a slow sign-in', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('notes the step still waiting after 10 seconds', async () => {
      auth.login.and.returnValue(new Promise(() => {}));
      const { comp } = create();
      comp.email = 'maya'; comp.password = 'pw';
      void comp.submit();
      jasmine.clock().tick(10_001);
      expect(logger.logDiagnostic).toHaveBeenCalledWith(jasmine.stringMatching(/still waiting after 10 s .*checking the password/));
    });

    it('notes nothing when it is quick', async () => {
      auth.login.and.resolveTo();
      const { comp } = create();
      comp.email = 'maya'; comp.password = 'pw';
      await comp.submit();
      jasmine.clock().tick(20_000);
      expect(logger.logDiagnostic).not.toHaveBeenCalled();
    });
  });

  it('asks for an email', () => {
    const { fixture } = create();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input#email') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('you@example.com');
  });

  it('says to use your email, and that older username-only accounts still can', () => {
    const { fixture } = create();
    const hint = (fixture.nativeElement as HTMLElement).querySelector('#email-hint')!;
    expect(hint.textContent).toContain('Use the email on your account');
    expect(hint.textContent).toContain('can still use their username');
    expect((fixture.nativeElement as HTMLElement).querySelector('input#email')!.getAttribute('aria-describedby')).toBe('email-hint');
  });

  it('tells someone who typed their username to use their email', async () => {
    auth.login.and.rejectWith(new UseEmailToSignInError());
    const { comp } = create();
    comp.email = 'maya';
    comp.password = 'Sunshine2026';
    await comp.submit();
    expect(comp.error()).toBe('This account signs in with its email address, not its username.');
  });

  it('gives one message for a wrong email or password', async () => {
    auth.login.and.rejectWith({ code: 'auth/invalid-credential' });
    const { comp } = create();
    comp.email = 'maya@example.com';
    comp.password = 'nope';
    await comp.submit();
    expect(comp.error()).toBe('Wrong email or password. Check them and try again.');
  });

  it('says to wait when Firebase has paused sign-in after too many attempts, instead of "wrong password" (#405)', async () => {
    auth.login.and.rejectWith({ code: 'auth/too-many-requests' });
    const { comp } = create();
    comp.email = 'maya@example.com';
    comp.password = 'nope';
    await comp.submit();
    expect(comp.error()).toBe('Too many attempts. Please wait a few minutes and try again.');
  });
});
