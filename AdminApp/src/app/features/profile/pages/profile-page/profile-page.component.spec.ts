import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DoctorsService } from '../../../../api/generated/profiles/services/doctors.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { DoctorFormGroup, DoctorStatus, CANCEL_EDIT_MESSAGE } from '../../../doctors/models/doctor-form.model';
import { DoctorCatalogStore } from '../../../doctors/services/doctor-catalog.store';
import { ReceptionistPhotoService } from '../../../receptionists/services/receptionist-photo.service';
import { ProfilePageComponent } from './profile-page.component';

const DOCTOR_ID = 'd1';

const DETAILS = {
  id: DOCTOR_ID,
  status: DoctorStatus.AtWork,
  photoPath: null,
  firstName: 'Alice',
  lastName: 'Brown',
  middleName: 'Marie',
  dateOfBirth: '1980-01-01T00:00:00',
  specialization: 'Cardiology',
  officeAddress: 'Office A',
  careerStartYear: 2010,
};

function envelope<T>(data: T): unknown {
  return { isSuccess: true, data, message: null, errors: [] };
}

interface ProfileInternals {
  readonly profile: () => { readonly firstName: string } | null;
  readonly isEditMode: () => boolean;
  readonly isLoading: () => boolean;
  readonly loadError: () => string | null;
  readonly formError: () => string | null;
  readonly form: import('@angular/forms').FormGroup<DoctorFormGroup>;
  save(): Promise<void>;
  cancelEdit(): void;
  enterEditMode(): void;
}

describe('ProfilePageComponent', () => {
  let fixture: ComponentFixture<ProfilePageComponent>;
  let internals: ProfileInternals;

  const doctorsIdProfileGet = vi.fn();
  const doctorsMeGet = vi.fn();
  const doctorsIdPut = vi.fn();
  const upload = vi.fn();
  let routeId: string | null;
  const open = vi.fn();
  const showSuccess = vi.fn();
  const loadCatalogs = vi.fn(() => Promise.resolve());

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function action(label: string): HTMLButtonElement {
    const element = Array.from(root().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === label
    );

    if (element === undefined) {
      throw new Error(`Button "${label}" was not rendered.`);
    }

    return element;
  }

  async function settle(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(internals.isLoading()).toBe(false);
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    doctorsIdProfileGet.mockReset();
    doctorsMeGet.mockReset();
    doctorsIdPut.mockReset();
    open.mockReset();
    showSuccess.mockReset();
    loadCatalogs.mockClear();
    upload.mockReset();
    routeId = DOCTOR_ID;

    doctorsIdProfileGet.mockReturnValue(of(envelope(DETAILS)));
    doctorsMeGet.mockReturnValue(of(envelope(DETAILS)));
    doctorsIdPut.mockReturnValue(of({ isSuccess: true, message: null, errors: [] }));

    await TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: DoctorsService,
          useValue: {
            doctorsIdProfileGet$Json: doctorsIdProfileGet,
            doctorsMeGet$Json: doctorsMeGet,
            doctorsIdPut,
          },
        },
        {
          provide: DoctorCatalogStore,
          useValue: {
            specializations: signal([{ id: 'spec-cardiology', label: 'Cardiology' }]),
            offices: signal([{ id: 'office-1', label: 'Office A' }]),
            error: signal<string | null>(null),
            load: loadCatalogs,
          },
        },
        { provide: Dialog, useValue: { open } },
        { provide: ReceptionistPhotoService, useValue: {
          upload,
          url: (id: string | null) => id === null ? null : '/documents/' + id,
        } },
        {
          provide: NotificationService,
          useValue: { showSuccess, showError: vi.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'id' ? routeId : null) } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePageComponent);
    internals = fixture.componentInstance as unknown as ProfileInternals;
    fixture.detectChanges();
    await settle();
  });

  it('opens in view mode with the Edit action', () => {
    expect(internals.isEditMode()).toBe(false);
    expect(root().textContent).toContain('Alice Brown');
    expect(action('Edit')).not.toBeNull();
  });

  it('prefills edit mode from the profile and resolves the catalogs', () => {
    action('Edit').click();
    fixture.detectChanges();

    expect(internals.isEditMode()).toBe(true);
    expect(internals.form.getRawValue()).toMatchObject({
      firstName: 'Alice',
      lastName: 'Brown',
      middleName: 'Marie',
      specializationText: 'Cardiology',
      specializationId: 'spec-cardiology',
      officeText: 'Office A',
      officeId: 'office-1',
      careerStartYear: 2010,
      status: DoctorStatus.AtWork,
    });
    expect(root().querySelector('#email')).toBeNull();
    expect(root().querySelector('#photo-upload')).not.toBeNull();
    expect(root().querySelector<HTMLInputElement>('#office')?.getAttribute('role')).toBe('combobox');
  });

  it('loads the signed-in doctor through the own-profile endpoint', async () => {
    fixture.destroy();
    doctorsIdProfileGet.mockClear();
    routeId = null;
    fixture = TestBed.createComponent(ProfilePageComponent);
    internals = fixture.componentInstance as unknown as ProfileInternals;
    fixture.detectChanges();
    await settle();

    expect(doctorsMeGet).toHaveBeenCalledOnce();
    expect(doctorsIdProfileGet).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Alice Brown');
  });

  it('shows the missing-name error after blur in the rendered form', async () => {
    action('Edit').click();
    fixture.detectChanges();
    const firstName = root().querySelector<HTMLInputElement>('#first-name');
    if (!firstName) throw new Error('First name field was not rendered.');

    firstName.value = '';
    firstName.dispatchEvent(new Event('input', { bubbles: true }));
    firstName.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();

    expect(root().querySelector('#first-name-error')?.textContent).toContain(
      'Please, enter the first name'
    );
    expect(action('Save changes').disabled).toBe(true);
  });

  it('disables saving for an unknown office or a future date', () => {
    action('Edit').click();
    fixture.detectChanges();
    const { officeText, dateOfBirth } = internals.form.controls;
    officeText.setValue('Unknown office');
    officeText.markAsTouched();
    fixture.detectChanges();
    expect(action('Save changes').disabled).toBe(true);
    expect(root().textContent).toContain('Invalid office address');

    officeText.setValue('Office A');
    dateOfBirth.setValue('2999-01-01');
    dateOfBirth.markAsTouched();
    fixture.detectChanges();
    expect(action('Save changes').disabled).toBe(true);
    expect(root().textContent).toContain('Date of birth cannot be in the future');
  });

  it('uploads the selected photo and displays the saved document', async () => {
    action('Edit').click();
    fixture.detectChanges();
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    internals.form.controls.photo.setValue(file);
    upload.mockResolvedValue('saved-photo');
    await internals.save();
    fixture.detectChanges();

    expect(upload).toHaveBeenCalledExactlyOnceWith(file);
    expect(doctorsIdPut).toHaveBeenCalledWith({
      id: DOCTOR_ID,
      body: expect.objectContaining({ photoPath: 'saved-photo' }),
    });
    expect(root().querySelector('img')?.getAttribute('src')).toBe('/documents/saved-photo');
  });

  it('saves once with the complete body without email and returns to view mode', async () => {
    action('Edit').click();
    fixture.detectChanges();
    internals.form.controls.firstName.setValue('Alicia');
    fixture.detectChanges();

    action('Save changes').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(internals.isEditMode()).toBe(false);
    });

    expect(doctorsIdPut).toHaveBeenCalledOnce();

    const call = doctorsIdPut.mock.calls[0]?.[0] as {
      id: string;
      body: Record<string, unknown>;
    };

    expect(call.id).toBe(DOCTOR_ID);
    expect(call.body['firstName']).toBe('Alicia');
    expect(call.body['status']).toBe(DoctorStatus.AtWork);
    expect(Object.prototype.hasOwnProperty.call(call.body, 'email')).toBe(false);

    expect(internals.isEditMode()).toBe(false);
    expect(internals.profile()?.firstName).toBe('Alicia');
    expect(root().textContent).toContain('Alicia Brown');
    expect(showSuccess).toHaveBeenCalledWith('Profile updated successfully');
  });

  it('keeps edit mode and the entered data when saving fails', async () => {
    doctorsIdPut.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 500, error: { message: 'nope' } })
      )
    );

    action('Edit').click();
    fixture.detectChanges();
    internals.form.controls.firstName.setValue('Alicia');
    fixture.detectChanges();

    action('Save changes').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(internals.formError()).not.toBeNull();
    });

    expect(internals.isEditMode()).toBe(true);
    expect(internals.form.controls.firstName.value).toBe('Alicia');
    expect(internals.formError()).not.toBeNull();
    expect(root().textContent).toContain('Internal Server Error');
  });

  it('asks for confirmation on cancel and keeps the edits when the user declines', () => {
    open.mockReturnValue({ closed: of(false) });

    action('Edit').click();
    fixture.detectChanges();
    internals.form.controls.firstName.setValue('Alicia');
    fixture.detectChanges();

    action('Cancel').click();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith(
      CancelConfirmDialogComponent,
      expect.objectContaining({
        data: { message: CANCEL_EDIT_MESSAGE, confirmText: 'Yes', cancelText: 'No' },
        disableClose: true,
        restoreFocus: true,
      })
    );
    expect(internals.isEditMode()).toBe(true);
    expect(internals.form.controls.firstName.value).toBe('Alicia');
  });

  it('restores the stored profile and returns to view mode when the user confirms', () => {
    open.mockReturnValue({ closed: of(true) });

    action('Edit').click();
    fixture.detectChanges();
    internals.form.controls.firstName.setValue('Alicia');
    fixture.detectChanges();

    action('Cancel').click();
    fixture.detectChanges();

    expect(internals.isEditMode()).toBe(false);
    expect(root().textContent).toContain('Alice Brown');
    expect(root().textContent).not.toContain('Alicia Brown');
  });
});
