import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';
import { maxDateValidator, maxYearValidator } from './max-date.validator';

describe('maxDateValidator', () => {
  const referenceDate = new Date(2026, 4, 15); // May 15, 2026

  it('should return null for empty values', () => {
    const validator = maxDateValidator(() => referenceDate);
    expect(validator(new FormControl(''))).toBeNull();
    expect(validator(new FormControl(null))).toBeNull();
  });

  it('should return null for dates in the past or on reference date', () => {
    const validator = maxDateValidator(() => referenceDate);
    expect(validator(new FormControl('2026-05-14'))).toBeNull();
    expect(validator(new FormControl('2026-05-15'))).toBeNull();
    expect(validator(new FormControl('1990-01-01'))).toBeNull();
  });

  it('should return futureDate error for dates in the future', () => {
    const validator = maxDateValidator(() => referenceDate);
    const result = validator(new FormControl('2026-05-16'));
    expect(result).not.toBeNull();
    expect(result?.['futureDate']).toBeDefined();
  });
});

describe('maxYearValidator', () => {
  const referenceYear = 2026;

  it('should return null for empty values', () => {
    const validator = maxYearValidator(() => referenceYear);
    expect(validator(new FormControl(null))).toBeNull();
    expect(validator(new FormControl(''))).toBeNull();
  });

  it('should return null for years in the past or current year', () => {
    const validator = maxYearValidator(() => referenceYear);
    expect(validator(new FormControl(2020))).toBeNull();
    expect(validator(new FormControl(2026))).toBeNull();
    expect(validator(new FormControl('2026'))).toBeNull();
  });

  it('should return futureYear error for future years', () => {
    const validator = maxYearValidator(() => referenceYear);
    const result = validator(new FormControl(2027));
    expect(result).not.toBeNull();
    expect(result?.['futureYear']).toBeDefined();
  });
});
