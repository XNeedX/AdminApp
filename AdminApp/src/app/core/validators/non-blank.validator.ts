import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Rejects values that are empty after trimming.
 *
 * Returns the same `required` error key as `Validators.required` so callers keep a
 * single "please enter …" message for both an untouched and a whitespace-only field.
 */
export const nonBlankValidator: ValidatorFn = (
  control: AbstractControl<unknown>
): ValidationErrors | null => {
  const value = control.value;

  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().length === 0 ? { required: true } : null;
};
