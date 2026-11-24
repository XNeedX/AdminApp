/** Feature-level read models for the Receptionists module. */

/** A receptionist profile as returned by `GET /Receptionists/{id}`. */
export interface ReceptionistProfile {
  readonly id: string;
  readonly photoPath: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  /** Absent for a receptionist not yet assigned to an office; normalized to `null`. */
  readonly officeAddress: string | null;
}

/** A validated row of the Receptionists table. */
export interface ReceptionistRow {
  readonly id: string;
  readonly fullName: string;
  /** `null` when the receptionist has no office; rendered as "Not assigned". */
  readonly officeAddress: string | null;
  readonly photoPath: string | null;
}

/** One page of the backend receptionist list. */
export interface PagedReceptionistRows {
  readonly data: readonly ReceptionistProfile[];
  readonly totalCount: number;
}

/** Office dropdown option; `label` is the address shown to the user. */
export interface OfficeOption {
  readonly id: string;
  readonly label: string;
}

/** Summary reported to the directory after a successful create. */
export interface ReceptionistCreatedSummary {
  readonly id: string;
  readonly fullName: string;
  readonly officeAddress: string;
}
