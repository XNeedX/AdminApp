import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/**
 * Restricts a route to signed-in users that hold at least one of the allowed roles.
 *
 * Unauthenticated users are sent to `/sign-in`; authenticated users without a matching
 * role are sent to `/`. Returning a `UrlTree` keeps the guard side-effect free.
 */
export function roleGuard(...allowed: readonly AuthRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/sign-in']);
    }

    const roles = auth.user()?.roles ?? [];
    const isAllowed = roles.some((role) => allowed.includes(role));

    return isAllowed ? true : router.createUrlTree(['/']);
  };
}
