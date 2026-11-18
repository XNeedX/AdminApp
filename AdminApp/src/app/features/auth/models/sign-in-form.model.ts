import {
  AbstractControl,
  AsyncValidatorFn,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 15;

/** Verbatim messages required by the specification. */
export const SIGN_IN_MESSAGES = {
  emailRequired: 'Please, enter the email',
  emailInvalid: "You've entered an invalid email",
  emailMissing: "User with this email doesn't exist",
  passwordRequired: 'Please, enter the password',
  passwordLength: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
  invalidCredentials: 'Either an email or a password is incorrect',
  temporarilyUnavailable: 'Sign-in is temporarily unavailable. Please try again.',
  signedInSuccessfully: "You've signed in successfully",
} as const;

export interface SignInFormControls {
  email: FormControl<string>;
  password: FormControl<string>;
}

export type SignInFormGroup = FormGroup<SignInFormControls>;

const nonBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' && value.trim().length > 0 ? null : { required: true };
};

const containsAt: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' && value.includes('@') ? null : { missingAt: true };
};

/**
 * Builds the typed sign-in form.
 *
 * Validation runs on every change, but errors are only revealed once the field has
 * been blurred/touched — this keeps Enter-to-submit working while behaving as
 * "validation on blur" from the user's perspective.
 */
export function createSignInForm(
  asyncValidators: readonly AsyncValidatorFn[] = []
): SignInFormGroup {
  const email = new FormControl<string>('', {
    nonNullable: true,
    validators: [nonBlank, containsAt],
  });

  if (asyncValidators.length > 0) {
    email.setAsyncValidators([...asyncValidators]);
  }

  const password = new FormControl<string>('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(PASSWORD_MIN_LENGTH),
      Validators.maxLength(PASSWORD_MAX_LENGTH),
    ],
  });

  return new FormGroup<SignInFormControls>({ email, password });
}

function shouldRevealError(control: AbstractControl): boolean {
  if (control.pending) {
    return false;
  }

  return control.touched || control.dirty;
}

/** E-mail message by precedence: required → format → existence. */
export function resolveEmailError(control: AbstractControl): string | null {
  if (!shouldRevealError(control)) {
    return null;
  }

  if (control.hasError('required')) {
    return SIGN_IN_MESSAGES.emailRequired;
  }

  if (control.hasError('missingAt')) {
    return SIGN_IN_MESSAGES.emailInvalid;
  }

  if (control.hasError('accountMissing')) {
    return SIGN_IN_MESSAGES.emailMissing;
  }

  return null;
}

/** Password message by precedence: required → length. */
export function resolvePasswordError(control: AbstractControl): string | null {
  if (!shouldRevealError(control)) {
    return null;
  }

  if (control.hasError('required')) {
    return SIGN_IN_MESSAGES.passwordRequired;
  }

  if (control.hasError('minlength') || control.hasError('maxlength')) {
    return SIGN_IN_MESSAGES.passwordLength;
  }

  return null;
}
