import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';

import { OfficeResponseDto } from '../../../api/generated/offices/models/office-response-dto';
import { OfficeStatus } from '../../../api/generated/offices/models/office-status';
import { extractErrorMessage } from '../../../core/interceptors/api-error.interceptor';

export const OFFICE_STATUS_OPTIONS = [
  { value: OfficeStatus.Active, label: 'Active' },
  { value: OfficeStatus.Inactive, label: 'Inactive' },
] as const;

export const OFFICE_ADDRESS_FIELDS = [
  { name: 'city', label: 'City' },
  { name: 'street', label: 'Street' },
  { name: 'houseNumber', label: 'House number' },
  { name: 'officeNumber', label: 'Office number' },
] as const;

export interface OfficeFormControls {
  city: FormControl<string>;
  street: FormControl<string>;
  houseNumber: FormControl<string>;
  officeNumber: FormControl<string>;
  registryDigits: FormControl<string>;
  status: FormControl<OfficeStatus>;
}

export interface OfficeView {
  readonly id: string;
  readonly photoPath: string | null;
  readonly fullAddress: string;
  readonly city: string;
  readonly street: string;
  readonly houseNumber: string;
  readonly officeNumber: string;
  readonly registryPhoneNumber: string;
  readonly status: OfficeStatus;
}

export function toOfficeView(dto: OfficeResponseDto): OfficeView {
  const status = OFFICE_STATUS_OPTIONS.find((option) => option.label === dto?.status)?.value;
  if (!dto?.id || !dto.fullAddress || !dto.registryPhoneNumber || status === undefined) {
    throw new Error('The offices service returned an incomplete office.');
  }

  return {
    id: dto.id,
    photoPath: dto.photoPath ?? null,
    fullAddress: dto.fullAddress,
    city: dto.city ?? '',
    street: dto.street ?? '',
    houseNumber: dto.houseNumber ?? '',
    officeNumber: dto.officeNumber ?? '',
    registryPhoneNumber: dto.registryPhoneNumber,
    status,
  };
}

export function officeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const errors: unknown = error.error?.errors;
    return Array.isArray(errors) && typeof errors[0] === 'string'
      ? errors[0]
      : extractErrorMessage(error);
  }

  return error instanceof Error ? error.message : fallback;
}
