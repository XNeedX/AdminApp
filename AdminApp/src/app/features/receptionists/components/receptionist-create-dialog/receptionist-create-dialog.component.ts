import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom, startWith } from 'rxjs';

import { readApiEnvelope } from '../../../../api/api-envelope';
import { ReceptionistsService } from '../../../../api/generated/profiles/services/receptionists.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import {
  CANCEL_CREATE_DIALOG_MESSAGE,
  CONFIRM_NO_LABEL,
  CONFIRM_YES_LABEL,
  ReceptionistCreateDialogResult,
} from '../../models/receptionist-dialog.model';
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  ReceptionistFormGroup,
} from '../../models/receptionist-form.model';
import { OfficeOption } from '../../models/receptionist.model';
import { isProfileId } from '../../services/receptionist-contract.guards';
import { ReceptionistCatalogStore } from '../../services/receptionist-catalog.store';
import { ReceptionistDirectoryStore } from '../../services/receptionist-directory.store';
import { toCreateReceptionistRequest } from '../../services/receptionist-form.mapper';
import { ReceptionistPhotoService } from '../../services/receptionist-photo.service';
import { fullName } from '../../utils/receptionist-presentation';
import { validatePhotoFile } from '../../utils/photo-file.validator';
import { ReceptionistFormComponent } from '../receptionist-form/receptionist-form.component';

/**
 * Smart host for `ReceptionistFormComponent` in create mode, opened through CDK
 * `Dialog`. Owns the form, the office catalog, the photo upload and the POST.
 */
@Component({
  selector: 'app-receptionist-create-dialog',
  standalone: true,
  imports: [ReceptionistFormComponent],
  templateUrl: './receptionist-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionistCreateDialogComponent implements OnInit {
  private readonly dialogRef = inject<DialogRef<ReceptionistCreateDialogResult>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly catalogs = inject(ReceptionistCatalogStore);
  private readonly directory = inject(ReceptionistDirectoryStore);
  private readonly receptionists = inject(ReceptionistsService);
  private readonly photos = inject(ReceptionistPhotoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEditMode = false;
  protected readonly form = this.buildForm();
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly photoPreview = signal<string | null>(null);

  protected readonly offices = this.catalogs.offices;

  private readonly selectedPhoto = signal<File | null>(null);
  private objectUrl: string | null = null;

  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status },
  );

  protected readonly canSubmit = computed<boolean>(
    () =>
      this.formStatus() === 'VALID' &&
      !this.isSubmitting() &&
      this.photoError() === null &&
      this.offices().length > 0,
  );

  protected readonly formError = computed<string | null>(
    () => this.serverError() ?? this.catalogs.loadError(),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeObjectUrl());
  }

  ngOnInit(): void {
    void this.catalogs.load();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.serverError.set(null);

    let uploadedPhotoPath: string | null = null;

    try {
      const file = this.selectedPhoto();

      if (file !== null) {
        uploadedPhotoPath = await this.photos.upload(file);
      }

      const value = this.form.getRawValue();
      const payload = await firstValueFrom(
        this.receptionists.receptionistsPost({
          body: toCreateReceptionistRequest(value, uploadedPhotoPath),
        }),
      );
      const id = readApiEnvelope(payload, isProfileId);

      this.dialogRef.close({
        created: {
          id,
          fullName: fullName({
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            middleName: value.middleName,
          }),
          officeAddress: value.officeText.trim(),
        },
      });
    } catch (error: unknown) {
      if (uploadedPhotoPath !== null) {
        void this.photos.delete(uploadedPhotoPath).catch(() => undefined);
      }

      // A 500 can mean the profile was created but the credentials email failed, so
      // refresh the directory without closing the form to reveal a possible profile.
      if (error instanceof HttpErrorResponse && error.status >= 500) {
        void this.directory.loadAll();
      }

      this.applyDuplicateEmail(error);
      this.serverError.set(this.toErrorMessage(error));
      this.isSubmitting.set(false);
    }
  }

  protected cancel(): void {
    const ref = this.dialog.open<boolean, CancelConfirmDialogData>(CancelConfirmDialogComponent, {
      data: {
        message: CANCEL_CREATE_DIALOG_MESSAGE,
        confirmText: CONFIRM_YES_LABEL,
        cancelText: CONFIRM_NO_LABEL,
      },
      disableClose: true,
      ariaLabelledBy: 'cancel-confirm-dialog-message',
      restoreFocus: true,
    });

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed === true) {
        this.dialogRef.close({ created: null });
      }
    });
  }

  protected onPhotoSelected(file: File): void {
    this.revokeObjectUrl();

    const error = validatePhotoFile(file);

    if (error !== null) {
      this.selectedPhoto.set(null);
      this.photoPreview.set(null);
      this.photoError.set(error);
      this.form.controls.photo.setValue(null);
      return;
    }

    this.objectUrl = URL.createObjectURL(file);
    this.selectedPhoto.set(file);
    this.photoPreview.set(this.objectUrl);
    this.photoError.set(null);
    this.form.controls.photo.setValue(file);
  }

  protected onPhotoCleared(): void {
    this.revokeObjectUrl();
    this.selectedPhoto.set(null);
    this.photoPreview.set(null);
    this.photoError.set(null);
    this.form.controls.photo.setValue(null);
  }

  protected onOfficeSelected(option: OfficeOption | null): void {
    this.form.controls.officeId.setValue(option?.id ?? '');
    this.form.controls.officeText.setValue(option?.label ?? '');
  }

  private buildForm() {
    return this.fb.group<ReceptionistFormGroup>({
      photo: this.fb.control<File | null>(null),
      firstName: this.fb.control<string>('', [
        Validators.required,
        nonBlankValidator,
        Validators.maxLength(MAX_NAME_LENGTH),
      ]),
      lastName: this.fb.control<string>('', [
        Validators.required,
        nonBlankValidator,
        Validators.maxLength(MAX_NAME_LENGTH),
      ]),
      middleName: this.fb.control<string | null>(null, [Validators.maxLength(MAX_NAME_LENGTH)]),
      email: this.fb.control<string>('', [
        Validators.required,
        Validators.email,
        Validators.maxLength(MAX_EMAIL_LENGTH),
      ]),
      officeText: this.fb.control<string>('', [Validators.required]),
      officeId: this.fb.control<string>('', [Validators.required]),
    });
  }

  private applyDuplicateEmail(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
      return;
    }

    const control = this.form.controls.email;
    control.setErrors({ ...(control.errors ?? {}), emailTaken: true });
    control.markAsTouched();
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'The receptionist could not be created. Please try again.';
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
