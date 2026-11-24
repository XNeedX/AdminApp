import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ACCOUNT_EXISTS_LOOKUP } from '../../../../core/tokens/account-exists-lookup.token';
import { SignInOutcome } from '../../../../core/models/auth.model';
import { SIGN_IN_MESSAGES } from '../../models/sign-in-form.model';
import { SignInPageComponent } from './sign-in-page.component';

describe('SignInPageComponent', () => {
  let fixture: ComponentFixture<SignInPageComponent>;
  let component: SignInPageComponent;
  const signIn = vi.fn<(email: string, password: string) => ReturnType<AuthService['signIn']>>();
  const navigate = vi.fn();

  beforeEach(async () => {
    signIn.mockReset();
    navigate.mockReset();

    await TestBed.configureTestingModule({
      imports: [SignInPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signIn } },
        { provide: NotificationService, useValue: { showSuccess: vi.fn(), showError: vi.fn() } },
        { provide: ACCOUNT_EXISTS_LOOKUP, useValue: () => of(null) },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);

    fixture = TestBed.createComponent(SignInPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function submitWith(outcome: SignInOutcome): void {
    signIn.mockReturnValue(of(outcome));

    const form = component.form();
    expect(form).not.toBeNull();
    form?.setValue({ email: 'doc@clinic.com', password: 'secret1' });

    component.onSubmit();
  }

  it('shows the invalid-credentials message for reason "invalid"', () => {
    submitWith({ success: false, reason: 'invalid' });

    expect(component.submitError()).toBe(SIGN_IN_MESSAGES.invalidCredentials);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the temporarily-unavailable message for reason "unavailable"', () => {
    submitWith({ success: false, reason: 'unavailable' });

    expect(component.submitError()).toBe(SIGN_IN_MESSAGES.temporarilyUnavailable);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates home after a successful sign-in', () => {
    submitWith({ success: true });

    expect(component.submitError()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
