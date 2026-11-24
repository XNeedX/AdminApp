import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authErrorInterceptor } from './auth-error.interceptor';
import { AuthService } from '../services/auth.service';
import { SKIP_AUTH_REDIRECT } from '../tokens/skip-auth-redirect.token';
import { environment } from '../../../environments/environment.development';

describe('authErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  const clearSession = vi.fn();

  beforeEach(() => {
    clearSession.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { clearSession } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushGatewayError(status: number): void {
    http.get(`${environment.apiUrl}/services/specialization`).subscribe({
      error: () => undefined,
    });

    httpMock
      .expectOne(`${environment.apiUrl}/services/specialization`)
      .flush({}, { status, statusText: 'Error' });
  }

  it('clears the session and redirects on a Gateway 401', () => {
    flushGatewayError(401);

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], { replaceUrl: true });
  });

  it('ignores a 401 from the Keycloak host', () => {
    const keycloakUrl = `${environment.keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token`;

    http.post(keycloakUrl, 'grant_type=password').subscribe({ error: () => undefined });
    httpMock.expectOne(keycloakUrl).flush({ error: 'invalid_grant' }, { status: 401, statusText: 'Unauthorized' });

    expect(clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not clear the session or navigate on a Gateway 401 marked SKIP_AUTH_REDIRECT', () => {
    let caught: unknown;

    http
      .get(`${environment.apiUrl}/profiles/doctors/account/acc-1`, {
        context: new HttpContext().set(SKIP_AUTH_REDIRECT, true),
      })
      .subscribe({ error: (error: unknown) => (caught = error) });

    httpMock
      .expectOne(`${environment.apiUrl}/profiles/doctors/account/acc-1`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(caught).toBeInstanceOf(HttpErrorResponse);
    expect((caught as HttpErrorResponse).status).toBe(401);
    expect(clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('leaves the session intact on non-401 Gateway errors', () => {
    flushGatewayError(403);
    flushGatewayError(500);

    expect(clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
