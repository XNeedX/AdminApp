import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { AUTH_SESSION_STORAGE_KEY } from '../models/auth.model';
import { SILENT_HTTP_ERROR } from '../tokens/silent-http-error.token';
import { environment } from '../../../environments/environment.development';

const TOKEN_URL = `${environment.keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token`;
const LOGOUT_URL = `${environment.keycloakUrl}/realms/InnoClinic/protocol/openid-connect/logout`;

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeAccessToken(claims: Record<string, unknown>): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.signature`;
}

function staffClaims(
  sub = 'acc-doctor',
  email = 'doc@clinic.com',
  roles: readonly string[] = ['Doctor']
): Record<string, unknown> {
  return { sub, email, realm_access: { roles } };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('signIn', () => {
    it('stores the session and derives the identity after a successful doctor sign-in', () => {
      let outcome: unknown;
      service.signIn(' Doc@Clinic.com ', 'secret1').subscribe((result) => (outcome = result));

      const tokenRequest = httpMock.expectOne(TOKEN_URL);
      expect(tokenRequest.request.method).toBe('POST');
      expect(tokenRequest.request.body).toContain('grant_type=password');
      expect(tokenRequest.request.body).toContain('client_id=public-client');
      expect(tokenRequest.request.body).toContain('scope=openid');
      expect(tokenRequest.request.body).toContain('username=Doc%40Clinic.com');

      tokenRequest.flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-1',
        expires_in: 300,
        token_type: 'Bearer',
      });

      const profileRequest = httpMock.expectOne(
        `${environment.apiUrl}/profiles/doctors/account/acc-doctor`
      );
      profileRequest.flush({
        id: 'profile-1',
        accountId: 'acc-doctor',
        email: 'doc@clinic.com',
        status: 'At work',
      });

      expect(outcome).toEqual({ success: true });
      expect(service.isAuthenticated()).toBe(true);
      expect(service.user()?.email).toBe('doc@clinic.com');
      expect(service.user()?.roles).toEqual(['Doctor']);

      const stored = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored ?? '{}')).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: 'refresh-1',
        expiresAt: expect.any(Number),
      });
    });

    it('maps invalid_grant to the generic failure and stores nothing', () => {
      let outcome: unknown;
      service.signIn('doc@clinic.com', 'wrong').subscribe((result) => (outcome = result));

      httpMock
        .expectOne(TOKEN_URL)
        .flush(
          { error: 'invalid_grant', error_description: 'Invalid user credentials' },
          { status: 400, statusText: 'Bad Request' }
        );

      expect(outcome).toEqual({ success: false, reason: 'invalid' });
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('warns about a misconfigured client on unauthorized_client', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      let outcome: unknown;

      service.signIn('doc@clinic.com', 'secret1').subscribe((result) => (outcome = result));

      httpMock
        .expectOne(TOKEN_URL)
        .flush(
          { error: 'unauthorized_client', error_description: 'Client not allowed for direct access grants' },
          { status: 400, statusText: 'Bad Request' }
        );

      expect(outcome).toEqual({ success: false, reason: 'invalid' });
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('rejects accounts whose roles contain neither Doctor nor Receptionist', () => {
      let outcome: unknown;
      service.signIn('patient@clinic.com', 'secret1').subscribe((result) => (outcome = result));

      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims('acc-patient', 'patient@clinic.com', ['Patient'])),
        refresh_token: 'refresh-patient',
        expires_in: 300,
        token_type: 'Bearer',
      });

      expect(outcome).toEqual({ success: false, reason: 'invalid' });
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('rejects an Inactive doctor profile (AC-5)', () => {
      let outcome: unknown;
      service.signIn('inactive@clinic.com', 'secret1').subscribe((result) => (outcome = result));

      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims('acc-inactive', 'inactive@clinic.com')),
        refresh_token: 'refresh-inactive',
        expires_in: 300,
        token_type: 'Bearer',
      });

      httpMock
        .expectOne(`${environment.apiUrl}/profiles/doctors/account/acc-inactive`)
        .flush({
          id: 'profile-inactive',
          accountId: 'acc-inactive',
          email: 'inactive@clinic.com',
          status: 'Inactive',
        });

      expect(outcome).toEqual({ success: false, reason: 'invalid' });
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('rejects unknown profile statuses (fail closed when the endpoint exists)', () => {
      let outcome: unknown;
      service.signIn('retired@clinic.com', 'secret1').subscribe((result) => (outcome = result));

      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims('acc-retired', 'retired@clinic.com')),
        refresh_token: 'refresh-retired',
        expires_in: 300,
      });

      httpMock.expectOne(`${environment.apiUrl}/profiles/doctors/account/acc-retired`).flush({
        id: 'profile-retired',
        accountId: 'acc-retired',
        email: 'retired@clinic.com',
        status: 'Retired',
      });

      expect(outcome).toEqual({ success: false, reason: 'invalid' });
    });

    it('accepts a receptionist profile without a status', () => {
      let outcome: unknown;
      service
        .signIn('reception@clinic.com', 'secret1')
        .subscribe((result) => (outcome = result));

      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(
          staffClaims('acc-reception', 'reception@clinic.com', ['Receptionist'])
        ),
        refresh_token: 'refresh-reception',
        expires_in: 300,
      });

      httpMock
        .expectOne(`${environment.apiUrl}/profiles/receptionists/account/acc-reception`)
        .flush({
          id: 'profile-reception',
          accountId: 'acc-reception',
          email: 'reception@clinic.com',
          status: null,
        });

      expect(outcome).toEqual({ success: true });
      expect(service.isAuthenticated()).toBe(true);
    });

    it('fails open while the profile status endpoint is missing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      let outcome: unknown;

      service.signIn('doc@clinic.com', 'secret1').subscribe((result) => (outcome = result));

      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-1',
        expires_in: 300,
      });

      const profileRequest = httpMock.expectOne(
        `${environment.apiUrl}/profiles/doctors/account/acc-doctor`
      );
      expect(profileRequest.request.context.get(SILENT_HTTP_ERROR)).toBe(true);
      profileRequest.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

      expect(outcome).toEqual({ success: true });
      expect(service.isAuthenticated()).toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('probes the missing profile status endpoint only once across sign-ins', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const profileUrl = `${environment.apiUrl}/profiles/doctors/account/acc-doctor`;

      let firstOutcome: unknown;
      service.signIn('doc@clinic.com', 'secret1').subscribe((result) => (firstOutcome = result));
      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-1',
        expires_in: 300,
      });
      httpMock
        .expectOne(profileUrl)
        .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

      expect(firstOutcome).toEqual({ success: true });

      let secondOutcome: unknown;
      service.signIn('doc@clinic.com', 'secret1').subscribe((result) => (secondOutcome = result));
      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-2',
        expires_in: 300,
      });

      // The probe is latched: no second request, no second warning.
      httpMock.expectNone(profileUrl);
      expect(secondOutcome).toEqual({ success: true });
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('reports a temporary failure when the network is unavailable', () => {
      let outcome: unknown;
      service.signIn('doc@clinic.com', 'secret1').subscribe((result) => (outcome = result));

      httpMock
        .expectOne(TOKEN_URL)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(outcome).toEqual({ success: false, reason: 'unavailable' });
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('rotates the access token and extends the expiry', () => {
      service.signIn('doc@clinic.com', 'secret1').subscribe();
      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-1',
        expires_in: 300,
      });
      httpMock.expectOne(`${environment.apiUrl}/profiles/doctors/account/acc-doctor`).flush({
        id: 'profile-1',
        accountId: 'acc-doctor',
        email: 'doc@clinic.com',
        status: 'At work',
      });

      const before = service.session()?.expiresAt ?? 0;
      let refreshed: boolean | undefined;
      service.refreshSession().subscribe((result) => (refreshed = result));

      const refreshRequest = httpMock.expectOne(TOKEN_URL);
      expect(refreshRequest.request.body).toContain('grant_type=refresh_token');
      expect(refreshRequest.request.body).toContain('refresh_token=refresh-1');

      refreshRequest.flush({
        access_token: makeAccessToken(staffClaims()),
        expires_in: 600,
        token_type: 'Bearer',
      });

      expect(refreshed).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.session()?.expiresAt ?? 0).toBeGreaterThan(before);
      expect(service.session()?.refreshToken).toBe('refresh-1');
    });

    it('clears the session when the refresh token is rejected', () => {
      service.signIn('doc@clinic.com', 'secret1').subscribe();
      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-1',
        expires_in: 300,
      });
      httpMock.expectOne(`${environment.apiUrl}/profiles/doctors/account/acc-doctor`).flush({
        id: 'profile-1',
        accountId: 'acc-doctor',
        email: 'doc@clinic.com',
        status: 'At work',
      });

      let refreshed: boolean | undefined;
      service.refreshSession().subscribe((result) => (refreshed = result));

      httpMock
        .expectOne(TOKEN_URL)
        .flush({ error: 'invalid_grant' }, { status: 400, statusText: 'Bad Request' });

      expect(refreshed).toBe(false);
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('signOut', () => {
    function signInFirst(): void {
      service.signIn('doc@clinic.com', 'secret1').subscribe();
      httpMock.expectOne(TOKEN_URL).flush({
        access_token: makeAccessToken(staffClaims()),
        refresh_token: 'refresh-1',
        expires_in: 300,
      });
      httpMock.expectOne(`${environment.apiUrl}/profiles/doctors/account/acc-doctor`).flush({
        id: 'profile-1',
        accountId: 'acc-doctor',
        email: 'doc@clinic.com',
        status: 'At work',
      });
    }

    it('deletes the local session and revokes the refresh token at Keycloak', () => {
      signInFirst();
      expect(service.isAuthenticated()).toBe(true);

      let completed = false;
      service.signOut().subscribe(() => (completed = true));

      const logoutRequest = httpMock.expectOne(LOGOUT_URL);
      expect(logoutRequest.request.body).toContain('client_id=public-client');
      expect(logoutRequest.request.body).toContain('refresh_token=refresh-1');
      logoutRequest.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('clears the local session even when the logout call fails', () => {
      signInFirst();

      let completed = false;
      service.signOut().subscribe(() => (completed = true));

      httpMock
        .expectOne(LOGOUT_URL)
        .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });

      expect(completed).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('clears the local session even when the logout request never reaches the server', () => {
      signInFirst();

      let completed = false;
      service.signOut().subscribe(() => (completed = true));

      httpMock
        .expectOne(LOGOUT_URL)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(completed).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('is a no-op for the network when no session exists', () => {
      let completed = false;
      service.signOut().subscribe(() => (completed = true));

      expect(completed).toBe(true);
      httpMock.expectNone(LOGOUT_URL);
    });
  });
});

describe('AuthService session restoration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  function createService(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(AuthService);
  }

  it('restores a valid session from sessionStorage', () => {
    sessionStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: makeAccessToken(staffClaims()),
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 300_000,
      })
    );

    const service = createService();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.accountId).toBe('acc-doctor');
    expect(service.user()?.email).toBe('doc@clinic.com');
  });

  it('discards corrupted storage content', () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, '{not-json');

    const service = createService();

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('discards a stored session with an unexpected shape', () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ accessToken: 42 }));

    const service = createService();

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('discards an expired session that has no refresh token', () => {
    sessionStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken: makeAccessToken(staffClaims()),
        refreshToken: '',
        expiresAt: Date.now() - 1_000,
      })
    );

    const service = createService();

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });
});
