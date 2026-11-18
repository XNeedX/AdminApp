import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment.development';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const token = signal<string | null>('access-token');

  beforeEach(() => {
    token.set('access-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { accessToken: token.asReadonly() } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches the bearer token to Gateway requests', () => {
    http.get(`${environment.apiUrl}/services/specialization`).subscribe();

    const request = httpMock.expectOne(`${environment.apiUrl}/services/specialization`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush({});
  });

  it('does not attach the token to Keycloak requests', () => {
    const keycloakUrl = `${environment.keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token`;
    http.post(keycloakUrl, 'grant_type=password').subscribe();

    const request = httpMock.expectOne(keycloakUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('keeps the anonymous e-mail existence check unauthenticated', () => {
    const existsUrl = `${environment.apiUrl}/profiles/accounts/exists?email=a%40b.c`;
    http.get(existsUrl).subscribe();

    const request = httpMock.expectOne(existsUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ exists: true });
  });

  it('adds no header when there is no session', () => {
    token.set(null);

    http.get(`${environment.apiUrl}/services/specialization`).subscribe();

    const request = httpMock.expectOne(`${environment.apiUrl}/services/specialization`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
