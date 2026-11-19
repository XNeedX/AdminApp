import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { WritableSignal, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReceptionistsService } from '../../../../api/generated/profiles/services/receptionists.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import {
  CANCEL_EDIT_DIALOG_MESSAGE,
  CONFIRM_NO_LABEL,
  CONFIRM_YES_LABEL,
} from '../../models/receptionist-dialog.model';
import { ReceptionistFormGroup } from '../../models/receptionist-form.model';
import { OfficeOption, ReceptionistProfile } from '../../models/receptionist.model';
import { ReceptionistCatalogStore } from '../../services/receptionist-catalog.store';
import { ReceptionistPhotoService } from '../../services/receptionist-photo.service';
import { ReceptionistProfilePageComponent } from './receptionist-profile-page.component';

const PROFILE: ReceptionistProfile = {
  id: 'r1',
  photoPath: null,
  firstName: 'Anna',
  lastName: 'Smith',
  middleName: 'Lee',
  officeAddress: 'Office A',
};

const OFFICES: readonly OfficeOption[] = [{ id: 'office-1', label: 'Office A' }];

interface PageInternals {
  readonly form: FormGroup<ReceptionistFormGroup>;
  readonly isEditMode: WritableSignal<boolean>;
  loadProfile(): Promise<void>;
  enterEdit(): void;
  save(): Promise<void>;
  cancelEdit(): void;
}

function envelope<T>(data: T): { isSuccess: boolean; data: T; message: null; errors: [] } {
  return { isSuccess: true, data, message: null, errors: [] };
}

describe('ReceptionistProfilePageComponent', () => {
  let fixture: ComponentFixture<ReceptionistProfilePageComponent>;
  let internals: PageInternals;

  const receptionistsIdGet = vi.fn();
  const receptionistsIdPut = vi.fn();
  const load = vi.fn(() => Promise.resolve());
  const upload = vi.fn(() => Promise.resolve('file-2'));
  const deletePhoto = vi.fn(() => Promise.resolve());
  const showSuccess = vi.fn();
  const showError = vi.fn();
  const navigate = vi.fn(() => Promise.resolve(true));
  const dialogOpen = vi.fn();

  beforeEach(async () => {
    receptionistsIdGet.mockReset();
    receptionistsIdPut.mockReset();
    load.mockClear();
    upload.mockClear();
    deletePhoto.mockClear();
    showSuccess.mockReset();
    showError.mockReset();
    navigate.mockClear();
    dialogOpen.mockReset();

    receptionistsIdGet.mockReturnValue(of(envelope(PROFILE)));

    await TestBed.configureTestingModule({
      imports: [ReceptionistProfilePageComponent],
      providers: [
        {
          provide: ReceptionistsService,
          useValue: { receptionistsIdGet, receptionistsIdPut },
        },
        {
          provide: ReceptionistCatalogStore,
          useValue: { offices: signal(OFFICES), load },
        },
        {
          provide: ReceptionistPhotoService,
          useValue: { upload, delete: deletePhoto },
        },
        { provide: NotificationService, useValue: { showSuccess, showError } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'r1' } } },
        },
        { provide: Router, useValue: { navigate } },
        { provide: Dialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceptionistProfilePageComponent);
    internals = fixture.componentInstance as unknown as PageInternals;
    fixture.detectChanges();
    await fixture.whenStable();
    TestBed.tick();
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement {
    const element = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => candidate.textContent?.trim() === label);

    if (element === undefined) {
      throw new Error(`Button "${label}" was not rendered.`);
    }

    return element;
  }

  it('loads the profile and renders it read-only', () => {
    expect(receptionistsIdGet).toHaveBeenCalledWith({ id: 'r1' });
    expect(text()).toContain('Anna');
    expect(text()).toContain('Smith');
    expect(text()).toContain('Office A');
    expect(button('Edit')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
  });

  it('shows "Receptionist not found." on 404 and navigates back', async () => {
    receptionistsIdGet.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    await internals.loadProfile();
    fixture.detectChanges();

    expect(text()).toContain('Receptionist not found.');

    button('Back to Receptionists').click();

    expect(navigate).toHaveBeenCalledWith(['/receptionists']);
  });

  it('shows a retryable error when the envelope fails', async () => {
    receptionistsIdGet.mockReturnValue(
      of({ isSuccess: false, data: null, message: 'Database unavailable', errors: [] }),
    );

    await internals.loadProfile();
    fixture.detectChanges();

    expect(text()).toContain('Database unavailable');
    expect(button('Try again')).not.toBeNull();
  });

  it('pre-fills the form and hides the email field in edit mode', () => {
    internals.enterEdit();
    TestBed.tick();
    fixture.detectChanges();

    expect(internals.isEditMode()).toBe(true);
    expect(button('Save changes')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#receptionist-email')).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        '#receptionist-first-name',
      )?.value,
    ).toBe('Anna');
  });

  it('disables Save changes when a required field is empty', () => {
    internals.enterEdit();
    internals.form.controls.firstName.setValue('');
    internals.form.controls.firstName.markAsTouched();
    TestBed.tick();
    fixture.detectChanges();

    expect(button('Save changes').disabled).toBe(true);
    expect(text()).toContain('Please, enter the first name');
  });

  it('saves without an email property and returns to View mode', async () => {
    receptionistsIdPut.mockReturnValue(
      of({ isSuccess: true, data: null, message: null, errors: [] }),
    );
    internals.enterEdit();
    internals.form.controls.firstName.setValue('  Anna ');
    TestBed.tick();

    await internals.save();
    TestBed.tick();
    fixture.detectChanges();

    expect(receptionistsIdPut).toHaveBeenCalledOnce();
    expect(receptionistsIdPut).toHaveBeenCalledWith({
      id: 'r1',
      body: {
        photoPath: null,
        firstName: 'Anna',
        lastName: 'Smith',
        middleName: 'Lee',
        officeAddress: 'Office A',
      },
    });
    expect(internals.isEditMode()).toBe(false);
    expect(showSuccess).toHaveBeenCalledWith('Receptionist updated.');
  });

  it('stays in Edit mode and keeps values when the save fails', async () => {
    receptionistsIdPut.mockReturnValue(
      of({ isSuccess: false, data: null, message: 'Save failed', errors: [] }),
    );
    internals.enterEdit();
    TestBed.tick();

    await internals.save();
    fixture.detectChanges();

    expect(internals.isEditMode()).toBe(true);
    expect(internals.form.controls.firstName.value).toBe('Anna');
    expect(showError).toHaveBeenCalled();
  });

  it('keeps Edit mode and the values when the cancel confirmation is declined', () => {
    dialogOpen.mockReturnValue({ closed: of(false) });
    internals.enterEdit();
    TestBed.tick();

    internals.cancelEdit();
    TestBed.tick();

    expect(dialogOpen).toHaveBeenCalledWith(CancelConfirmDialogComponent, {
      data: {
        message: CANCEL_EDIT_DIALOG_MESSAGE,
        confirmText: CONFIRM_YES_LABEL,
        cancelText: CONFIRM_NO_LABEL,
      },
      disableClose: true,
      ariaLabelledBy: 'cancel-confirm-dialog-message',
      restoreFocus: true,
    });
    expect(internals.isEditMode()).toBe(true);
  });

  it('returns to View mode and resets the form when the cancel confirmation is accepted', () => {
    dialogOpen.mockReturnValue({ closed: of(true) });
    internals.enterEdit();
    internals.form.controls.firstName.setValue('Changed');
    TestBed.tick();

    internals.cancelEdit();
    TestBed.tick();

    expect(internals.isEditMode()).toBe(false);
    expect(internals.form.controls.firstName.value).toBe('Anna');
  });
});
