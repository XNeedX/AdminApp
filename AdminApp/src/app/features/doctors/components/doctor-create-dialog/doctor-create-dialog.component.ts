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
import { DoctorsService } from '../../../../api/generated/profiles/services/doctors.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { catalogMatchValidator } from '../../../../core/validators/catalog-match.validator';
import { maxDateValidator, maxYearValidator } from '../../../../core/validators/max-date.validator';
import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import { DoctorFormComponent } from '../doctor-form/doctor-form.component';
import {
  CANCEL_CREATE_MESSAGE,
  DEFAULT_DOCTOR_STATUS,
  DoctorFormGroup,
  DoctorFormMode,
} from '../../models/doctor-form.model';
import { isDoctorProfileId } from '../../services/doctor-contract.guards';
import { DoctorCatalogStore } from '../../services/doctor-catalog.store';
import { toCreateDoctorDto } from '../../services/doctor-form.mapper';

/** Summary reported to the directory after a successful create. */
export interface DoctorCreatedSummary {
  readonly id: string;
  readonly fullName: string;
}

/** Result every `Dialog.open(DoctorCreateDialogComponent)` receives. */
export interface DoctorCreateDialogResult {
  readonly created: DoctorCreatedSummary | null;
}

/**
 * Smart host for `DoctorFormComponent` in create mode, opened through CDK `Dialog`.
 *
 * Owns the form, the catalogs and the `POST /Doctors` call; the directory page only
 * re-opens the dialog and refreshes its data.
 */
@Component({
  selector: 'app-doctor-create-dialog',
  standalone: true,
  imports: [DoctorFormComponent],
  templateUrl: './doctor-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorCreateDialogComponent implements OnInit {
  private readonly dialogRef = inject<DialogRef<DoctorCreateDialogResult>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly catalogs = inject(DoctorCatalogStore);
  private readonly doctors = inject(DoctorsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mode: DoctorFormMode = 'create';
  protected readonly form = this.buildForm();
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly specializations = this.catalogs.specializations;
  protected readonly offices = this.catalogs.offices;

  private readonly formStatus = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status }
  );

  protected readonly canSubmit = computed<boolean>(
    () => this.formStatus() === 'VALID' && !this.isSubmitting()
  );

  protected readonly formError = computed<string | null>(
    () => this.serverError() ?? this.catalogs.error()
  );

  constructor() {
    this.syncCatalogId('specializationText', 'specializationId', () =>
      this.catalogs.specializations()
    );
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

    try {
      const value = this.form.getRawValue();
      const payload = await firstValueFrom(
        this.doctors.doctorsPost({ body: toCreateDoctorDto(value, null) })
      );
      const id = readApiEnvelope(payload, isDoctorProfileId);

      this.dialogRef.close({
        created: {
          id,
          fullName: `${value.firstName.trim()} ${value.lastName.trim()}`,
        },
      });
    } catch (error: unknown) {
      this.applyServerError(error);
      this.serverError.set(this.toErrorMessage(error));
      this.isSubmitting.set(false);
    }
  }

  protected cancel(): void {
    if (!this.form.dirty) {
      this.closeWithoutSaving();
      return;
    }

    const ref = this.dialog.open<boolean, CancelConfirmDialogData>(
      CancelConfirmDialogComponent,
      {
        data: { message: CANCEL_CREATE_MESSAGE, confirmText: 'Yes', cancelText: 'No' },
        disableClose: true,
        ariaLabelledBy: 'cancel-confirm-dialog-message',
        restoreFocus: true,
      }
    );

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed === true) {
        this.closeWithoutSaving();
      }
    });
  }

  protected onSpecializationSelected(option: AutocompleteOption): void {
    this.form.controls.specializationId.setValue(option.id);
    this.form.controls.specializationText.setValue(option.label);
  }

  protected onOfficeSelected(option: AutocompleteOption): void {
    this.form.controls.officeId.setValue(option.id);
    this.form.controls.officeText.setValue(option.label);
  }

  private closeWithoutSaving(): void {
    this.dialogRef.close({ created: null });
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
      email: this.fb.control<string>('', [Validators.required, Validators.email]),
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

  /**
   * Keeps the hidden catalog id aligned with the visible text: typing a value that no
   * longer matches a catalog label clears the id so the form becomes invalid.
   */
  private syncCatalogId(
    textControl: 'specializationText' | 'officeText',
    idControl: 'specializationId' | 'officeId',
    options: () => readonly AutocompleteOption[]
  ): void {
    this.form.controls[textControl].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => {
        const normalized = text.trim().toLowerCase();
        const match = options().find(
          (option) => option.label.trim().toLowerCase() === normalized
        );

        this.form.controls[idControl].setValue(match?.id ?? '', { emitEvent: false });
      });
  }

  private applyServerError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      return;
    }

    if (error.status === 409) {
      this.form.controls.email.setErrors({
        ...(this.form.controls.email.errors ?? {}),
        emailTaken: true,
      });
      this.form.controls.email.markAsTouched();
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'The doctor could not be created. Please try again.';
  }
}
