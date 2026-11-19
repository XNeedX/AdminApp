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
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom, startWith } from 'rxjs';

import { readApiAcknowledgment, readApiEnvelope } from '../../../../api/api-envelope';
import { ReceptionistsService } from '../../../../api/generated/profiles/services/receptionists.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { ReceptionistFormComponent } from '../../components/receptionist-form/receptionist-form.component';
import { ReceptionistProfileViewComponent } from '../../components/receptionist-profile-view/receptionist-profile-view.component';
import {
  CANCEL_EDIT_DIALOG_MESSAGE,
  CONFIRM_NO_LABEL,
  CONFIRM_YES_LABEL,
} from '../../models/receptionist-dialog.model';
import { MAX_NAME_LENGTH, ReceptionistFormGroup } from '../../models/receptionist-form.model';
import { OfficeOption, ReceptionistProfile } from '../../models/receptionist.model';
import { isReceptionistProfile } from '../../services/receptionist-contract.guards';
import { ReceptionistCatalogStore } from '../../services/receptionist-catalog.store';
import { toUpdateReceptionistDto } from '../../services/receptionist-form.mapper';
import { ReceptionistPhotoService } from '../../services/receptionist-photo.service';
import { photoUrl } from '../../utils/receptionist-presentation';
import { validatePhotoFile } from '../../utils/photo-file.validator';

const NOT_FOUND_MESSAGE = 'Receptionist not found.';

/**
 * Smart receptionist profile page.
 *
 * Owns the loaded profile, the View/Edit mode signal, photo selection, saving,
 * the cancel confirmation and notifications. The form stays dumb and is reused
 * from the create dialog.
 */
@Component({
  selector: 'app-receptionist-profile-page',
  standalone: true,
  imports: [ReceptionistProfileViewComponent, ReceptionistFormComponent],
  templateUrl: './receptionist-profile-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionistProfilePageComponent implements OnInit {
  private readonly receptionists = inject(ReceptionistsService);
  private readonly catalogs = inject(ReceptionistCatalogStore);
  private readonly photos = inject(ReceptionistPhotoService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly profile = signal<ReceptionistProfile | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly photoPreview = signal<string | null>(null);

  protected readonly offices = this.catalogs.offices;

  protected readonly form = this.buildForm();

  private readonly selectedPhoto = signal<File | null>(null);
  private readonly photoRemoved = signal<boolean>(false);
  private objectUrl: string | null = null;

  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status },
  );

  protected readonly canSubmit = computed<boolean>(
    () =>
      this.formStatus() === 'VALID' &&
      !this.isSaving() &&
      this.photoError() === null &&
      this.offices().length > 0,
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeObjectUrl());
  }

  ngOnInit(): void {
    void this.catalogs.load();
    void this.loadProfile();
  }

  protected async loadProfile(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')?.trim() ?? '';

    if (id.length === 0) {
      this.loadError.set(NOT_FOUND_MESSAGE);
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const payload = await firstValueFrom(this.receptionists.receptionistsIdGet({ id }));
      const profile = readApiEnvelope(payload, isReceptionistProfile);

      this.profile.set(profile);
      this.resetForm(profile);
    } catch (error: unknown) {
      this.loadError.set(this.toLoadError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  protected enterEdit(): void {
    const profile = this.profile();

    if (profile === null) {
      return;
    }

    this.resetForm(profile);
    this.isEditMode.set(true);
  }

  protected cancelEdit(): void {
    const ref = this.dialog.open<boolean, CancelConfirmDialogData>(CancelConfirmDialogComponent, {
      data: {
        message: CANCEL_EDIT_DIALOG_MESSAGE,
        confirmText: CONFIRM_YES_LABEL,
        cancelText: CONFIRM_NO_LABEL,
      },
      disableClose: true,
      ariaLabelledBy: 'cancel-confirm-dialog-message',
      restoreFocus: true,
    });

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed !== true) {
        return;
      }

      const profile = this.profile();

      if (profile !== null) {
        this.resetForm(profile);
      }

      this.isEditMode.set(false);
    });
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();

    const current = this.profile();

    if (current === null || this.form.invalid || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.formError.set(null);

    const previousPhotoPath = current.photoPath;
    let nextPhotoPath = previousPhotoPath;
    let uploadedPhotoPath: string | null = null;

    try {
      const file = this.selectedPhoto();

      if (file !== null) {
        uploadedPhotoPath = await this.photos.upload(file);
        nextPhotoPath = uploadedPhotoPath;
      } else if (this.photoRemoved()) {
        nextPhotoPath = null;
      }

      const value = this.form.getRawValue();
      const payload = await firstValueFrom(
        this.receptionists.receptionistsIdPut({
          id: current.id,
          body: toUpdateReceptionistDto(value, nextPhotoPath),
        }),
      );
      readApiAcknowledgment(payload);

      this.profile.set({
        id: current.id,
        photoPath: nextPhotoPath,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        middleName: value.middleName?.trim() || null,
        officeAddress: value.officeText.trim(),
      });

      this.revokeObjectUrl();
      this.selectedPhoto.set(null);
      this.photoRemoved.set(false);
      this.photoPreview.set(photoUrl(nextPhotoPath));
      this.isEditMode.set(false);
      this.notifications.showSuccess('Receptionist updated.');

      if (previousPhotoPath !== null && previousPhotoPath !== nextPhotoPath) {
        void this.photos.delete(previousPhotoPath).catch(() => undefined);
      }
    } catch (error: unknown) {
      if (uploadedPhotoPath !== null && uploadedPhotoPath !== current.photoPath) {
        void this.photos.delete(uploadedPhotoPath).catch(() => undefined);
      }

      const message = this.toErrorMessage(error);
      this.formError.set(message);
      this.notifications.showError(message);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected onPhotoSelected(file: File): void {
    const error = validatePhotoFile(file);

    if (error !== null) {
      this.selectedPhoto.set(null);
      this.photoError.set(error);
      return;
    }

    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.selectedPhoto.set(file);
    this.photoRemoved.set(false);
    this.photoPreview.set(this.objectUrl);
    this.photoError.set(null);
    this.form.controls.photo.setValue(file);
  }

  protected onPhotoCleared(): void {
    this.revokeObjectUrl();
    this.selectedPhoto.set(null);
    this.photoRemoved.set(true);
    this.photoPreview.set(null);
    this.photoError.set(null);
    this.form.controls.photo.setValue(null);
  }

  protected onOfficeSelected(option: OfficeOption | null): void {
    this.form.controls.officeId.setValue(option?.id ?? '');
    this.form.controls.officeText.setValue(option?.label ?? '');
  }

  protected backToList(): void {
    void this.router.navigate(['/receptionists']);
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
      // Email is create-only: the profile DTO does not return it and the field is hidden.
      email: this.fb.control<string>(''),
      officeText: this.fb.control<string>('', [Validators.required]),
      officeId: this.fb.control<string>('', [Validators.required]),
    });
  }

  private resetForm(profile: ReceptionistProfile): void {
    const office = this.findOffice(profile.officeAddress);

    this.form.reset({
      photo: null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      middleName: profile.middleName,
      email: '',
      officeText: profile.officeAddress,
      officeId: office?.id ?? '',
    });

    this.revokeObjectUrl();
    this.selectedPhoto.set(null);
    this.photoRemoved.set(false);
    this.photoError.set(null);
    this.formError.set(null);
    this.photoPreview.set(photoUrl(profile.photoPath));
  }

  private findOffice(address: string): OfficeOption | null {
    const normalized = address.trim().toLowerCase();

    return (
      this.offices().find((office) => office.label.trim().toLowerCase() === normalized) ?? null
    );
  }

  private toLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return NOT_FOUND_MESSAGE;
    }

    return this.toErrorMessage(error);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'The receptionist could not be saved. Please try again.';
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
