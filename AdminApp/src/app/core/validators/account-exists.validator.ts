import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, catchError, first, map, of, switchMap, timer } from 'rxjs';

import { AccountExistsLookup } from '../tokens/account-exists-lookup.token';

export const ACCOUNT_MISSING_ERROR = 'accountMissing';

/**
 * Async on-blur e-mail existence check (F-1 rule 3).
 *
 * Fails open by design: when the lookup cannot answer, the field stays valid so the
 * form is never blocked by an unavailable endpoint. Keycloak remains the authority
 * on whether the credentials are correct.
 */
export function accountExistsValidator(
  lookup: AccountExistsLookup,
  debounceMs = 300
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value: unknown = control.value;

    if (typeof value !== 'string' || value.trim().length === 0 || !value.includes('@')) {
      return of(null);
    }

    const email = value.trim();

    return timer(debounceMs).pipe(
      switchMap(() => lookup(email)),
      map((exists) => (exists === false ? { [ACCOUNT_MISSING_ERROR]: true } : null)),
      catchError(() => of(null)),
      first()
    );
  };
}
