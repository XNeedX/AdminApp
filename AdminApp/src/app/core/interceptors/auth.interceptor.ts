import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { isAnonymousGatewayUrl, isGatewayUrl } from '../utils/gateway-url';

/**
 * Attaches the session bearer token to Gateway requests only.
 * Keycloak endpoints and the anonymous e-mail existence check are left untouched.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isGatewayUrl(req.url) || isAnonymousGatewayUrl(req.url)) {
    return next(req);
  }

  const token = inject(AuthService).accessToken();
  if (token === null) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
