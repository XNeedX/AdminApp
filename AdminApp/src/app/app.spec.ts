import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { computed, signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { App } from './app';
import { AuthService } from './core/services/auth.service';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const authenticated = signal(false);
  const email = signal('doc@clinic.com');
  const signOut = vi.fn(() => of(void 0));

  const authStub = {
    isAuthenticated: authenticated.asReadonly(),
    user: computed(() =>
      authenticated()
        ? { accountId: 'acc-doctor', email: email(), roles: ['Doctor'] as const }
        : null
    ),
    signOut,
  };

  beforeEach(async () => {
    authenticated.set(false);
    email.set('doc@clinic.com');
    signOut.mockClear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('hides the header while signed out and always renders the toast container', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-header')).toBeNull();
    expect(host.querySelector('app-toast-container')).not.toBeNull();
    expect(host.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows the user e-mail in the header while signed in', () => {
    authenticated.set(true);
    fixture.detectChanges();

    const header = (fixture.nativeElement as HTMLElement).querySelector('app-header');
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain('doc@clinic.com');
  });

  it('signs out and replaces the protected route in history', () => {
    authenticated.set(true);
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'app-header button'
      )
    );
    const signOutButton = buttons.find((button) =>
      button.textContent?.includes('Sign out')
    );
    signOutButton?.click();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], { replaceUrl: true });
  });
});
