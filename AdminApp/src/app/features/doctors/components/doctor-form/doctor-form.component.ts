import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, input, output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { merge } from 'rxjs';

import { AutocompleteComponent } from '../../../../shared/components/autocomplete/autocomplete.component';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import {
  DOCTOR_STATUSES,
  DoctorFormGroup,
  DoctorFormMode,
  DoctorStatus,
  currentDoctorProfileDate,
} from '../../models/doctor-form.model';

/**
 * Dumb doctor form shared by the create dialog (US1) and the profile edit mode (US3).
 *
 * It injects nothing: the host owns the form instance, the catalogs, validation and
 * transport. Only the copy and the email state differ between modes.
 */
@Component({
  selector: 'app-doctor-form',
  standalone: true,
  imports: [ReactiveFormsModule, AutocompleteComponent],
  templateUrl: './doctor-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorFormComponent {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly mode = input.required<DoctorFormMode>();
  readonly form = input.required<FormGroup<DoctorFormGroup>>();
  readonly specializations = input<readonly AutocompleteOption[]>([]);
  readonly offices = input<readonly AutocompleteOption[]>([]);
  readonly photoPreview = input<string | null>(null);
  readonly photoError = input<string | null>(null);
  readonly formError = input<string | null>(null);
  readonly isSubmitting = input<boolean>(false);
  readonly canSubmit = input<boolean>(false);
  readonly showPhoto = input<boolean>(false);

  readonly submitted = output<void>();
  readonly cancelled = output<void>();
  readonly photoSelected = output<File>();
  readonly photoRemoved = output<void>();
  readonly specializationSelected = output<AutocompleteOption>();
  readonly officeSelected = output<AutocompleteOption>();

  protected readonly statuses: readonly DoctorStatus[] = DOCTOR_STATUSES;

  protected readonly title = computed<string>(() =>
    this.mode() === 'create' ? 'Create Doctor Profile' : 'Edit profile'
  );

  protected readonly primaryLabel = computed<string>(() =>
    this.mode() === 'create' ? 'Confirm' : 'Save changes'
  );

  protected readonly currentDate = currentDoctorProfileDate();
  protected readonly currentYear = Number(this.currentDate.slice(0, 4));
  protected readonly careerYears = Array.from({ length: 100 }, (_, index) => this.currentYear - index);

  constructor() {
    effect((onCleanup) => {
      const controls = Object.values(this.form().controls);
      // Blur updates touched state without changing the form status.
      const events = merge(...controls.map((control) => control.events))
        .subscribe(() => this.changeDetector.markForCheck());
      onCleanup(() => events.unsubscribe());
    });
  }

  protected onPhotoRemoved(input: HTMLInputElement): void {
    input.value = '';
    this.photoRemoved.emit();
  }

  protected onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.form().markAllAsTouched();
    this.submitted.emit();
  }

  protected onCancel(): void {
    if (!this.isSubmitting()) {
      this.cancelled.emit();
    }
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file !== undefined) {
      this.photoSelected.emit(file);
    }
  }

  protected onSpecializationSelected(option: AutocompleteOption): void {
    this.specializationSelected.emit(option);
  }

  protected onOfficeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const option = this.offices().find((item) => item.label === select.value);

    if (option !== undefined) {
      this.officeSelected.emit(option);
    }
  }

  protected isInvalid(control: 'firstName' | 'lastName' | 'dateOfBirth' | 'email'): boolean {
    const field = this.form().controls[control];

    return field.invalid && field.touched;
  }

  protected isSpecializationInvalid(): boolean {
    const field = this.form().controls.specializationText;

    return field.invalid && field.touched;
  }

  protected isOfficeInvalid(): boolean {
    const field = this.form().controls.officeText;

    return field.invalid && field.touched;
  }

  protected isYearInvalid(): boolean {
    const field = this.form().controls.careerStartYear;

    return field.invalid && field.touched;
  }

  protected fieldError(
    control: 'firstName' | 'lastName' | 'dateOfBirth' | 'email'
  ): string | null {
    const field = this.form().controls[control];

    if (!field.touched || field.errors === null) {
      return null;
    }

    if (field.errors['required'] === true) {
      switch (control) {
        case 'firstName':
          return 'Please, enter the first name';
        case 'lastName':
          return 'Please, enter the last name';
        case 'dateOfBirth':
          return 'Please, select the date';
        case 'email':
          return 'Please, enter the email';
      }
    }

    if (field.errors['maxlength'] && (control === 'firstName' || control === 'lastName')) {
      return 'Enter no more than 100 characters';
    }

    if (control === 'email') {
      if (field.errors['email'] === true) {
        return "You've entered an invalid email";
      }

      if (field.errors['emailTaken'] === true) {
        return 'User with this email already exists';
      }
    }

    if (control === 'dateOfBirth') {
      if (field.errors['pattern']) return 'Please, select a valid date';
      if (field.errors['futureDate']) return 'Date of birth cannot be in the future';
    }

    return null;
  }

  protected specializationError(): string | null {
    const field = this.form().controls.specializationText;

    if (!field.touched || field.errors === null) {
      return null;
    }

    if (field.errors['required'] === true) {
      return 'Please, choose the specialisation';
    }

    if (field.errors['invalidCatalogValue'] === true) {
      return 'Invalid specialization name';
    }

    return null;
  }

  protected officeError(): string | null {
    const field = this.form().controls.officeText;

    if (!field.touched || field.errors === null) {
      return null;
    }

    return field.errors['required'] === true
      ? 'Please, choose the office'
      : 'Invalid office address';
  }

  protected yearError(): string | null {
    const field = this.form().controls.careerStartYear;

    if (!field.touched || field.errors === null) {
      return null;
    }

    if (field.errors['required'] === true) {
      return 'Please, select the year';
    }

    if (field.errors['min'] || field.errors['pattern']) return 'Please, select a valid year';

    if (field.errors['futureYear'] !== undefined) {
      return 'Career start year cannot be in the future';
    }

    return null;
  }

  protected statusError(): string | null {
    const field = this.form().controls.status;

    return field.touched && field.errors?.['required'] === true
      ? 'Please, choose the status'
      : null;
  }
}
