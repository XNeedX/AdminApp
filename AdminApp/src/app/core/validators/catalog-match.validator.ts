import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Minimal structural shape required to validate a catalog-backed text value. */
export interface CatalogOption {
  readonly label: string;
}

/**
 * Validates that a non-empty text value matches a label in the current catalog.
 *
 * Empty text is intentionally accepted here so that `Validators.required` owns the
 * "please choose" message. Matching is case-insensitive and ignores surrounding
 * whitespace, mirroring how the backend stores specialization and office values.
 */
export function catalogMatchValidator(options: () => readonly CatalogOption[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    const text = typeof value === 'string' ? value.trim() : '';

    if (text.length === 0) {
      return null;
    }

    const normalized = text.toLowerCase();
    const exists = options().some(
      (option) => option.label.trim().toLowerCase() === normalized
    );

    return exists ? null : { invalidCatalogValue: true };
  };
}
