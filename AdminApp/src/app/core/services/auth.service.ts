import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, switchMap, timeout } from 'rxjs';

import { environment } from '../../../environments/environment.development';
import { SILENT_HTTP_ERROR } from '../tokens/silent-http-error.token';
import { SKIP_AUTH_REDIRECT } from '../tokens/skip-auth-redirect.token';
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthRole,
  AuthSession,
  SignInOutcome,
  TokenResponse,
  isAuthRole,
  isAuthSession,
  isPermittedProfileStatus,
  isProfileStatusResponse,
  isTokenErrorResponse,
  isTokenResponse,
  parseJwtClaims,
} from '../models/auth.model';

/** Public client used for the password/refresh grants. Change here if a dedicated client is created. */
export const AUTH_CLIENT_ID = 'public-client';

const REALM = 'InnoClinic';
const REFRESH_LEAD_MS = 60_000;
const AUTH_REQUEST_TIMEOUT_MS = 30_000;
const PROFILE_REQUEST_TIMEOUT_MS = 5_000;
const LOGOUT_REQUEST_TIMEOUT_MS = 3_000;

const FORM_HEADERS = new HttpHeaders({
  'Content-Type': 'application/x-www-form-urlencoded',
});

/** Marker for malformed-but-successful responses and request timeouts. */
class TemporaryAuthError extends Error {}

/**
 * Owns the authenticated session: Keycloak token calls, session persistence,
 * profile-status authorization and sign-out.
 *
 * This is the single place allowed to call Keycloak OIDC endpoints (documented
 * exception to the generated-API-client rule — see `contracts/keycloak-auth.contract.md`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly sessionState = signal<AuthSession | null>(null);
  private readonly warnedKeys = new Set<string>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set after the first 404: the proposed profile-status endpoint is not implemented. */
  private profileStatusUnavailable = false;

  readonly session = this.sessionState.asReadonly();

  readonly user = computed(() => {
    const session = this.sessionState();
    if (session === null) {
      return null;
    }

    const claims = parseJwtClaims(session.accessToken);
    if (claims === null) {
      return null;
    }

    return {
      accountId: claims.sub,
      email: claims.email,
      roles: claims.roles.filter(isAuthRole),
    };
  });

  readonly accessToken = computed(() => this.sessionState()?.accessToken ?? null);

  readonly isAuthenticated = computed(
    () => this.sessionState() !== null && this.user() !== null
  );

  constructor() {
    this.restoreSession();
    this.destroyRef.onDestroy(() => this.clearRefreshTimer());
  }

  /**
   * Password grant sign-in followed by the profile-status gate.
   * Never throws; the outcome tells the page which message to show.
   */
  signIn(email: string, password: string): Observable<SignInOutcome> {
    const body = this.formBody({
      grant_type: 'password',
      client_id: AUTH_CLIENT_ID,
      username: email.trim(),
      password,
      scope: 'openid',
    });

    return this.http.post<unknown>(this.tokenEndpoint(), body, { headers: FORM_HEADERS }).pipe(
      timeout(AUTH_REQUEST_TIMEOUT_MS),
      map((payload) => {
        if (!isTokenResponse(payload)) {
          throw new TemporaryAuthError('Unexpected token response shape');
        }
        return payload;
      }),
      switchMap((token) => this.completeSignIn(token)),
      catchError((error: unknown) => of(this.toFailureOutcome(error)))
    );
  }

  /** Rotates the access token. Clears the session when the refresh token is rejected. */
  refreshSession(): Observable<boolean> {
    const current = this.sessionState();
    if (current === null || current.refreshToken.length === 0) {
      return of(false);
    }

    const body = this.formBody({
      grant_type: 'refresh_token',
      client_id: AUTH_CLIENT_ID,
      refresh_token: current.refreshToken,
    });

    return this.http.post<unknown>(this.tokenEndpoint(), body, { headers: FORM_HEADERS }).pipe(
      timeout(AUTH_REQUEST_TIMEOUT_MS),
      map((payload) => {
        if (!isTokenResponse(payload)) {
          throw new TemporaryAuthError('Unexpected refresh response shape');
        }

        this.applySession({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token ?? current.refreshToken,
          expiresAt: Date.now() + payload.expires_in * 1000,
        });
        return true;
      }),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  /**
   * Ends the session. Local state is cleared unconditionally before the best-effort
   * Keycloak logout call, so a network failure still signs the user out.
   */
  signOut(): Observable<void> {
    const current = this.sessionState();
    this.clearSession();

    if (current === null || current.refreshToken.length === 0) {
      return of(void 0);
    }

    const body = this.formBody({
      client_id: AUTH_CLIENT_ID,
      refresh_token: current.refreshToken,
    });

    return this.http.post<void>(this.logoutEndpoint(), body, { headers: FORM_HEADERS }).pipe(
      timeout(LOGOUT_REQUEST_TIMEOUT_MS),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  /** Clears the session, storage entry and refresh timer. Safe to call at any time. */
  clearSession(): void {
    this.sessionState.set(null);
    this.clearRefreshTimer();
    this.removeStoredSession();
  }

  private completeSignIn(token: TokenResponse): Observable<SignInOutcome> {
    const claims = parseJwtClaims(token.access_token);
    if (claims === null) {
      return of({ success: false, reason: 'invalid' });
    }

    const roles = claims.roles.filter(isAuthRole);
    if (roles.length === 0) {
      return of({ success: false, reason: 'invalid' });
    }

    return this.resolveProfileAccess(claims.sub, roles).pipe(
      map((allowed) => {
        if (!allowed) {
          return { success: false, reason: 'invalid' } as SignInOutcome;
        }

        this.applySession({
          accessToken: token.access_token,
          refreshToken: token.refresh_token ?? '',
          expiresAt: Date.now() + token.expires_in * 1000,
        });

        return { success: true } as SignInOutcome;
      })
    );
  }

  /**
   * AC-4/AC-5. Fails open while the contract in `contracts/profiles-sign-in.contract.md`
   * is not implemented: an unavailable endpoint must not lock every user out.
   */
  private resolveProfileAccess(
    accountId: string,
    roles: readonly AuthRole[]
  ): Observable<boolean> {
    // The endpoint is documented as not implemented (`profiles-sign-in.contract.md`).
    // One 404 is enough: stop probing for the rest of the app lifetime.
    if (this.profileStatusUnavailable) {
      return of(true);
    }

    const profilePath = roles.includes('Doctor') ? 'doctors' : 'receptionists';
    const url = `${environment.apiUrl}/profiles/${profilePath}/account/${encodeURIComponent(accountId)}`;

    return this.http
      .get<unknown>(url, {
        // This probe runs *during* sign-in and handles its own failures; a 401 here must
        // not be mistaken for a session rejection by the global auth-error interceptor.
        context: new HttpContext()
          .set(SILENT_HTTP_ERROR, true)
          .set(SKIP_AUTH_REDIRECT, true),
      })
      .pipe(
        timeout(PROFILE_REQUEST_TIMEOUT_MS),
        map((payload) => {
          if (!isProfileStatusResponse(payload)) {
            this.warnOnce(
              'profile-shape',
              'Profile status response has an unexpected shape; allowing sign-in (fail-open).'
            );
            return true;
          }

          return isPermittedProfileStatus(payload.status);
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
            return of(false);
          }

          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.profileStatusUnavailable = true;
          }

          this.warnOnce(
            'profile-status',
            'Profile status endpoint is unavailable; allowing sign-in (fail-open). AC-4/AC-5 are not enforced.'
          );
          return of(true);
        })
      );
  }

  private toFailureOutcome(error: unknown): SignInOutcome {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400 || error.status === 401) {
        const payload: unknown = error.error;
        if (isTokenErrorResponse(payload)) {
          if (payload.error === 'unauthorized_client' || payload.error === 'invalid_client') {
            this.warnOnce(
              'keycloak-grant',
              'Keycloak client is not allowed for direct access grants. Enable directAccessGrantsEnabled or use a dedicated client.'
            );
          }

          // A user still holding a required action (e.g. UPDATE_PASSWORD) gets a generic
          // "incorrect credentials" message in the UI by design; surface the real cause to
          // developers only, and never echo Keycloak's error_description.
          if (payload.error === 'invalid_grant') {
            this.warnOnce(
              'account-not-set-up',
              'Keycloak rejected the credentials. If they are correct, the account is not fully set up (complete required actions such as UPDATE_PASSWORD).'
            );
          }
        }
        return { success: false, reason: 'invalid' };
      }

      return { success: false, reason: 'unavailable' };
    }

    return { success: false, reason: 'unavailable' };
  }

  private applySession(session: AuthSession): void {
    this.sessionState.set(session);
    this.storeSession(session);
    this.scheduleRefresh(session);
  }

  private scheduleRefresh(session: AuthSession): void {
    this.clearRefreshTimer();

    const delay = Math.max(session.expiresAt - Date.now() - REFRESH_LEAD_MS, 0);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshSession()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private restoreSession(): void {
    const stored = this.readStoredSession();
    if (stored === null) {
      return;
    }

    if (stored.expiresAt <= Date.now() && stored.refreshToken.length === 0) {
      this.removeStoredSession();
      return;
    }

    this.sessionState.set(stored);
    this.scheduleRefresh(stored);
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (raw === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!isAuthSession(parsed)) {
        this.removeStoredSession();
        return null;
      }

      return parsed;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private storeSession(session: AuthSession): void {
    try {
      sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* Storage can be unavailable (private mode); the in-memory session still works. */
    }
  }

  private removeStoredSession(): void {
    try {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      /* Ignore storage failures. */
    }
  }

  private formBody(values: Readonly<Record<string, string>>): string {
    return new URLSearchParams(values).toString();
  }

  private tokenEndpoint(): string {
    return `${environment.keycloakUrl}/realms/${REALM}/protocol/openid-connect/token`;
  }

  private logoutEndpoint(): string {
    return `${environment.keycloakUrl}/realms/${REALM}/protocol/openid-connect/logout`;
  }

  private warnOnce(key: string, message: string): void {
    if (this.warnedKeys.has(key)) {
      return;
    }

    this.warnedKeys.add(key);
    console.warn(`[Auth] ${message}`);
  }
}
