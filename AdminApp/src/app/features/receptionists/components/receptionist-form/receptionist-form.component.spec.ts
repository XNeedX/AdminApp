import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';

import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  ReceptionistFormGroup,
} from '../../models/receptionist-form.model';
import { OfficeOption } from '../../models/receptionist.model';
import { ReceptionistFormComponent } from './receptionist-form.component';

const OFFICES: readonly OfficeOption[] = [
  { id: 'office-1', label: 'Office A' },
  { id: 'office-2', label: 'Office B' },
];

function createForm(): FormGroup<ReceptionistFormGroup> {
  return new FormGroup<ReceptionistFormGroup>({
    photo: new FormControl<File | null>(null),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
    middleName: new FormControl<string | null>(null, {
      validators: [Validators.maxLength(MAX_NAME_LENGTH)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL_LENGTH)],
    }),
    officeText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    officeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

describe('ReceptionistFormComponent', () => {
  let fixture: ComponentFixture<ReceptionistFormComponent>;
  let component: ReceptionistFormComponent;
  let form: FormGroup<ReceptionistFormGroup>;

  function render(
    options: {
      isEditMode?: boolean;
      canSubmit?: boolean;
      offices?: readonly OfficeOption[];
      photoPreview?: string | null;
    } = {},
  ): void {
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('isEditMode', options.isEditMode ?? false);
    fixture.componentRef.setInput('offices', options.offices ?? OFFICES);
    fixture.componentRef.setInput('photoPreview', options.photoPreview ?? null);
    fixture.componentRef.setInput('canSubmit', options.canSubmit ?? false);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return root().textContent ?? '';
  }

  function button(label: string): HTMLButtonElement {
    const element = Array.from(root().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );

    if (element === undefined) {
      throw new Error(`Button "${label}" was not rendered.`);
    }

    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceptionistFormComponent],
    }).compileComponents();

    form = createForm();
    fixture = TestBed.createComponent(ReceptionistFormComponent);
    component = fixture.componentInstance;
  });

  it('renders the email field only in create mode', () => {
    render({ isEditMode: false });

    expect(root().querySelector('#receptionist-email')).not.toBeNull();
    expect(text()).toContain('Create receptionist profile');
    expect(button('Confirm')).not.toBeNull();

    render({ isEditMode: true });

    expect(root().querySelector('#receptionist-email')).toBeNull();
    expect(text()).toContain('Edit receptionist profile');
    expect(button('Save changes')).not.toBeNull();
  });

  it('keeps the primary action disabled until the host reports a valid form', () => {
    render({ canSubmit: false });

    expect(button('Confirm').disabled).toBe(true);

    render({ canSubmit: true });

    expect(button('Confirm').disabled).toBe(false);
  });

  it('renders the exact required messages once the controls are touched', () => {
    form.controls.firstName.markAsTouched();
    form.controls.lastName.markAsTouched();
    form.controls.email.markAsTouched();
    form.controls.officeText.markAsTouched();
    render();

    expect(text()).toContain('Please, enter the first name');
    expect(text()).toContain('Please, enter the last name');
    expect(text()).toContain('Please, enter the email');
    expect(text()).toContain('Please, choose the office');
  });

  it('renders the invalid email message', () => {
    form.controls.email.setValue('not-an-email');
    form.controls.email.markAsTouched();
    render();

    expect(text()).toContain("You've entered an invalid email");
  });

  it('renders the duplicate email message', () => {
    render();
    form.controls.email.setValue('taken@clinic.org');
    form.controls.email.setErrors({ emailTaken: true });
    form.controls.email.markAsTouched();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(text()).toContain('User with this email already exists');
  });

  it('renders the max-length message for an overlong name', () => {
    form.controls.firstName.setValue('a'.repeat(MAX_NAME_LENGTH + 1));
    form.controls.firstName.markAsTouched();
    render();

    expect(text()).toContain('First name must be 100 characters or fewer');
  });

  it('marks invalid touched controls with a red border and aria-invalid', () => {
    form.controls.firstName.markAsTouched();
    render();

    const input = root().querySelector('#receptionist-first-name');

    expect(input?.className).toContain('border-red-500');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  it('disables both footer actions while submitting', () => {
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('isSubmitting', true);
    fixture.componentRef.setInput('canSubmit', true);
    fixture.detectChanges();

    expect(button('Confirm').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    expect(button('Confirm').getAttribute('aria-busy')).toBe('true');
  });

  it('emits submitted and cancelled from its actions', () => {
    let submitted = 0;
    let cancelled = 0;

    component.submitted.subscribe(() => {
      submitted += 1;
    });
    component.cancelled.subscribe(() => {
      cancelled += 1;
    });

    render({ canSubmit: true });
    button('Confirm').click();
    button('Cancel').click();

    expect(submitted).toBe(1);
    expect(cancelled).toBe(1);
  });

  it('emits the selected office', () => {
    const selected: (OfficeOption | null)[] = [];
    component.officeSelected.subscribe((option) => selected.push(option));
    render();

    const select = root().querySelector<HTMLSelectElement>('#receptionist-office');
    expect(select).not.toBeNull();

    if (select !== null) {
      select.value = 'Office B';
      select.dispatchEvent(new Event('change'));
    }

    expect(selected).toEqual([{ id: 'office-2', label: 'Office B' }]);
  });

  it('emits the selected photo file', () => {
    const files: File[] = [];
    component.photoSelected.subscribe((file) => files.push(file));
    render();

    const input = root().querySelector<HTMLInputElement>('#receptionist-photo');
    const file = new File(['data'], 'photo.png', { type: 'image/png' });

    if (input !== null) {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
    }

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('photo.png');
  });

  it('emits photoCleared from the Remove photo action', () => {
    let cleared = 0;
    component.photoCleared.subscribe(() => {
      cleared += 1;
    });
    render({ photoPreview: 'blob:preview' });

    button('Remove photo').click();

    expect(cleared).toBe(1);
  });

  it('shows the no-office hint when the catalog is empty', () => {
    render({ offices: [] });

    expect(text()).toContain('Create an office before adding a receptionist.');
  });
});
