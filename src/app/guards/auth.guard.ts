import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';

export const authGuard = async () => {
  const userService = inject(UserService);
  const router      = inject(Router);

  // Wait for Firebase Auth to resolve before deciding
  await userService.authReadyPromise;

  if (userService.hasUser()) return true;
  return router.createUrlTree(['/login']);
};
