import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { authGuard, welcomeGuard } from './auth.guard';
import { NATIVE_PLATFORM } from '../native-platform';
import { UserService } from '../services/user.service';

describe('authGuard', () => {
  let hasUser: boolean;
  let currentUser: object | null;
  let waitForUser: jasmine.Spy;
  let native: boolean;

  function run() {
    return TestBed.runInInjectionContext(() => authGuard());
  }

  beforeEach(() => {
    hasUser = false;
    native = false;
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
        { provide: NATIVE_PLATFORM, useFactory: () => native },
      ],
    });
  });

  it('allows a user whose profile has loaded', async () => {
    hasUser = true;
    expect(await run()).toBeTrue();
    expect(waitForUser).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor on the website to the welcome page', async () => {
    const result = await run();
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/welcome');
    expect(waitForUser).not.toHaveBeenCalled();
  });

  it('sends a signed-out person in the iPhone app straight to sign in', async () => {
    native = true;
    const result = await run();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
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

describe('welcomeGuard', () => {
  let hasUser: boolean;
  let currentUser: object | null;
  let native: boolean;
  const run = () => TestBed.runInInjectionContext(() => welcomeGuard());

  beforeEach(() => {
    hasUser = false; currentUser = null; native = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: { authReadyPromise: Promise.resolve(), hasUser: () => hasUser } },
        { provide: Auth, useValue: { get currentUser() { return currentUser; } } },
        { provide: NATIVE_PLATFORM, useFactory: () => native },
      ],
    });
  });

  it('shows the welcome page to someone signed out on the website', async () => {
    expect(await run()).toBeTrue();
  });

  it('sends someone already signed in to Home', async () => {
    currentUser = { uid: 'u1' };
    expect(TestBed.inject(Router).serializeUrl(await run() as UrlTree)).toBe('/home');
  });

  it('sends the iPhone app to sign in instead', async () => {
    native = true;
    expect(TestBed.inject(Router).serializeUrl(await run() as UrlTree)).toBe('/login');
  });
});
