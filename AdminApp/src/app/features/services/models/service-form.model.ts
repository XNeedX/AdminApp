import { FormControl } from '@angular/forms';

import { ServiceCategory, ServiceStatus } from './service.model';

/** Typed reactive form shape owned by `ServiceFormComponent`. */
export interface ServiceFormControls {
  name: FormControl<string>;
  price: FormControl<number | null>;
  category: FormControl<ServiceCategory | ''>;
  status: FormControl<ServiceStatus>;
}

export interface ServiceCategoryOption {
  readonly value: ServiceCategory;
  readonly label: string;
}

/** The dropdown has no default selection; the user must choose explicitly. */
export const SERVICE_CATEGORY_OPTIONS: readonly ServiceCategoryOption[] = [
  { value: 'Analyses', label: 'Analyses' },
  { value: 'Consultations', label: 'Consultations' },
  { value: 'Diagnostics', label: 'Diagnostics' },
];

export const SERVICE_STATUS_OPTIONS: readonly ServiceStatus[] = ['Active', 'Inactive'];

/** Maximum service name length enforced by the form (FR-034). */
export const SERVICE_NAME_MAX_LENGTH = 100;
