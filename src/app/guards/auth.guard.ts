import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../services/user.service';
import { NATIVE_PLATFORM } from '../native-platform';

export const authGuard = async () => {
  const userService = inject(UserService);
  const auth        = inject(Auth);
  const router      = inject(Router);
  const native      = inject(NATIVE_PLATFORM);

  // Wait for Firebase Auth to resolve before deciding
  await userService.authReadyPromise;

  if (userService.hasUser()) return true;

  // Sign-in goes to Home as soon as Firebase Auth accepts the password, before
  // the profile document has streamed in. Auth knows the user, so wait for the
  // profile here rather than bouncing back to the login page.
  if (auth.currentUser) {
    try {
      await userService.waitForUser();
      return true;
    } catch (err) {
      console.error('[authGuard] profile did not load:', err);
      return router.createUrlTree(['/login']);   // they have an account: sign in again
    }
  }
  // Signed out: the website introduces the app first; the iPhone app is
  // already installed, so it goes straight to signing in.
  return router.createUrlTree([native ? '/login' : '/welcome']);
};

/** The welcome page is for signed-out visitors on the website only. */
export const welcomeGuard = async () => {
  const userService = inject(UserService);
  const auth        = inject(Auth);
  const router      = inject(Router);
  const native      = inject(NATIVE_PLATFORM);
  await userService.authReadyPromise;
  if (userService.hasUser() || auth.currentUser) return router.createUrlTree(['/home']);
  if (native) return router.createUrlTree(['/login']);
  return true;
};
