import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInFormComponent } from './sign-in-form.component';
import {
  SIGN_IN_MESSAGES,
  SignInFormGroup,
  createSignInForm,
} from '../../models/sign-in-form.model';

describe('SignInFormComponent', () => {
  let fixture: ComponentFixture<SignInFormComponent>;
  let component: SignInFormComponent;
  let form: SignInFormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignInFormComponent],
    }).compileComponents();

    form = createSignInForm();
    fixture = TestBed.createComponent(SignInFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
  });

  function text(selector: string): string {
    const element = (fixture.nativeElement as HTMLElement).querySelector(selector);
    return element?.textContent?.trim() ?? '';
  }

  function element<T extends Element>(selector: string): T {
    const found = (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
    if (found === null) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  it('shows the required e-mail message after blur when empty', () => {
    form.controls.email.markAsTouched();
    fixture.detectChanges();

    expect(text('#sign-in-email-error')).toBe(SIGN_IN_MESSAGES.emailRequired);
    expect(element<HTMLInputElement>('#sign-in-email').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the invalid e-mail message when the value has no @', () => {
    form.controls.email.setValue('invalid-email');
    form.controls.email.markAsTouched();
    fixture.detectChanges();

    expect(text('#sign-in-email-error')).toBe(SIGN_IN_MESSAGES.emailInvalid);
  });

  it('shows the missing-account message from the async validator', () => {
    form.controls.email.setValue('unknown@clinic.com');
    form.controls.email.setErrors({ accountMissing: true });
    form.controls.email.markAsTouched();
    fixture.detectChanges();

    expect(text('#sign-in-email-error')).toBe(SIGN_IN_MESSAGES.emailMissing);
  });

  it('shows the required password message after blur when empty', () => {
    form.controls.password.markAsTouched();
    fixture.detectChanges();

    expect(text('#sign-in-password-error')).toBe(SIGN_IN_MESSAGES.passwordRequired);
  });

  it('rejects passwords outside 6-15 characters', () => {
    form.controls.password.setValue('12345');
    form.controls.password.markAsTouched();
    fixture.detectChanges();
    expect(text('#sign-in-password-error')).toBe(SIGN_IN_MESSAGES.passwordLength);

    form.controls.password.setValue('123456');
    form.controls.password.markAsTouched();
    fixture.detectChanges();
    expect(text('#sign-in-password-error')).toBe('');

    form.controls.password.setValue('1234567890123456');
    form.controls.password.markAsTouched();
    fixture.detectChanges();
    expect(text('#sign-in-password-error')).toBe(SIGN_IN_MESSAGES.passwordLength);
  });

  it('toggles password visibility without losing the value', () => {
    form.controls.password.setValue('secret1');
    fixture.detectChanges();

    const passwordInput = () => element<HTMLInputElement>('#sign-in-password');
    expect(passwordInput().type).toBe('password');

    element<HTMLButtonElement>('button[aria-label="Show password"]').click();
    fixture.detectChanges();

    expect(component.passwordVisible()).toBe(true);
    expect(passwordInput().type).toBe('text');
    expect(form.controls.password.value).toBe('secret1');

    element<HTMLButtonElement>('button[aria-label="Hide password"]').click();
    fixture.detectChanges();

    expect(passwordInput().type).toBe('password');
    expect(form.controls.password.value).toBe('secret1');
  });

  it('submits on the form submit event (Enter key)', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);

    element<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('emits fieldChanged while the user edits', () => {
    const fieldChanged = vi.fn();
    component.fieldChanged.subscribe(fieldChanged);

    element<HTMLInputElement>('#sign-in-email').dispatchEvent(
      new Event('input', { bubbles: true })
    );

    expect(fieldChanged).toHaveBeenCalled();
  });

  it('disables the submit button while a request is in flight', () => {
    form.controls.email.setValue('doc@clinic.com');
    form.controls.password.setValue('secret1');
    form.updateValueAndValidity();
    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();

    expect(element<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    expect(text('button[type="submit"]')).toContain('Signing in');
  });

  it('renders the submit error verbatim', () => {
    fixture.componentRef.setInput('submitError', SIGN_IN_MESSAGES.invalidCredentials);
    fixture.detectChanges();

    expect(text('[role="alert"]')).toBe(SIGN_IN_MESSAGES.invalidCredentials);
  });
});
