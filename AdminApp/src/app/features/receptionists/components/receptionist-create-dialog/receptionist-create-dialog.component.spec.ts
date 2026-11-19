import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { FormGroup } from '@angular/forms';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReceptionistsService } from '../../../../api/generated/profiles/services/receptionists.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import {
  CANCEL_CREATE_DIALOG_MESSAGE,
  CONFIRM_NO_LABEL,
  CONFIRM_YES_LABEL,
} from '../../models/receptionist-dialog.model';
import { ReceptionistFormGroup } from '../../models/receptionist-form.model';
import { OfficeOption } from '../../models/receptionist.model';
import { ReceptionistCatalogStore } from '../../services/receptionist-catalog.store';
import { ReceptionistDirectoryStore } from '../../services/receptionist-directory.store';
import { ReceptionistPhotoService } from '../../services/receptionist-photo.service';
import { ReceptionistCreateDialogComponent } from './receptionist-create-dialog.component';

const OFFICES: readonly OfficeOption[] = [{ id: 'office-1', label: 'Office A' }];

interface DialogInternals {
  readonly form: FormGroup<ReceptionistFormGroup>;
  readonly isSubmitting: () => boolean;
  readonly serverError: () => string | null;
  readonly canSubmit: () => boolean;
  submit(): Promise<void>;
  cancel(): void;
  onPhotoSelected(file: File): void;
}

describe('ReceptionistCreateDialogComponent', () => {
  let fixture: ComponentFixture<ReceptionistCreateDialogComponent>;
  let internals: DialogInternals;

  const receptionistsPost = vi.fn();
  const close = vi.fn();
  const open = vi.fn();
  const load = vi.fn(() => Promise.resolve());
  const reloadDirectory = vi.fn(() => Promise.resolve());
  const upload = vi.fn(() => Promise.resolve('file-1'));
  const deletePhoto = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    receptionistsPost.mockReset();
    close.mockReset();
    open.mockReset();
    load.mockClear();
    reloadDirectory.mockClear();
    upload.mockClear();
    deletePhoto.mockClear();

    await TestBed.configureTestingModule({
      imports: [ReceptionistCreateDialogComponent],
      providers: [
        { provide: ReceptionistsService, useValue: { receptionistsPost } },
        { provide: DialogRef, useValue: { close } },
        { provide: Dialog, useValue: { open } },
        {
          provide: ReceptionistCatalogStore,
          useValue: {
            offices: signal(OFFICES),
            loadError: signal<string | null>(null),
            load,
          },
        },
        {
          provide: ReceptionistDirectoryStore,
          useValue: { loadAll: reloadDirectory },
        },
        {
          provide: ReceptionistPhotoService,
          useValue: { upload, delete: deletePhoto },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceptionistCreateDialogComponent);
    internals = fixture.componentInstance as unknown as DialogInternals;
    fixture.detectChanges();
  });

  function fillValidForm(): void {
    internals.form.setValue({
      photo: null,
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      email: 'john@clinic.org',
      officeText: 'Office A',
      officeId: 'office-1',
    });
    internals.form.markAsDirty();
  }

  it('loads the office catalog on init', () => {
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps Confirm disabled while the form is empty', () => {
    expect(internals.canSubmit()).toBe(false);
  });

  it('posts the mapped body once and closes with the created summary', async () => {
    receptionistsPost.mockReturnValue(of({ isSuccess: true, data: 'r1' }));
    fillValidForm();

    await internals.submit();

    expect(receptionistsPost).toHaveBeenCalledOnce();
    expect(receptionistsPost).toHaveBeenCalledWith({
      body: {
        photoPath: null,
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        email: 'john@clinic.org',
        officeAddress: 'Office A',
      },
    });
    expect(close).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith({
      created: { id: 'r1', fullName: 'John Doe', officeAddress: 'Office A' },
    });
  });

  it('uploads the selected photo before the POST', async () => {
    receptionistsPost.mockReturnValue(of({ isSuccess: true, data: 'r1' }));
    fillValidForm();
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    internals.onPhotoSelected(file);

    await internals.submit();

    expect(upload).toHaveBeenCalledWith(file);
    expect(receptionistsPost).toHaveBeenCalledWith({
      body: expect.objectContaining({ photoPath: 'file-1' }),
    });
  });

  it('maps HTTP 409 to the emailTaken control error and keeps the values', async () => {
    receptionistsPost.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'User with this email already exists.' },
          }),
      ),
    );
    fillValidForm();

    await internals.submit();

    expect(internals.form.controls.email.hasError('emailTaken')).toBe(true);
    expect(internals.form.controls.firstName.value).toBe('John');
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps the form values and reports the server error on failure', async () => {
    receptionistsPost.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { message: 'Boom' },
          }),
      ),
    );
    fillValidForm();

    await internals.submit();

    expect(internals.serverError()).not.toBeNull();
    expect(internals.form.controls.email.value).toBe('john@clinic.org');
    expect(close).not.toHaveBeenCalled();
    expect(reloadDirectory).toHaveBeenCalledOnce();
  });

  it('ignores a second submit while the request is in flight', async () => {
    const pending = new Subject<unknown>();
    receptionistsPost.mockReturnValue(pending.asObservable());
    fillValidForm();

    const first = internals.submit();
    await internals.submit();

    expect(receptionistsPost).toHaveBeenCalledOnce();
    expect(internals.isSubmitting()).toBe(true);

    pending.next({ isSuccess: true, data: 'r1' });
    pending.complete();

    expect(await first).toBeUndefined();
    expect(close).toHaveBeenCalledWith({
      created: { id: 'r1', fullName: 'John Doe', officeAddress: 'Office A' },
    });
  });

  it('opens the cancel confirmation with the exact copy and closes on Yes', () => {
    open.mockReturnValue({ closed: of(true) });

    internals.cancel();

    expect(open).toHaveBeenCalledWith(CancelConfirmDialogComponent, {
      data: {
        message: CANCEL_CREATE_DIALOG_MESSAGE,
        confirmText: CONFIRM_YES_LABEL,
        cancelText: CONFIRM_NO_LABEL,
      },
      disableClose: true,
      ariaLabelledBy: 'cancel-confirm-dialog-message',
      restoreFocus: true,
    });
    expect(close).toHaveBeenCalledWith({ created: null });
  });

  it('stays open when the cancel confirmation is declined', () => {
    open.mockReturnValue({ closed: of(false) });

    internals.cancel();

    expect(close).not.toHaveBeenCalled();
  });
});
