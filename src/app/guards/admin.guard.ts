import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../services/user.service';

/** App admins only (users/{uid}.isAdmin). Others go to Home; signed-out visitors to the login page. */
export const adminGuard = async () => {
  const userService = inject(UserService);
  const auth        = inject(Auth);
  const router      = inject(Router);

  await userService.authReadyPromise;

  if (!userService.hasUser()) {
    if (!auth.currentUser) return router.createUrlTree(['/login']);
    // Auth knows the user but the profile is still streaming in.
    try { await userService.waitForUser(); }
    catch { return router.createUrlTree(['/login']); }
  }
  return userService.isAdmin() ? true : router.createUrlTree(['/home']);
};
