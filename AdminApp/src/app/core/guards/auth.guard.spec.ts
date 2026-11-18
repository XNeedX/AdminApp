import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authenticated = false;

  const authStub = {
    isAuthenticated: () => authenticated,
  };

  beforeEach(() => {
    authenticated = false;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
    });
  });

  function runGuard(guard: CanActivateFn): unknown {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/doctors' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  it('allows activation when a session exists', () => {
    authenticated = true;
    expect(runGuard(authGuard)).toBe(true);
  });

  it('redirects to /sign-in when no session exists', () => {
    const result = runGuard(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/sign-in');
  });
});

describe('guestGuard', () => {
  let authenticated = false;

  const authStub = {
    isAuthenticated: () => authenticated,
  };

  beforeEach(() => {
    authenticated = false;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
    });
  });

  function runGuard(guard: CanActivateFn): unknown {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/sign-in' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  it('allows the sign-in page for anonymous users', () => {
    expect(runGuard(guestGuard)).toBe(true);
  });

  it('sends signed-in users to the application home', () => {
    authenticated = true;
    const result = runGuard(guestGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/');
  });
});
