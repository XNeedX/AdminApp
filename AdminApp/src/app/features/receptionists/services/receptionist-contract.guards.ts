import { ReceptionistProfile } from '../models/receptionist.model';

/**
 * Type guards for the generated Profiles/Appointments payloads.
 *
 * Generated interfaces mark every member optional, so the raw `data` of an envelope
 * cannot be trusted. Each guard takes `unknown`, never throws, and narrows to a model
 * with the members this feature actually requires.
 */

/** `true` for a non-empty profile id returned by the create operation. */
export function isProfileId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** `true` for a non-empty Documents file id returned by the upload operation. */
export function isFileId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

/**
 * Narrows a single receptionist profile.
 *
 * `officeAddress` is optional on the backend DTO: a receptionist without an office must not
 * reject the whole page. A present-but-wrong type (e.g. a number) is still a contract error.
 * Missing/`undefined` values are normalized to `null` so downstream code never meets
 * `undefined` through an optional-field hole.
 */
export function isReceptionistProfile(value: unknown): value is ReceptionistProfile {
  if (!isRecord(value)) {
    return false;
  }

  const photoPath = value['photoPath'];
  const middleName = value['middleName'];
  const officeAddress = value['officeAddress'];

  const valid =
    readString(value, 'id') !== null &&
    readString(value, 'firstName') !== null &&
    readString(value, 'lastName') !== null &&
    isOptionalString(officeAddress) &&
    isOptionalString(photoPath) &&
    isOptionalString(middleName);

  if (!valid) {
    return false;
  }

  const record = value as Record<string, unknown>;
  record['officeAddress'] = officeAddress ?? null;
  record['photoPath'] = photoPath ?? null;
  record['middleName'] = middleName ?? null;

  return true;
}

/** Narrows the `data` of `GET /Receptionists`. */
export function isPagedReceptionistRows(value: unknown): value is {
  readonly data: readonly ReceptionistProfile[];
  readonly totalCount: number;
} {
  if (!isRecord(value)) {
    return false;
  }

  const data = value['data'];
  const totalCount = value['totalCount'];

  if (!Array.isArray(data) || typeof totalCount !== 'number' || !Number.isFinite(totalCount)) {
    return false;
  }

  return data.every(isReceptionistProfile);
}

/** Catalog item for the offices dropdown. */
export interface OfficeCatalogItem {
  readonly id: string;
  /** Present when the backend supplies an address; callers fall back to the id. */
  readonly address?: string;
  readonly fullAddress?: string;
  readonly status?: string | number;
}

function isOfficeCatalogItem(value: unknown): value is OfficeCatalogItem {
  return isRecord(value) && readString(value, 'id') !== null;
}

/** Narrows the `data` of `GET /offices`. */
export function isOfficeList(value: unknown): value is readonly OfficeCatalogItem[] {
  return (
    Array.isArray(value) && value.every(isOfficeCatalogItem)
  );
}

/** Extracts offices from either a paged response, an envelope, or a direct array. */
export function extractOfficeList(value: unknown): readonly OfficeCatalogItem[] {
  if (Array.isArray(value)) {
    return value.filter(isOfficeCatalogItem);
  }
  if (isRecord(value)) {
    const target = 'data' in value && value['data'] !== null ? value['data'] : value;
    if (Array.isArray(target)) {
      return target.filter(isOfficeCatalogItem);
    }
    if (isRecord(target)) {
      const items = target['items'];
      if (Array.isArray(items)) {
        return items.filter(isOfficeCatalogItem);
      }
    }
  }
  return [];
}
