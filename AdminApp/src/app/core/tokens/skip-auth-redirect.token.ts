import { HttpContextToken } from '@angular/common/http';

/**
 * Marks a Gateway request whose 401/403 must NOT be treated as a session rejection.
 *
 * `authErrorInterceptor` clears the session and navigates to `/sign-in` on a Gateway 401,
 * which is correct for ordinary requests. Some requests run *during* sign-in and handle
 * their own failures (e.g. the fail-open profile-status probe in `AuthService`); a 401 there
 * must stay local, otherwise a successful token exchange bounces the user back to sign-in.
 *
 * Defaults to `false`: every request is a session-bearing request unless it opts out.
 */
export const SKIP_AUTH_REDIRECT = new HttpContextToken<boolean>(() => false);
