import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { adminGuard } from './admin.guard';
import { UserService } from '../services/user.service';

describe('adminGuard', () => {
  let hasUser: boolean;
  let isAdmin: boolean;
  let currentUser: object | null;

  const run = () => TestBed.runInInjectionContext(() => adminGuard());
  const target = (r: unknown) => TestBed.inject(Router).serializeUrl(r as UrlTree);

  beforeEach(() => {
    hasUser = false; isAdmin = false; currentUser = null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: {
          authReadyPromise: Promise.resolve(),
          hasUser: () => hasUser,
          isAdmin: () => isAdmin,
          waitForUser: () => { hasUser = true; return Promise.resolve({}); },
        } },
        { provide: Auth, useValue: { get currentUser() { return currentUser; } } },
      ],
    });
  });

  it('lets an app admin through', async () => {
    hasUser = true; isAdmin = true;
    expect(await run()).toBeTrue();
  });

  it('sends a signed-in non-admin to Home', async () => {
    hasUser = true;
    expect(target(await run())).toBe('/home');
  });

  it('sends a signed-out visitor to the login page', async () => {
    expect(target(await run())).toBe('/login');
  });

  it('waits for the profile before deciding when Auth already has the user', async () => {
    currentUser = { uid: 'u1' }; isAdmin = true;
    expect(await run()).toBeTrue();
  });
});
