import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { FormGroup } from '@angular/forms';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DoctorsService } from '../../../../api/generated/profiles/services/doctors.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import {
  CANCEL_CREATE_MESSAGE,
  DoctorFormGroup,
  DoctorStatus,
} from '../../models/doctor-form.model';
import { DoctorCatalogStore } from '../../services/doctor-catalog.store';
import { DoctorCreateDialogComponent } from './doctor-create-dialog.component';

const SPECIALIZATIONS: readonly AutocompleteOption[] = [
  { id: 'spec-cardiology', label: 'Cardiology' },
];

const OFFICES: readonly AutocompleteOption[] = [
  { id: 'office-1', label: '1st floor, room 101' },
];

interface DialogInternals {
  readonly form: FormGroup<DoctorFormGroup>;
  submit(): Promise<void>;
  cancel(): void;
}

describe('DoctorCreateDialogComponent', () => {
  let fixture: ComponentFixture<DoctorCreateDialogComponent>;
  let component: DoctorCreateDialogComponent;
  let internals: DialogInternals;

  const doctorsPost = vi.fn();
  const close = vi.fn();
  const open = vi.fn();
  const loadCatalogs = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    doctorsPost.mockReset();
    close.mockReset();
    open.mockReset();
    loadCatalogs.mockClear();

    await TestBed.configureTestingModule({
      imports: [DoctorCreateDialogComponent],
      providers: [
        { provide: DoctorsService, useValue: { doctorsPost } },
        { provide: DialogRef, useValue: { close } },
        { provide: Dialog, useValue: { open } },
        {
          provide: DoctorCatalogStore,
          useValue: {
            specializations: signal(SPECIALIZATIONS),
            offices: signal(OFFICES),
            error: signal<string | null>(null),
            load: loadCatalogs,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorCreateDialogComponent);
    component = fixture.componentInstance;
    internals = component as unknown as DialogInternals;
    fixture.detectChanges();
  });

  function fillValidForm(): void {
    internals.form.setValue({
      photo: null,
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      dateOfBirth: '1980-05-17',
      email: 'john@hospital.org',
      specializationText: 'Cardiology',
      specializationId: 'spec-cardiology',
      officeText: '1st floor, room 101',
      officeId: 'office-1',
      careerStartYear: 2010,
      status: DoctorStatus.AtWork,
    });
    internals.form.markAsDirty();
  }

  it('posts the mapped body once and closes with the created summary', async () => {
    doctorsPost.mockReturnValue(of({ isSuccess: true, data: 'doctor-1' }));
    fillValidForm();

    await internals.submit();

    expect(doctorsPost).toHaveBeenCalledOnce();
    expect(doctorsPost).toHaveBeenCalledWith({
      body: expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@hospital.org',
        specialization: 'Cardiology',
        officeAddress: '1st floor, room 101',
        careerStartYear: 2010,
        status: DoctorStatus.AtWork,
        photoPath: null,
      }),
    });
    expect(close).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith({
      created: { id: 'doctor-1', fullName: 'John Doe' },
    });
  });

  it('ignores a second submit while the request is in flight', async () => {
    doctorsPost.mockReturnValue(new Subject());
    fillValidForm();

    void internals.submit();
    await internals.submit();

    expect(doctorsPost).toHaveBeenCalledOnce();
  });

  it('keeps the dialog open and flags the email on a 409', async () => {
    doctorsPost.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'User with this email already exists' },
          })
      )
    );
    fillValidForm();

    await internals.submit();

    expect(close).not.toHaveBeenCalled();
    expect(internals.form.controls.email.hasError('emailTaken')).toBe(true);
    expect(internals.form.controls.firstName.value).toBe('John');
  });

  it('closes an untouched form without asking for confirmation', () => {
    internals.cancel();

    expect(open).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith({ created: null });
  });

  it('asks before discarding a dirty form and keeps it when the user declines', () => {
    open.mockReturnValue({ closed: of(false) });
    fillValidForm();

    internals.cancel();

    expect(open).toHaveBeenCalledWith(
      CancelConfirmDialogComponent,
      expect.objectContaining({
        data: { message: CANCEL_CREATE_MESSAGE, confirmText: 'Yes', cancelText: 'No' },
        disableClose: true,
        restoreFocus: true,
      })
    );
    expect(close).not.toHaveBeenCalled();
    expect(internals.form.controls.firstName.value).toBe('John');
  });

  it('closes without saving when the user confirms the cancellation', () => {
    open.mockReturnValue({ closed: of(true) });
    fillValidForm();

    internals.cancel();

    expect(close).toHaveBeenCalledWith({ created: null });
  });
});
