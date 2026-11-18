import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function maxDateValidator(maxDateProvider: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }

    const inputDate = new Date(value);
    if (isNaN(inputDate.getTime())) {
      return null;
    }

    const maxDate = maxDateProvider();
    // Compare dates at midnight (ignoring time)
    const normalizedInput = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
    const normalizedMax = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

    if (normalizedInput.getTime() > normalizedMax.getTime()) {
      return { futureDate: { max: normalizedMax.toISOString(), actual: value } };
    }

    return null;
  };
}

export function maxYearValidator(maxYearProvider: () => number = () => new Date().getFullYear()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericYear = typeof value === 'number' ? value : parseInt(value, 10);
    if (isNaN(numericYear)) {
      return null;
    }

    const maxYear = maxYearProvider();
    if (numericYear > maxYear) {
      return { futureYear: { max: maxYear, actual: numericYear } };
    }

    return null;
  };
}
