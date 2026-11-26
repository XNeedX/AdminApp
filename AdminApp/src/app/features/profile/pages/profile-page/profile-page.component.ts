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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom, startWith } from 'rxjs';

import { readApiAcknowledgment, readApiEnvelope } from '../../../../api/api-envelope';
import { UpdateDoctorDto } from '../../../../api/generated/profiles/models/update-doctor-dto';
import { DoctorsService } from '../../../../api/generated/profiles/services/doctors.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import { catalogMatchValidator } from '../../../../core/validators/catalog-match.validator';
import { maxYearValidator } from '../../../../core/validators/max-date.validator';
import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import { DoctorFormComponent } from '../../../doctors/components/doctor-form/doctor-form.component';
import {
  CANCEL_EDIT_MESSAGE,
  DEFAULT_DOCTOR_STATUS,
  DoctorFormGroup,
  DoctorFormMode,
  currentDoctorProfileDate,
  isDoctorStatus,
} from '../../../doctors/models/doctor-form.model';
import { isDoctorDetails } from '../../../doctors/services/doctor-contract.guards';
import { DoctorCatalogStore } from '../../../doctors/services/doctor-catalog.store';
import { toUpdateDoctorDto } from '../../../doctors/services/doctor-form.mapper';
import { ReceptionistPhotoService } from '../../../receptionists/services/receptionist-photo.service';
import { validatePhotoFile } from '../../../receptionists/utils/photo-file.validator';
import { ProfileViewComponent } from '../../components/profile-view/profile-view.component';
import {
  DoctorProfile,
  applyProfileChanges,
  findOptionByLabel,
  toDoctorFormValue,
} from '../../models/profile.model';

const NOT_LINKED_MESSAGE =
  'Your doctor profile is not linked to this account yet. Ask a receptionist to create or link it.';

function isStaffDoctorProfile(data: unknown): data is DoctorProfile {
  return isDoctorDetails(data) &&
    (data.photoPath == null || typeof data.photoPath === 'string') &&
    (data.middleName == null || typeof data.middleName === 'string') &&
    'id' in data && typeof data.id === 'string' &&
    'status' in data && typeof data.status === 'string' && isDoctorStatus(data.status);
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterLink, ProfileViewComponent, DoctorFormComponent],
  templateUrl: './profile-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private readonly doctors = inject(DoctorsService);
  private readonly catalogs = inject(DoctorCatalogStore);
  private readonly photos = inject(ReceptionistPhotoService);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly profile = signal<DoctorProfile | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);
  protected readonly editPhotoUrl = signal<string | null>(null);
  protected readonly photoUrl = computed(() => {
    const path = this.profile()?.photoPath ?? null;
    return path && /^https?:\/\//i.test(path) ? path : this.photos.url(path);
  });
  protected readonly isReceptionistRoute = signal<boolean>(false);

  protected readonly mode: DoctorFormMode = 'edit';
  protected readonly form = this.buildForm();
  protected readonly specializations = computed(() =>
    withCurrentOption(this.catalogs.specializations(), this.profile()?.specialization)
  );
  protected readonly offices = computed(() =>
    withCurrentOption(this.catalogs.offices(), this.profile()?.officeAddress)
  );

  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status }
  );

  protected readonly canSubmit = computed<boolean>(
    () => this.formStatus() === 'VALID' && !this.isSaving() && this.photoError() === null
  );

  private doctorId: string | null = null;
  private photoObjectUrl: string | null = null;
  private removePhoto = false;
  private uploadedPhoto: { file: File; id: string } | null = null;
  private cancelDialogOpen = false;

  constructor() {
    const { specializationText, specializationId, officeText, officeId } = this.form.controls;
    specializationText.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      specializationId.setValue(findOptionByLabel(this.specializations(), value)?.id ?? '', { emitEvent: false });
    });
    officeText.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      officeId.setValue(findOptionByLabel(this.offices(), value)?.id ?? '', { emitEvent: false });
    });
    this.destroyRef.onDestroy(() => this.revokePhotoPreview());
  }

  ngOnInit(): void {
    this.doctorId = this.route.snapshot.paramMap.get('id');
    this.isReceptionistRoute.set(this.doctorId !== null);
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  protected enterEditMode(): void {
    if (this.profile() === null) {
      return;
    }

    this.resetForm();
    this.formError.set(null);
    this.isEditMode.set(true);
  }

  protected cancelEdit(): void {
    if (this.cancelDialogOpen || this.isSaving()) return;
    this.cancelDialogOpen = true;
    const ref = this.dialog.open<boolean, CancelConfirmDialogData>(
      CancelConfirmDialogComponent,
      {
        data: { message: CANCEL_EDIT_MESSAGE, confirmText: 'Yes', cancelText: 'No' },
        disableClose: true,
        ariaLabelledBy: 'cancel-confirm-dialog-message',
        restoreFocus: true,
      }
    );

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      this.cancelDialogOpen = false;
      if (confirmed !== true) {
        return;
      }

      this.resetForm();
      this.formError.set(null);
      this.isEditMode.set(false);
    });
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();

    const profile = this.profile();

    if (!this.canSubmit() || this.form.invalid || profile === null) {
      return;
    }

    this.isSaving.set(true);
    this.formError.set(null);

    try {
      const value = this.form.getRawValue();
      const photoPath = await this.photoPathForSave(value.photo, profile.photoPath);
      const selected = {
        ...value,
        specializationText: findOptionByLabel(this.specializations(), value.specializationText)?.label
          ?? value.specializationText,
        officeText: findOptionByLabel(this.offices(), value.officeText)?.label ?? value.officeText,
      };
      const body: UpdateDoctorDto = toUpdateDoctorDto(selected, photoPath);
      const acknowledgment = await firstValueFrom(
        this.doctors.doctorsIdPut({ id: profile.id, body })
      );
      readApiAcknowledgment(acknowledgment);

      this.profile.set(applyProfileChanges(profile, selected, photoPath));
      this.resetForm();
      this.isEditMode.set(false);
      this.notifications.showSuccess('Profile updated successfully');
    } catch (error: unknown) {
      this.formError.set(this.toErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  protected onPhotoSelected(file: File): void {
    const error = validatePhotoFile(file);
    this.photoError.set(error);
    if (error !== null) return;

    this.revokePhotoPreview();
    this.removePhoto = false;
    this.photoObjectUrl = URL.createObjectURL(file);
    this.editPhotoUrl.set(this.photoObjectUrl);
    this.form.controls.photo.setValue(file);
  }

  protected onPhotoRemoved(): void {
    this.revokePhotoPreview();
    this.removePhoto = true;
    this.form.controls.photo.setValue(null);
    this.editPhotoUrl.set(null);
    this.photoError.set(null);
  }

  private async photoPathForSave(file: File | null, currentPath: string | null): Promise<string | null> {
    if (file === null) return this.removePhoto ? null : currentPath;
    if (this.uploadedPhoto?.file === file) return this.uploadedPhoto.id;

    const id = await this.photos.upload(file);
    this.uploadedPhoto = { file, id };
    return id;
  }

  private revokePhotoPreview(): void {
    if (this.photoObjectUrl !== null) {
      URL.revokeObjectURL(this.photoObjectUrl);
      this.photoObjectUrl = null;
    }
  }

  protected onSpecializationSelected(option: AutocompleteOption): void {
    this.form.controls.specializationId.setValue(option.id);
    this.form.controls.specializationText.setValue(option.label);
  }

  protected onOfficeSelected(option: AutocompleteOption): void {
    this.form.controls.officeId.setValue(option.id);
    this.form.controls.officeText.setValue(option.label);
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.formError.set(null);

    try {
      const response = this.doctorId === null
        ? this.doctors.doctorsMeGet$Json()
        : this.doctors.doctorsIdProfileGet$Json({ id: this.doctorId });
      const details = readApiEnvelope(await firstValueFrom(response), isStaffDoctorProfile);

      await this.catalogs.load();
      this.profile.set({
        ...details,
        photoPath: details.photoPath ?? null,
        middleName: details.middleName ?? null,
        dateOfBirth: details.dateOfBirth.slice(0, 10),
      });
      this.resetForm();
    } catch (error: unknown) {
      this.profile.set(null);
      this.loadError.set(this.toErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private buildForm() {
    return this.fb.group<DoctorFormGroup>({
      photo: this.fb.control<File | null>(null),
      firstName: this.fb.control<string>('', [Validators.required, nonBlankValidator, Validators.maxLength(100)]),
      lastName: this.fb.control<string>('', [Validators.required, nonBlankValidator, Validators.maxLength(100)]),
      middleName: this.fb.control<string | null>(null, Validators.maxLength(100)),
      dateOfBirth: this.fb.control<string>('', [
        Validators.required,
        Validators.pattern(/^\d{4}-\d{2}-\d{2}$/),
        (control) => typeof control.value === 'string' && control.value > currentDoctorProfileDate()
          ? { futureDate: true } : null,
      ]),
      // The shared create form has an email control.
      email: this.fb.control<string>('', []),
      specializationText: this.fb.control<string>('', [
        Validators.required,
        nonBlankValidator,
        catalogMatchValidator(() => this.specializations()),
      ]),
      specializationId: this.fb.control<string>('', [Validators.required]),
      officeText: this.fb.control<string>('', [
        Validators.required,
        nonBlankValidator,
        catalogMatchValidator(() => this.offices()),
      ]),
      officeId: this.fb.control<string>('', [Validators.required]),
      careerStartYear: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(1),
        Validators.pattern(/^\d+$/),
        maxYearValidator(() => Number(currentDoctorProfileDate().slice(0, 4))),
      ]),
      status: this.fb.control(DEFAULT_DOCTOR_STATUS, [
        Validators.required,
        (control) => isDoctorStatus(control.value) ? null : { invalidStatus: true },
      ]),
    });
  }

  private resetForm(): void {
    const profile = this.profile();

    if (profile === null) {
      return;
    }

    this.revokePhotoPreview();
    this.removePhoto = false;
    this.uploadedPhoto = null;
    this.photoError.set(null);
    this.editPhotoUrl.set(this.photoUrl());
    const value = toDoctorFormValue(profile, this.specializations(), this.offices());

    this.form.reset({
      photo: null,
      email: '',
      ...value,
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404 && this.profile() === null) {
        return this.doctorId === null ? NOT_LINKED_MESSAGE : 'Profile not found.';
      }

      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }
}

function withCurrentOption(
  options: readonly AutocompleteOption[],
  current: string | undefined
): readonly AutocompleteOption[] {
  if (!current?.trim() || findOptionByLabel(options, current)) return options;
  return [...options, { id: current, label: current }];
}
