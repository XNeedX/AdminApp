import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';

import { positivePriceValidator } from './positive-price.validator';

function validate(value: unknown): boolean {
  return positivePriceValidator(new FormControl<unknown>(value)) !== null;
}

describe('positivePriceValidator', () => {
  it('leaves an empty value to Validators.required', () => {
    expect(validate(null)).toBe(false);
    expect(validate(undefined)).toBe(false);
    expect(validate('')).toBe(false);
  });

  it('rejects zero and negative values', () => {
    expect(validate(0)).toBe(true);
    expect(validate(-5)).toBe(true);
  });

  it('rejects non-numeric and non-finite values', () => {
    expect(validate('abc')).toBe(true);
    expect(validate(Number.NaN)).toBe(true);
    expect(validate(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('rejects more than two fractional digits', () => {
    expect(validate(0.001)).toBe(true);
    expect(validate(12.345)).toBe(true);
  });

  it('accepts positive prices with up to two fractional digits', () => {
    expect(validate(1)).toBe(false);
    expect(validate(0.01)).toBe(false);
    expect(validate(12.34)).toBe(false);
  });
});
