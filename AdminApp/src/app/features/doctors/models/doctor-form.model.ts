import { FormControl } from '@angular/forms';

export enum DoctorStatus {
  AtWork = 'At work',
  OnVacation = 'On vacation',
  SickDay = 'Sick Day',
  SickLeave = 'Sick Leave',
  SelfIsolation = 'Self-isolation',
  LeaveWithoutPay = 'Leave without pay',
  Inactive = 'Inactive',
}

/** Single source of truth for the status vocabulary used by every status control. */
export const DOCTOR_STATUSES: readonly DoctorStatus[] = [
  DoctorStatus.AtWork,
  DoctorStatus.OnVacation,
  DoctorStatus.SickDay,
  DoctorStatus.SickLeave,
  DoctorStatus.SelfIsolation,
  DoctorStatus.LeaveWithoutPay,
  DoctorStatus.Inactive,
];

export function isDoctorStatus(value: string): value is DoctorStatus {
  return (DOCTOR_STATUSES as readonly string[]).includes(value);
}

/** Which host renders the shared form; only the copy and email state differ. */
export type DoctorFormMode = 'create' | 'edit';

/** Typed reactive form shared by the create dialog and the profile edit mode. */
export interface DoctorFormGroup {
  photo: FormControl<File | null>;
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  middleName: FormControl<string | null>;
  dateOfBirth: FormControl<string>;
  email: FormControl<string>;
  specializationText: FormControl<string>;
  specializationId: FormControl<string>;
  officeText: FormControl<string>;
  officeId: FormControl<string>;
  careerStartYear: FormControl<number | null>;
  status: FormControl<DoctorStatus>;
}

/** Raw value produced by `form.getRawValue()`. */
export interface DoctorFormValue {
  photo: File | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  dateOfBirth: string;
  email: string;
  specializationText: string;
  specializationId: string;
  officeText: string;
  officeId: string;
  careerStartYear: number | null;
  status: DoctorStatus;
}

/** Contractual copy (spec FR-007, FR-011…FR-013, FR-035). Do not reword. */
export const CANCEL_CREATE_MESSAGE =
  'Do you really want to cancel? Entered data will not be saved.';
export const CANCEL_EDIT_MESSAGE = 'Do you really want to cancel? Changes will not be saved.';
export const HIDDEN_EMAIL_MESSAGE = 'Please, enter the email';
export const INVALID_EMAIL_MESSAGE = "You've entered an invalid email";
export const EMAIL_TAKEN_MESSAGE = 'User with this email already exists';
export const INVALID_SPECIALIZATION_MESSAGE = 'Invalid specialization name';

/** Default status for a doctor that is being created. */
export const DEFAULT_DOCTOR_STATUS: DoctorStatus = DoctorStatus.AtWork;
