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

import { ApiContractError, readApiAcknowledgment, readApiEnvelope } from '../../../../api/api-envelope';
import { UpdateDoctorDto } from '../../../../api/generated/profiles/models/update-doctor-dto';
import { DoctorsService } from '../../../../api/generated/profiles/services/doctors.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import { catalogMatchValidator } from '../../../../core/validators/catalog-match.validator';
import { maxDateValidator, maxYearValidator } from '../../../../core/validators/max-date.validator';
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
  DoctorStatus,
  isDoctorStatus,
} from '../../../doctors/models/doctor-form.model';
import { isDoctorDetails, isPagedDoctorRows } from '../../../doctors/services/doctor-contract.guards';
import { DoctorCatalogStore } from '../../../doctors/services/doctor-catalog.store';
import { toUpdateDoctorDto } from '../../../doctors/services/doctor-form.mapper';
import { ProfileViewComponent } from '../../components/profile-view/profile-view.component';
import {
  DoctorProfile,
  applyProfileChanges,
  toDoctorFormValue,
} from '../../models/profile.model';

/** Status lookup page size: the details DTO has no status, the table row does. */
const STATUS_PAGE_SIZE = 500;

const NOT_LINKED_MESSAGE =
  'Your doctor profile is not linked to this account yet. Ask a receptionist to create or link it.';

/**
 * Smart profile page.
 *
 * Receptionists reach a doctor through `/doctors/:id/profile`; doctors reach their own
 * profile through `/profile`, which needs the account → profile lookup that ProfilesAPI
 * does not expose yet (gate P-1), so that route renders an explanatory error state.
 */
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
  protected readonly isReceptionistRoute = signal<boolean>(false);

  protected readonly mode: DoctorFormMode = 'edit';
  protected readonly form = this.buildForm();
  protected readonly specializations = this.catalogs.specializations;
  protected readonly offices = this.catalogs.offices;

  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status }
  );

  protected readonly canSubmit = computed<boolean>(
    () => this.formStatus() === 'VALID' && !this.isSaving()
  );

  private doctorId: string | null = null;

  constructor() {
    this.form.controls.specializationText.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => {
        const normalized = text.trim().toLowerCase();
        const match = this.catalogs
          .specializations()
          .find((option) => option.label.trim().toLowerCase() === normalized);

        this.form.controls.specializationId.setValue(match?.id ?? '', { emitEvent: false });
      });
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

    if (this.form.invalid || this.isSaving() || profile === null) {
      return;
    }

    this.isSaving.set(true);
    this.formError.set(null);

    try {
      const value = this.form.getRawValue();
      const body: UpdateDoctorDto = toUpdateDoctorDto(value, profile.photoPath);
      const acknowledgment = await firstValueFrom(
        this.doctors.doctorsIdPut({ id: profile.id, body })
      );
      readApiAcknowledgment(acknowledgment);

      const statusValue = value.status;

      if (!isDoctorStatus(statusValue)) {
        throw new ApiContractError('The selected status is not valid.');
      }

      this.profile.set(applyProfileChanges(profile, value, profile.photoPath));
      this.isEditMode.set(false);
      this.notifications.showSuccess('Profile updated successfully');
    } catch (error: unknown) {
      this.formError.set(this.toErrorMessage(error));
    } finally {
      this.isSaving.set(false);
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
      await this.catalogs.load();

      if (this.doctorId === null) {
        this.loadError.set(NOT_LINKED_MESSAGE);
        return;
      }

      const [detailsPayload, tablePayload] = await Promise.all([
        firstValueFrom(this.doctors.doctorsIdGet({ id: this.doctorId })),
        firstValueFrom(
          this.doctors.doctorsDoctorsGet({ page: 1, pageSize: STATUS_PAGE_SIZE })
        ),
      ]);

      const details = readApiEnvelope(detailsPayload, isDoctorDetails);
      const table = readApiEnvelope(tablePayload, isPagedDoctorRows);
      const row = table.data.find((item) => item.id === this.doctorId);

      if (row === undefined || !isDoctorStatus(row.status)) {
        throw new ApiContractError('The doctor status is not available.');
      }

      const status: DoctorStatus = row.status;

      this.profile.set({
        id: this.doctorId,
        photoPath: details.photoPath ?? null,
        firstName: details.firstName,
        lastName: details.lastName,
        middleName: details.middleName ?? null,
        dateOfBirth: details.dateOfBirth.slice(0, 10),
        specialization: details.specialization,
        officeAddress: details.officeAddress,
        careerStartYear: details.careerStartYear,
        status,
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
      firstName: this.fb.control<string>('', [Validators.required, nonBlankValidator]),
      lastName: this.fb.control<string>('', [Validators.required, nonBlankValidator]),
      middleName: this.fb.control<string | null>(null),
      dateOfBirth: this.fb.control<string>('', [
        Validators.required,
        maxDateValidator(() => new Date()),
      ]),
      // The backend exposes no email on the details DTO, so the field is read-only and
      // intentionally free of validators: it must never block a save (FR-032).
      email: this.fb.control<string>('', []),
      specializationText: this.fb.control<string>('', [
        Validators.required,
        catalogMatchValidator(() => this.catalogs.specializations()),
      ]),
      specializationId: this.fb.control<string>('', [Validators.required]),
      officeText: this.fb.control<string>('', [Validators.required]),
      officeId: this.fb.control<string>('', [Validators.required]),
      careerStartYear: this.fb.control<number | null>(null, [
        Validators.required,
        maxYearValidator(() => new Date().getFullYear()),
      ]),
      status: this.fb.control(DEFAULT_DOCTOR_STATUS, [Validators.required]),
    });
  }

  private resetForm(): void {
    const profile = this.profile();

    if (profile === null) {
      return;
    }

    const value = toDoctorFormValue(profile, this.catalogs.specializations(), this.catalogs.offices());

    this.form.reset({
      photo: null,
      email: '',
      ...value,
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404 && this.doctorId !== null) {
        return 'Profile not found.';
      }

      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }
}
