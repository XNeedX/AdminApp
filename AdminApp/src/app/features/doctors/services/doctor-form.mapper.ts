import { CreateDoctorDto } from '../../../api/generated/profiles/models/create-doctor-dto';
import { UpdateDoctorDto } from '../../../api/generated/profiles/models/update-doctor-dto';
import { DoctorFormValue } from '../models/doctor-form.model';

/**
 * Pure mapping between the shared form value and the generated request DTOs.
 *
 * Both functions are called only after the form reports `valid`, so every required
 * member is present; the helpers below still fail loudly instead of sending a
 * fabricated value if that precondition is ever broken.
 */

function requiredText(value: string | null, field: string): string {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) {
    throw new Error(`The ${field} field is required.`);
  }

  return trimmed;
}

function requiredYear(value: number | null): number {
  if (value === null) {
    throw new Error('The career start year field is required.');
  }

  return value;
}

/** Builds the `POST /Doctors` body. Email is written only here. */
export function toCreateDoctorDto(
  value: DoctorFormValue,
  photoPath: string | null
): CreateDoctorDto {
  return {
    photoPath,
    firstName: requiredText(value.firstName, 'first name'),
    lastName: requiredText(value.lastName, 'last name'),
    middleName: value.middleName?.trim() || null,
    dateOfBirth: requiredText(value.dateOfBirth, 'date of birth'),
    email: requiredText(value.email, 'email'),
    specialization: requiredText(value.specializationText, 'specialization'),
    officeAddress: requiredText(value.officeText, 'office'),
    careerStartYear: requiredYear(value.careerStartYear),
    status: value.status,
  };
}

/** Builds the `PUT /Doctors/{id}` body. Email is immutable and never sent. */
export function toUpdateDoctorDto(
  value: DoctorFormValue,
  photoPath: string | null
): UpdateDoctorDto {
  return {
    photoPath,
    firstName: requiredText(value.firstName, 'first name'),
    lastName: requiredText(value.lastName, 'last name'),
    middleName: value.middleName?.trim() || null,
    dateOfBirth: requiredText(value.dateOfBirth, 'date of birth'),
    specialization: requiredText(value.specializationText, 'specialization'),
    officeAddress: requiredText(value.officeText, 'office'),
    careerStartYear: requiredYear(value.careerStartYear),
    status: value.status,
  };
}
