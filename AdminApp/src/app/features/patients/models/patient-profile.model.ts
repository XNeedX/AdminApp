/** Read-only patient profile rendered by the personal-information tab. */
export interface PatientProfile {
  readonly id: string;
  readonly photoPath: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  readonly phoneNumber: string;
  /** Normalized to `yyyy-MM-dd`. */
  readonly dateOfBirth: string;
}

/** One past appointment joined with its recorded result. */
export interface PatientAppointmentResult {
  readonly appointmentId: string;
  readonly date: string;
  readonly doctorFullName: string;
  readonly serviceName: string;
  readonly complaints: string | null;
  readonly conclusion: string | null;
  readonly recommendations: string | null;
  /** `true` when the result body could not be fetched; the row still renders. */
  readonly isUnavailable: boolean;
}
