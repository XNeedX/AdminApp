import { CreateReceptionistRequest } from '../../../api/generated/profiles/models/create-receptionist-request';
import { UpdateReceptionistDto } from '../../../api/generated/profiles/models/update-receptionist-dto';
import { ReceptionistFormValue } from '../models/receptionist-form.model';

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

function optionalText(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

/** Builds the `POST /Receptionists` body. Email is written only here. */
export function toCreateReceptionistRequest(
  value: ReceptionistFormValue,
  photoPath: string | null,
): CreateReceptionistRequest {
  return {
    photoPath,
    firstName: requiredText(value.firstName, 'first name'),
    lastName: requiredText(value.lastName, 'last name'),
    middleName: optionalText(value.middleName),
    email: requiredText(value.email, 'email'),
    officeAddress: requiredText(value.officeText, 'office'),
  };
}

/** Builds the `PUT /Receptionists/{id}` body. Email is create-only and is omitted. */
export function toUpdateReceptionistDto(
  value: ReceptionistFormValue,
  photoPath: string | null,
): UpdateReceptionistDto {
  return {
    photoPath,
    firstName: requiredText(value.firstName, 'first name'),
    lastName: requiredText(value.lastName, 'last name'),
    middleName: optionalText(value.middleName),
    officeAddress: requiredText(value.officeText, 'office'),
  };
}
