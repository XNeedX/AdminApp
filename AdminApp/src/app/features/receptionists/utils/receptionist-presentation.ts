import { environment } from '../../../../environments/environment.development';
import { ReceptionistProfile } from '../models/receptionist.model';

/** Builds the display name, omitting an absent middle name without a stray separator. */
export function fullName(
  person: Pick<ReceptionistProfile, 'firstName' | 'lastName' | 'middleName'>,
): string {
  return [person.firstName, person.lastName, person.middleName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');
}

/** Avatar fallback for a profile without a photo. */
export function initials(person: Pick<ReceptionistProfile, 'firstName' | 'lastName'>): string {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

/** Explicit "not provided" value for an absent optional field (FR-031). */
export function displayValue(value: string | null): string {
  return value === null || value.trim().length === 0 ? 'Not provided' : value;
}

/** Explicit "not assigned" indicator for a missing office (FR-055). */
export function officeLabel(value: string | null): string {
  return value === null || value.trim().length === 0 ? 'Not assigned' : value;
}

/** Resolves a stored Documents id to the Gateway image URL, or null without a photo. */
export function photoUrl(photoPath: string | null): string | null {
  return photoPath === null || photoPath.trim().length === 0
    ? null
    : `${environment.apiUrl}/documents/Documents/${photoPath}`;
}
