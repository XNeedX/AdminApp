import { DoctorStatus } from '../../doctors/models/doctor-form.model';

/**
 * A patient selectable for a new appointment.
 *
 * The Profiles API returns the whole patient list without a search parameter; the
 * combobox filters it client-side by full name.
 */
export interface PatientOption {
  readonly id: string;
  readonly fullName: string;
  readonly phoneNumber: string;
}

/** An active medical specialization. */
export interface SpecializationOption {
  readonly id: string;
  readonly name: string;
}

/** An active service, linked to exactly one specialization. */
export interface ServiceOption {
  readonly id: string;
  readonly name: string;
  readonly specializationId: string;
}

/** An active doctor, derived from the ProfilesAPI receptionist table. */
export interface DoctorOption {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  /** Display string as delivered by the backend: one consistent order. */
  readonly fullName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly officeId: string | null;
  readonly officeAddress: string | null;
  /** Only `At work` doctors are part of the catalog. */
  readonly status: DoctorStatus;
}

/** An active office. */
export interface OfficeOption {
  readonly id: string;
  readonly address: string;
  readonly displayName: string;
}

/** Catalogs loaded once per session and reused by every appointment form. */
export interface AppointmentCatalogs {
  readonly patients: readonly PatientOption[];
  readonly specializations: readonly SpecializationOption[];
  readonly services: readonly ServiceOption[];
  readonly doctors: readonly DoctorOption[];
  readonly offices: readonly OfficeOption[];
  /**
   * Service ids the Appointments API can schedule.
   *
   * The schedule endpoint resolves the `serviceId` against the Appointments API's own
   * synchronized table, so a service that exists in the Services API but not here has no
   * slots. `null` means the check is unavailable (the request failed): callers must fall
   * back to querying the schedule instead of blocking the selection.
   */
  readonly schedulableServiceIds: ReadonlySet<string> | null;
}

/** Empty catalog used before the first successful load and when loading fails. */
export const EMPTY_APPOINTMENT_CATALOGS: AppointmentCatalogs = {
  patients: [],
  specializations: [],
  services: [],
  doctors: [],
  offices: [],
  schedulableServiceIds: null,
};
