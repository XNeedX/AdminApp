import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { AuthRole } from '../models/auth.model';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const authenticated = signal(false);
  const roles = signal<readonly AuthRole[]>([]);
  const showError = vi.fn();

  beforeEach(() => {
    authenticated.set(false);
    roles.set([]);
    showError.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: authenticated.asReadonly(),
            user: () => ({ accountId: 'acc-1', email: 'a@b.c', roles: roles() }),
          },
        },
        { provide: NotificationService, useValue: { showError } },
      ],
    });
  });

  function runGuard(guard: CanActivateFn): unknown {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/receptionists' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  it('allows activation when the user holds the required role', () => {
    authenticated.set(true);
    roles.set(['Receptionist']);

    expect(runGuard(roleGuard('Receptionist'))).toBe(true);
    expect(showError).not.toHaveBeenCalled();
  });

  it('sends unauthenticated users to /sign-in without a notification', () => {
    const result = runGuard(roleGuard('Receptionist'));

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/sign-in');
    expect(showError).not.toHaveBeenCalled();
  });

  it('redirects an authenticated user without the role to / and reports the denial', () => {
    authenticated.set(true);
    roles.set(['Doctor']);

    const result = runGuard(roleGuard('Receptionist'));

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/');
    expect(showError).toHaveBeenCalledTimes(1);
    expect(showError.mock.calls[0][0]).toContain('access');
  });
});
