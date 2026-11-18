import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, first, map, switchMap } from 'rxjs/operators';

/**
 * Looks up whether an email is already registered.
 *
 * The lookup is injected instead of a concrete service so the validator stays
 * transport-agnostic and unit-testable; the caller owns the generated-client call.
 */
export type EmailTakenLookup = (email: string) => Observable<boolean>;

/**
 * Async duplicate-email validator.
 *
 * Only runs for syntactically plausible addresses (the synchronous `email` validator
 * owns format errors) and fails open: a lookup failure must not block the user,
 * the backend still rejects duplicates with a 409.
 */
export function emailUniqueValidator(
  lookup: EmailTakenLookup,
  debounceMs = 300
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value: unknown = control.value;
    const email = typeof value === 'string' ? value.trim() : '';

    if (email.length === 0 || !email.includes('@')) {
      return of(null);
    }

    return timer(debounceMs).pipe(
      switchMap(() => lookup(email)),
      map((isTaken) => (isTaken ? { emailTaken: true } : null)),
      catchError(() => of(null)),
      first()
    );
  };
}
