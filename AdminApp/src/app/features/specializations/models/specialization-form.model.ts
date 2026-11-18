import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { nonBlankValidator } from '../../../core/validators/non-blank.validator';
import { positivePriceValidator } from '../../../core/validators/positive-price.validator';
import {
  ServiceCategory,
  SpecializationFormValue,
  SpecializationServiceFormValue,
  SpecializationServiceRow,
  SpecializationStatus,
} from './specialization.model';

/** Typed controls of one row in the nested services table. */
export interface ServiceRowControls {
  /** Editor-only identity: stable key for tracking plus the stored id when it exists. */
  key: FormControl<string>;
  id: FormControl<string | null>;
  name: FormControl<string>;
  price: FormControl<number | null>;
  category: FormControl<ServiceCategory | ''>;
  status: FormControl<SpecializationStatus>;
}

/** Typed shape of the specialization form. */
export interface SpecializationFormControls {
  name: FormControl<string>;
  status: FormControl<SpecializationStatus>;
  services: FormArray<FormGroup<ServiceRowControls>>;
}

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** Maximum specialization name length enforced by the form (FR-048). */
export const SPECIALIZATION_NAME_MAX_LENGTH = 100;

/** Maximum service name length, matching the services module. */
export const SERVICE_NAME_MAX_LENGTH = 100;

export const SPECIALIZATION_STATUS_OPTIONS: readonly SpecializationStatus[] = [
  'Active',
  'Inactive',
];

/** Service rows share the specialization status vocabulary. */
export const SERVICE_STATUS_OPTIONS: readonly SpecializationStatus[] =
  SPECIALIZATION_STATUS_OPTIONS;

/** The category dropdown has no default selection; the user must choose explicitly. */
export const SERVICE_CATEGORY_OPTIONS: readonly SelectOption<ServiceCategory>[] = [
  { value: 'Analyses', label: 'Analyses' },
  { value: 'Consultations', label: 'Consultations' },
  { value: 'Diagnostics', label: 'Diagnostics' },
];

/** Exact user-facing validation strings required by the specification. */
export const VALIDATION_MESSAGES = {
  nameRequired: 'Please, enter the name',
  nameTooLong: `The name must not exceed ${SPECIALIZATION_NAME_MAX_LENGTH} characters`,
  priceRequired: 'Please, enter the price',
  priceInvalid: "You've entered an invalid price",
  categoryRequired: 'Please, choose the service category',
} as const;

let rowSequence = 0;

function createRowKey(): string {
  const uuid: unknown = globalThis.crypto?.randomUUID?.();

  if (typeof uuid === 'string' && uuid.length > 0) {
    return uuid;
  }

  rowSequence += 1;
  return `service-row-${rowSequence}`;
}

/** Creates one typed service row; stored rows keep their id and are not discardable. */
export function createServiceRow(
  row: SpecializationServiceRow | null = null,
): FormGroup<ServiceRowControls> {
  return new FormGroup<ServiceRowControls>({
    key: new FormControl(createRowKey(), { nonNullable: true }),
    id: new FormControl<string | null>(row?.id ?? null),
    name: new FormControl(row?.name ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonBlankValidator,
        Validators.maxLength(SERVICE_NAME_MAX_LENGTH),
      ],
    }),
    price: new FormControl<number | null>(row?.price ?? null, {
      validators: [Validators.required, positivePriceValidator],
    }),
    category: new FormControl<ServiceCategory | ''>(row?.category ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    status: new FormControl<SpecializationStatus>(row?.status ?? 'Active', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
}

/** Creates the specialization form, with an empty services array (FR-011). */
export function createSpecializationForm(): FormGroup<SpecializationFormControls> {
  return new FormGroup<SpecializationFormControls>({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonBlankValidator,
        Validators.maxLength(SPECIALIZATION_NAME_MAX_LENGTH),
      ],
    }),
    status: new FormControl<SpecializationStatus>('Active', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    services: new FormArray<FormGroup<ServiceRowControls>>([], {
      validators: [Validators.minLength(1)],
    }),
  });
}

/**
 * Narrows the raw form value into the emitted value.
 *
 * Returns `null` when the form is invalid or when a nullable control was bypassed, so a
 * consumer can never receive an empty name, `null` price or empty category.
 */
export function toSpecializationFormValue(
  form: FormGroup<SpecializationFormControls>,
): SpecializationFormValue | null {
  if (form.invalid || form.controls.services.length === 0) {
    return null;
  }

  const raw = form.getRawValue();
  const services: SpecializationServiceFormValue[] = [];

  for (const row of raw.services) {
    if (row.price === null || row.category === '') {
      return null;
    }

    services.push({
      key: row.key,
      id: row.id,
      name: row.name.trim(),
      price: row.price,
      status: row.status,
      category: row.category,
    });
  }

  return {
    name: raw.name.trim(),
    status: raw.status,
    services,
  };
}
