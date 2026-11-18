/** One appointment on a doctor's day schedule. */
export interface DoctorScheduleEntry {
  readonly appointmentId: string;
  readonly patientId: string;
  readonly patientFullName: string;
  readonly serviceName: string;
  readonly startTime: string;
  readonly endTime: string;
  /** Only an approved appointment exposes the patient profile link (FR-040). */
  readonly isApproved: boolean;
  readonly hasResult: boolean;
}

/** The single rule that enables navigation from a schedule row. */
export function canOpenPatient(entry: DoctorScheduleEntry): boolean {
  return entry.isApproved;
}
