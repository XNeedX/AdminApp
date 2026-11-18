import { isDoctorStatus } from '../models/doctor-form.model';

/**
 * Type guards for the generated Profiles/Appointments payloads.
 *
 * Generated interfaces mark every member optional, so the raw `data` of an envelope
 * cannot be trusted. Each guard takes `unknown`, never throws, and narrows to a model
 * with the members this feature actually requires.
 */

/** Full doctor profile as returned by `GET /Doctors/{id}` (deliberately no status). */
export interface DoctorDetails {
  readonly photoPath: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  readonly dateOfBirth: string;
  readonly specialization: string;
  readonly officeAddress: string;
  readonly careerStartYear: number;
}

/** A validated doctor table row. */
export interface DoctorTableRow {
  readonly id: string;
  readonly fullName: string;
  readonly specialization: string;
  readonly officeAddress: string;
  readonly dateOfBirth: string;
  readonly status: string;
}

/** One page of the Receptionist doctor table. */
export interface DoctorTablePage {
  readonly data: readonly DoctorTableRow[];
  readonly totalCount: number;
}

/** Catalog item for the specializations dropdown. */
export interface SpecializationCatalogItem {
  readonly id: string;
  readonly name: string;
}

/** Catalog item for the offices dropdown. */
export interface OfficeCatalogItem {
  readonly id: string;
  /** Present when the backend supplies an address; callers fall back to the id. */
  readonly address?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** `true` for a non-empty profile id returned by the create operation. */
export function isDoctorProfileId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Narrows the `data` of `GET /Doctors/{id}`. */
export function isDoctorDetails(value: unknown): value is DoctorDetails {
  if (!isRecord(value)) {
    return false;
  }

  return (
    readString(value, 'firstName') !== null &&
    readString(value, 'lastName') !== null &&
    readString(value, 'dateOfBirth') !== null &&
    readString(value, 'specialization') !== null &&
    readString(value, 'officeAddress') !== null &&
    readNumber(value, 'careerStartYear') !== null
  );
}

/** Narrows a single table row. */
export function isDoctorTableRow(value: unknown): value is DoctorTableRow {
  if (!isRecord(value)) {
    return false;
  }

  const status = readString(value, 'status');

  return (
    readString(value, 'id') !== null &&
    readString(value, 'fullName') !== null &&
    readString(value, 'specialization') !== null &&
    readString(value, 'officeAddress') !== null &&
    readString(value, 'dateOfBirth') !== null &&
    status !== null &&
    isDoctorStatus(status)
  );
}

/** Narrows the `data` of `GET /Doctors/doctors`. */
export function isPagedDoctorRows(value: unknown): value is DoctorTablePage {
  if (!isRecord(value)) {
    return false;
  }

  const data = value['data'];
  const totalCount = value['totalCount'];

  if (!Array.isArray(data) || typeof totalCount !== 'number' || !Number.isFinite(totalCount)) {
    return false;
  }

  return data.every(isDoctorTableRow);
}

/** Narrows the `data` of `GET /specialization`. */
export function isSpecializationList(
  value: unknown
): value is readonly SpecializationCatalogItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) && readString(item, 'id') !== null && readString(item, 'name') !== null
    )
  );
}

/** Narrows the `data` of `GET /offices`. */
export function isOfficeList(value: unknown): value is readonly OfficeCatalogItem[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && readString(item, 'id') !== null)
  );
}
