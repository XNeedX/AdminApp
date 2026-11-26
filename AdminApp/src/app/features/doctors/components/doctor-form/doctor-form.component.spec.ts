import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';

import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import { catalogMatchValidator } from '../../../../core/validators/catalog-match.validator';
import { maxDateValidator, maxYearValidator } from '../../../../core/validators/max-date.validator';
import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import {
  DoctorFormGroup,
  DoctorFormMode,
  DoctorStatus,
} from '../../models/doctor-form.model';
import { DoctorFormComponent } from './doctor-form.component';

const SPECIALIZATIONS: readonly AutocompleteOption[] = [
  { id: 'spec-cardiology', label: 'Cardiology' },
  { id: 'spec-neurology', label: 'Neurology' },
];

const OFFICES: readonly AutocompleteOption[] = [
  { id: 'office-1', label: '1st floor, room 101' },
  { id: 'office-2', label: '2nd floor, room 202' },
];

function createForm(): FormGroup<DoctorFormGroup> {
  return new FormGroup<DoctorFormGroup>({
    photo: new FormControl<File | null>(null),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    middleName: new FormControl<string | null>(null),
    dateOfBirth: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, maxDateValidator()],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    specializationText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, catalogMatchValidator(() => SPECIALIZATIONS)],
    }),
    specializationId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    officeText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    officeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    careerStartYear: new FormControl<number | null>(null, {
      validators: [Validators.required, maxYearValidator()],
    }),
    status: new FormControl<DoctorStatus>(DoctorStatus.AtWork, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
}

describe('DoctorFormComponent', () => {
  let fixture: ComponentFixture<DoctorFormComponent>;
  let component: DoctorFormComponent;
  let form: FormGroup<DoctorFormGroup>;

  function render(mode: DoctorFormMode = 'create', canSubmit = false): void {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('specializations', SPECIALIZATIONS);
    fixture.componentRef.setInput('offices', OFFICES);
    fixture.componentRef.setInput('canSubmit', canSubmit);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement {
    const element = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((candidate) => candidate.textContent?.trim() === label);

    if (element === undefined) {
      throw new Error(`Button "${label}" was not rendered.`);
    }

    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorFormComponent],
    }).compileComponents();

    form = createForm();
    fixture = TestBed.createComponent(DoctorFormComponent);
    component = fixture.componentInstance;
  });

  it('renders every required field in create mode with the Confirm action', () => {
    render('create');

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#first-name')).not.toBeNull();
    expect(root.querySelector('#last-name')).not.toBeNull();
    expect(root.querySelector('#middle-name')).not.toBeNull();
    expect(root.querySelector('#dob')).not.toBeNull();
    expect(root.querySelector('#email')).not.toBeNull();
    expect(root.querySelector('#specialization-input')).not.toBeNull();
    expect(root.querySelector('#office')).not.toBeNull();
    expect(root.querySelector('#career-year')).not.toBeNull();
    expect(root.querySelector('#doctor-status')).not.toBeNull();
    expect(button('Confirm')).not.toBeNull();
    expect((root.querySelector('#email') as HTMLInputElement).readOnly).toBe(false);
  });

  it('hides the photo control until the Documents operation exists', () => {
    render('create');

    expect((fixture.nativeElement as HTMLElement).querySelector('#photo-upload')).toBeNull();
  });

  it('keeps Confirm disabled until the host reports a valid form', () => {
    render('create', false);

    expect(button('Confirm').disabled).toBe(true);

    fixture.componentRef.setInput('canSubmit', true);
    fixture.detectChanges();

    expect(button('Confirm').disabled).toBe(false);
  });

  it('renders every required-field message once the controls are touched', () => {
    form.controls.status.addValidators(() => ({ required: true }));
    form.controls.status.updateValueAndValidity();
    form.markAllAsTouched();
    render('create');

    expect(text()).toContain('Please, enter the first name');
    expect(text()).toContain('Please, enter the last name');
    expect(text()).toContain('Please, enter the email');
    expect(text()).toContain('Please, select the date');
    expect(text()).toContain('Please, choose the specialisation');
    expect(text()).toContain('Please, choose the office');
    expect(text()).toContain('Please, select the year');
    expect(text()).toContain('Please, choose the status');
  });

  it('renders the invalid-email and invalid-specialization messages', () => {
    form.controls.email.setValue('not-an-email');
    form.controls.specializationText.setValue('Unknown specialty');
    form.markAllAsTouched();
    render('create');

    expect(text()).toContain("You've entered an invalid email");
    expect(text()).toContain('Invalid specialization name');
  });

  it('marks an invalid touched control with the red border', () => {
    form.controls.firstName.markAsTouched();
    render('create');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#first-name')?.className
    ).toContain('border-red-500');
  });

  it('treats a whitespace-only first name as empty', () => {
    form.controls.firstName.setValue('   ');

    expect(form.controls.firstName.hasError('required')).toBe(true);
  });

  it('renders the Save changes action and hides the create-only email field in edit mode', () => {
    render('edit');

    expect((fixture.nativeElement as HTMLElement).querySelector('#email')).toBeNull();
    expect(button('Save changes')).not.toBeNull();
    expect(text()).toContain('Edit profile');
  });

  it('keeps Save changes disabled while a field is invalid or a save is running', () => {
    render('edit', false);

    expect(button('Save changes').disabled).toBe(true);

    fixture.componentRef.setInput('canSubmit', true);
    fixture.componentRef.setInput('isSubmitting', true);
    fixture.detectChanges();

    expect(button('Save changes').disabled).toBe(true);
  });

  it('uses the same field messages in edit mode', () => {
    form.controls.firstName.markAsTouched();
    form.controls.status.addValidators(() => ({ required: true }));
    form.controls.status.updateValueAndValidity();
    form.controls.status.markAsTouched();
    render('edit');

    expect(text()).toContain('Please, enter the first name');
    expect(text()).toContain('Please, choose the status');
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

    render('create', true);
    button('Confirm').click();
    button('Cancel').click();

    expect(submitted).toBe(1);
    expect(cancelled).toBe(1);
  });
});
