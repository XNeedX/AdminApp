import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of } from 'rxjs';

import { SignInPageComponent } from './sign-in-page.component';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ACCOUNT_EXISTS_LOOKUP } from '../../../../core/tokens/account-exists-lookup.token';
import { SIGN_IN_MESSAGES, SignInFormGroup } from '../../models/sign-in-form.model';
import { SignInOutcome } from '../../../../core/models/auth.model';

type SignInFn = (email: string, password: string) => Observable<SignInOutcome>;

describe('SignInPageComponent', () => {
  let fixture: ComponentFixture<SignInPageComponent>;
  let component: SignInPageComponent;
  let router: Router;

  const signIn = vi.fn<SignInFn>();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    signIn.mockReset();
    signIn.mockReturnValue(of({ success: true } as SignInOutcome));
    showSuccess.mockReset();
    showError.mockReset();

    await TestBed.configureTestingModule({
      imports: [SignInPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signIn } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
        { provide: ACCOUNT_EXISTS_LOOKUP, useValue: () => of(true) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignInPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  function filledForm(): SignInFormGroup {
    const form = component.form();
    expect(form).not.toBeNull();
    const group = form as SignInFormGroup;

    group.controls.email.clearAsyncValidators();
    group.controls.email.setValue('doc@clinic.com');
    group.controls.password.setValue('secret1');
    group.updateValueAndValidity();

    return group;
  }

  it('shows the success notification and navigates home', () => {
    filledForm();
    component.onSubmit();

    expect(signIn).toHaveBeenCalledWith('doc@clinic.com', 'secret1');
    expect(showSuccess).toHaveBeenCalledWith(SIGN_IN_MESSAGES.signedInSuccessfully);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows the generic rejection message and keeps the user on the page', () => {
    signIn.mockReturnValue(of({ success: false, reason: 'invalid' } as SignInOutcome));
    filledForm();

    component.onSubmit();

    expect(component.submitError()).toBe(SIGN_IN_MESSAGES.invalidCredentials);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows a neutral message and preserves the e-mail on a temporary failure', () => {
    signIn.mockReturnValue(of({ success: false, reason: 'unavailable' } as SignInOutcome));
    const form = filledForm();

    component.onSubmit();

    expect(component.submitError()).toBe(SIGN_IN_MESSAGES.temporarilyUnavailable);
    expect(showError).toHaveBeenCalledWith(SIGN_IN_MESSAGES.temporarilyUnavailable);
    expect(form.controls.email.value).toBe('doc@clinic.com');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('never sends an invalid form', () => {
    component.onSubmit();

    expect(signIn).not.toHaveBeenCalled();
    expect(component.form()?.controls.email.hasError('required')).toBe(true);
    expect(component.form()?.controls.password.hasError('required')).toBe(true);
  });

  it('clears the submit error as soon as a field changes', () => {
    signIn.mockReturnValue(of({ success: false, reason: 'invalid' } as SignInOutcome));
    filledForm();
    component.onSubmit();
    expect(component.submitError()).not.toBeNull();

    component.onFieldChanged();

    expect(component.submitError()).toBeNull();
  });

  it('renders a non-dismissible modal card', () => {
    const host = fixture.nativeElement as HTMLElement;

    const dialog = host.querySelector('[role="dialog"][aria-modal="true"]');
    expect(dialog).not.toBeNull();
    expect(host.querySelector('button[aria-label="Close"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Dismiss"]')).toBeNull();

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.form()).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
