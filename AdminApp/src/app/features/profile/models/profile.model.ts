import { AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.model';
import { DoctorStatus } from '../../doctors/models/doctor-form.model';

/** Read model rendered in view mode and used to pre-fill edit mode. */
export interface DoctorProfile {
  readonly id: string;
  readonly photoPath: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  /** Normalized to `yyyy-MM-dd`. */
  readonly dateOfBirth: string;
  readonly specialization: string;
  readonly officeAddress: string;
  readonly careerStartYear: number;
  readonly status: DoctorStatus;
}

/** Values written into the shared form when entering edit mode. */
export interface DoctorProfileFormValue {
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  readonly dateOfBirth: string;
  readonly specializationText: string;
  readonly specializationId: string;
  readonly officeText: string;
  readonly officeId: string;
  /** Nullable because the shared form holds a nullable number control. */
  readonly careerStartYear: number | null;
  readonly status: DoctorStatus;
}

/** Resolves the catalog ids behind the stored labels. */
export function toDoctorFormValue(
  profile: DoctorProfile,
  specializations: readonly AutocompleteOption[],
  offices: readonly AutocompleteOption[]
): DoctorProfileFormValue {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleName: profile.middleName,
    dateOfBirth: profile.dateOfBirth.slice(0, 10),
    specializationText: profile.specialization,
    specializationId: findOptionByLabel(specializations, profile.specialization)?.id ?? '',
    officeText: profile.officeAddress,
    officeId: findOptionByLabel(offices, profile.officeAddress)?.id ?? '',
    careerStartYear: profile.careerStartYear,
    status: profile.status,
  };
}

/** Applies the saved values to the read model so view mode updates immediately. */
export function applyProfileChanges(
  profile: DoctorProfile,
  value: DoctorProfileFormValue,
  photoPath: string | null
): DoctorProfile {
  return {
    ...profile,
    photoPath,
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    middleName: value.middleName?.trim() || null,
    dateOfBirth: value.dateOfBirth,
    specialization: value.specializationText.trim(),
    officeAddress: value.officeText.trim(),
    careerStartYear: value.careerStartYear ?? profile.careerStartYear,
    status: value.status,
  };
}

function findOptionByLabel(
  options: readonly AutocompleteOption[],
  label: string
): AutocompleteOption | undefined {
  const normalized = label.trim().toLowerCase();

  return options.find((option) => option.label.trim().toLowerCase() === normalized);
}
