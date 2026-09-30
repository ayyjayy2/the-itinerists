import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { authGuard } from './auth.guard';
import { UserService } from '../services/user.service';

describe('authGuard', () => {
  let hasUser: boolean;
  let currentUser: object | null;
  let waitForUser: jasmine.Spy;

  function run() {
    return TestBed.runInInjectionContext(() => authGuard());
  }

  beforeEach(() => {
    hasUser = false;
    currentUser = null;
    waitForUser = jasmine.createSpy('waitForUser').and.callFake(() => { hasUser = true; return Promise.resolve({}); });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: {
          authReadyPromise: Promise.resolve(),
          hasUser: () => hasUser,
          waitForUser: () => waitForUser(),
        } },
        { provide: Auth, useValue: { get currentUser() { return currentUser; } } },
      ],
    });
  });

  it('allows a user whose profile has loaded', async () => {
    hasUser = true;
    expect(await run()).toBeTrue();
    expect(waitForUser).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to the login page', async () => {
    const result = await run();
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
    expect(waitForUser).not.toHaveBeenCalled();
  });

  // Right after "Sign in" Firebase Auth knows the user but the profile
  // document is still on its way; the guard must wait for it, not bounce.
  it('waits for the profile when Firebase Auth already has the user', async () => {
    currentUser = { uid: 'u1' };
    expect(await run()).toBeTrue();
    expect(waitForUser).toHaveBeenCalled();
  });

  it('sends to the login page when the profile cannot be loaded', async () => {
    currentUser = { uid: 'u1' };
    waitForUser.and.returnValue(Promise.reject(new Error('Missing or insufficient permissions.')));
    const result = await run();
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});
