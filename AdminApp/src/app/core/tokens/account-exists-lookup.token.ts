import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment.development';
import { isEmailExistsResponse } from '../models/auth.model';
import { SILENT_HTTP_ERROR } from './silent-http-error.token';

/**
 * Resolves whether an account exists for an e-mail address.
 * `null` means "unknown" (endpoint missing or failing) and must not block the form.
 */
export type AccountExistsLookup = (email: string) => Observable<boolean | null>;

/**
 * Temporary hand-written access to the proposed endpoint
 * `GET /profiles/accounts/exists?email=…` (see `contracts/profiles-sign-in.contract.md` §1).
 * Replace with the generated Profiles API client once the endpoint is implemented.
 */
export function createAccountExistsLookup(
  http: HttpClient,
  apiUrl: string
): AccountExistsLookup {
  let warned = false;
  let missing = false;

  return (email: string) => {
    // The endpoint is documented as not implemented. After the first 404 the answer
    // cannot change during this app lifetime, so stop probing (and stop logging).
    if (missing) {
      return of(null);
    }

    return http
      .get<unknown>(`${apiUrl}/profiles/accounts/exists?email=${encodeURIComponent(email)}`, {
        context: new HttpContext().set(SILENT_HTTP_ERROR, true),
      })
      .pipe(
        map((payload) => (isEmailExistsResponse(payload) ? payload.exists : null)),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            missing = true;
          }

          if (!warned) {
            warned = true;
            console.warn(
              '[Auth] Sign-in e-mail existence endpoint unavailable; the "User with this email doesn\'t exist" rule is disabled (fail-open).'
            );
          }
          return of(null);
        })
      );
  };
}

export const ACCOUNT_EXISTS_LOOKUP = new InjectionToken<AccountExistsLookup>(
  'ACCOUNT_EXISTS_LOOKUP',
  {
    providedIn: 'root',
    factory: () => createAccountExistsLookup(inject(HttpClient), environment.apiUrl),
  }
);
