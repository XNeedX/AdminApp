import { FormControl } from '@angular/forms';

import { AppointmentCatalogs, DoctorOption, OfficeOption, PatientOption, ServiceOption, SpecializationOption } from './appointment-catalog.model';

/**
 * Typed reactive form used by the creation modal.
 *
 * The `*Id` controls are the source of truth; the `*Text` controls are display-only
 * mirrors for the comboboxes, so a selection can always be told apart from free text.
 */
export interface AppointmentFormGroup {
  patientId: FormControl<string>;
  patientText: FormControl<string>;
  specializationId: FormControl<string>;
  specializationText: FormControl<string>;
  doctorId: FormControl<string>;
  doctorText: FormControl<string>;
  serviceId: FormControl<string>;
  serviceText: FormControl<string>;
  officeId: FormControl<string>;
  date: FormControl<string>;
  timeSlot: FormControl<string>;
}

/** Every field the cascade reducer may read or write. */
export type AppointmentFormField =
  | 'patient'
  | 'specialization'
  | 'doctor'
  | 'service'
  | 'office'
  | 'date'
  | 'timeSlot';

/** Normalized form snapshot consumed by the cascade reducer. */
export interface AppointmentFormValue {
  readonly patientId: string;
  readonly specializationId: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly officeId: string;
  readonly date: string;
  readonly timeSlot: string;
}

/** Option sets each combobox may currently display. */
export interface CascadeOptions {
  readonly patients: readonly PatientOption[];
  readonly specializations: readonly SpecializationOption[];
  readonly doctors: readonly DoctorOption[];
  readonly services: readonly ServiceOption[];
  readonly offices: readonly OfficeOption[];
}

/** Input of the pure cascade reducer. */
export interface CascadeInput {
  readonly value: AppointmentFormValue;
  readonly catalogs: AppointmentCatalogs;
  readonly lockedFields?: ReadonlySet<AppointmentFormField>;
  readonly lastEditedField: AppointmentFormField | null;
  /** Doctor ids with a free slot at the selected date/time, or `null` when unresolved. */
  readonly availableDoctors: ReadonlySet<string> | null;
}

/** A single value the store must write. */
export interface CascadeWrite {
  readonly field: AppointmentFormField;
  readonly value: string;
}

/** Output of the pure cascade reducer. */
export interface CascadePlan {
  readonly options: CascadeOptions;
  /** Writes in reducer order. Never targets `lastEditedField`. */
  readonly autoFill: readonly CascadeWrite[];
  /** Writes that remove selections invalidated by the current state. */
  readonly clear: readonly CascadeWrite[];
  readonly dateEnabled: boolean;
  readonly slotsEnabled: boolean;
  readonly dateVisible: boolean;
  readonly isComplete: boolean;
}

/** Empty form value used before the first edit. */
export const EMPTY_APPOINTMENT_FORM_VALUE: AppointmentFormValue = {
  patientId: '',
  specializationId: '',
  doctorId: '',
  serviceId: '',
  officeId: '',
  date: '',
  timeSlot: '',
};
