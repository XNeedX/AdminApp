import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const MAX_FRACTION_DIGITS = 2;
const FRACTION_SCALE = 10 ** MAX_FRACTION_DIGITS;
const PRECISION_EPSILON = 1e-6;

/**
 * Validates that a price is a finite number greater than zero with at most two
 * fractional digits.
 *
 * Empty values are left to `Validators.required` so the form can show
 * "Please, enter the price" instead of "You've entered an invalid price".
 */
export const positivePriceValidator: ValidatorFn = (
  control: AbstractControl<unknown>
): ValidationErrors | null => {
  const value = control.value;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return { invalidPrice: true };
  }

  return hasAtMostFractionDigits(value) ? null : { invalidPrice: true };
};

function hasAtMostFractionDigits(value: number): boolean {
  const scaled = value * FRACTION_SCALE;
  const rounded = Math.round(scaled);
  const tolerance = PRECISION_EPSILON * Math.max(1, Math.abs(scaled));

  return Math.abs(scaled - rounded) <= tolerance;
}
