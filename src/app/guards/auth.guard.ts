import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../services/user.service';
import { NATIVE_PLATFORM } from '../native-platform';
import { FirestoreResumeService } from '../services/firestore-resume.service';
import { StalledError, waitWithNudge } from '../utils/wait-with-nudge';

/** How long sign-in waits for the profile before restarting the connection, and before giving up (#703). */
const PROFILE_WAIT = { nudgeAfterMs: 6000, giveUpAfterMs: 20000 };

export const authGuard = async () => {
  const userService = inject(UserService);
  const auth        = inject(Auth);
  const router      = inject(Router);
  const native      = inject(NATIVE_PLATFORM);
  const connection  = inject(FirestoreResumeService);

  // Wait for Firebase Auth to resolve before deciding
  await userService.authReadyPromise;

  if (userService.hasUser()) return true;

  // Sign-in goes to Home as soon as Firebase Auth accepts the password, before
  // the profile document has streamed in. Auth knows the user, so wait for the
  // profile here rather than bouncing back to the login page. Not forever: a
  // stalled connection (iPhone app) is restarted, as a refresh would, and after
  // that the sign-in page says what happened instead of spinning (#703).
  if (auth.currentUser) {
    try {
      await waitWithNudge(userService.waitForUser(), () => connection.restart(), PROFILE_WAIT);
      return true;
    } catch (err) {
      if (err instanceof StalledError) userService.signInStalled.set(true);
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
