/**
 * One appointment row, already sorted and display-ready.
 *
 * Generated DTOs are narrowed into this model at the feature boundary so templates and
 * the sort comparator never touch an optional API field.
 */
export interface AppointmentRow {
  readonly id: string;
  /** ISO date-time from the API. */
  readonly startTime: string;
  /** ISO date-time from the API. */
  readonly endTime: string;
  /** Display label, for example `11:00 - 11:20`. */
  readonly timeRangeLabel: string;
  readonly doctorFullName: string;
  readonly patientFullName: string;
  readonly patientPhoneNumber: string;
  readonly serviceName: string;
  readonly isApproved: boolean;
  readonly booking?: {
    readonly patientId: string;
    readonly doctorId: string;
    readonly serviceId: string;
    readonly officeId: string;
    readonly date: string;
  };
  readonly officeId: string | null;
  readonly isApproving: boolean;
  readonly isDeleting: boolean;
}
