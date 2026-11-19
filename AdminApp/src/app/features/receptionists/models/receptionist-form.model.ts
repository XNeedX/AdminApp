import { FormControl } from '@angular/forms';

/** Maximum accepted name length (FR-057). */
export const MAX_NAME_LENGTH = 100;

/** Maximum accepted email length (FR-057). */
export const MAX_EMAIL_LENGTH = 256;

/** Typed reactive form shared by the create dialog and the profile edit mode. */
export interface ReceptionistFormGroup {
  photo: FormControl<File | null>;
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  middleName: FormControl<string | null>;
  email: FormControl<string>;
  officeText: FormControl<string>;
  officeId: FormControl<string>;
}

/** Value shape read from the shared form before mapping to a request DTO. */
export interface ReceptionistFormValue {
  readonly photo: File | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  readonly email: string;
  readonly officeText: string;
  readonly officeId: string;
}

/** Controls that render a text input and can report an inline validation message. */
export type ReceptionistTextField = 'firstName' | 'lastName' | 'middleName' | 'email';

/* Exact messages required by the feature specification (must not be reworded). */
export const FIRST_NAME_REQUIRED_MESSAGE = 'Please, enter the first name';
export const LAST_NAME_REQUIRED_MESSAGE = 'Please, enter the last name';
export const EMAIL_REQUIRED_MESSAGE = 'Please, enter the email';
export const EMAIL_INVALID_MESSAGE = "You've entered an invalid email";
export const EMAIL_TAKEN_MESSAGE = 'User with this email already exists';
export const OFFICE_REQUIRED_MESSAGE = 'Please, choose the office';
export const PHOTO_INVALID_MESSAGE = 'Choose a JPEG, PNG or WebP image up to 5 MB';
export const NO_OFFICES_MESSAGE = 'Create an office before adding a receptionist.';

/** Length message proposed by the plan (FR-057 defines the rule, not the copy). */
export function maxLengthMessage(label: string, max: number): string {
  return `${label} must be ${max} characters or fewer`;
}
