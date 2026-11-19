import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  EMAIL_INVALID_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  FIRST_NAME_REQUIRED_MESSAGE,
  LAST_NAME_REQUIRED_MESSAGE,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  NO_OFFICES_MESSAGE,
  OFFICE_REQUIRED_MESSAGE,
  ReceptionistFormGroup,
  ReceptionistTextField,
  maxLengthMessage,
} from '../../models/receptionist-form.model';
import { OfficeOption } from '../../models/receptionist.model';

/**
 * Dumb receptionist form shared by the create dialog and the profile edit mode.
 *
 * It injects nothing: the host owns the form instance, the catalog, validation and
 * transport. `isEditMode` hides the create-only email field and switches the primary
 * button label.
 */
@Component({
  selector: 'app-receptionist-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './receptionist-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionistFormComponent {
  readonly form = input.required<FormGroup<ReceptionistFormGroup>>();
  readonly isEditMode = input<boolean>(false);
  readonly offices = input<readonly OfficeOption[]>([]);
  readonly photoPreview = input<string | null>(null);
  readonly photoError = input<string | null>(null);
  readonly formError = input<string | null>(null);
  readonly isSubmitting = input<boolean>(false);
  readonly canSubmit = input<boolean>(false);

  readonly submitted = output<void>();
  readonly cancelled = output<void>();
  readonly photoSelected = output<File>();
  readonly photoCleared = output<void>();
  readonly officeSelected = output<OfficeOption | null>();

  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly maxEmailLength = MAX_EMAIL_LENGTH;
  protected readonly noOfficesMessage = NO_OFFICES_MESSAGE;

  protected readonly title = computed<string>(() =>
    this.isEditMode() ? 'Edit receptionist profile' : 'Create receptionist profile',
  );

  protected readonly primaryLabel = computed<string>(() =>
    this.isEditMode() ? 'Save changes' : 'Confirm',
  );

  protected readonly subtitle = computed<string>(() =>
    this.isEditMode()
      ? "Update the receptionist's personal details and office."
      : 'Add a new receptionist to the clinic staff directory.',
  );

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
    input.value = '';

    if (file !== undefined) {
      this.photoSelected.emit(file);
    }
  }

  protected onOfficeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const option = this.offices().find((item) => item.label === select.value) ?? null;

    this.officeSelected.emit(option);
  }

  protected isInvalid(control: ReceptionistTextField): boolean {
    if (control === 'email' && this.isEditMode()) {
      return false;
    }

    const field = this.form().controls[control];

    return field.invalid && field.touched;
  }

  protected fieldError(control: ReceptionistTextField): string | null {
    if (control === 'email' && this.isEditMode()) {
      return null;
    }

    const field = this.form().controls[control];

    if (!field.touched || field.errors === null) {
      return null;
    }

    if (field.errors['required'] === true) {
      switch (control) {
        case 'firstName':
          return FIRST_NAME_REQUIRED_MESSAGE;
        case 'lastName':
          return LAST_NAME_REQUIRED_MESSAGE;
        case 'email':
          return EMAIL_REQUIRED_MESSAGE;
        case 'middleName':
          return null;
      }
    }

    if (control === 'email') {
      if (field.errors['email'] === true) {
        return EMAIL_INVALID_MESSAGE;
      }

      if (field.errors['emailTaken'] === true) {
        return EMAIL_TAKEN_MESSAGE;
      }
    }

    if (field.errors['maxlength'] !== undefined) {
      return maxLengthMessage(fieldLabel(control), fieldMaxLength(control));
    }

    return null;
  }

  protected isOfficeInvalid(): boolean {
    const field = this.form().controls.officeText;

    return field.invalid && field.touched;
  }

  protected officeError(): string | null {
    const field = this.form().controls.officeText;

    if (!field.touched || field.errors === null) {
      return null;
    }

    return field.errors['required'] === true ? OFFICE_REQUIRED_MESSAGE : null;
  }

  protected isPhotoInvalid(): boolean {
    return this.photoError() !== null;
  }
}

function fieldLabel(control: ReceptionistTextField): string {
  switch (control) {
    case 'firstName':
      return 'First name';
    case 'lastName':
      return 'Last name';
    case 'middleName':
      return 'Middle name';
    case 'email':
      return 'Email';
  }
}

function fieldMaxLength(control: ReceptionistTextField): number {
  return control === 'email' ? MAX_EMAIL_LENGTH : MAX_NAME_LENGTH;
}
