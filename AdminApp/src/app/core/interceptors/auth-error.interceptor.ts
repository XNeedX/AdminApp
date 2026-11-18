import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { isGatewayUrl } from '../utils/gateway-url';

/**
 * Global session rejection handler: a 401 from the Gateway means the session is no
 * longer valid, so it is cleared once and the user returns to the sign-in page.
 * 401 responses from Keycloak (wrong credentials) are not session rejections.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isGatewayUrl(req.url)
      ) {
        auth.clearSession();
        void router.navigate(['/sign-in'], { replaceUrl: true });
      }

      return throwError(() => error);
    })
  );
};
