import { HttpErrorResponse } from '@angular/common/http';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';

import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import { AppComboboxComponent } from '../../../../shared/components/app-combobox/app-combobox.component';
import { AppDateFieldComponent } from '../../../../shared/components/app-date-field/app-date-field.component';
import { AppDialogComponent } from '../../../../shared/components/app-dialog/app-dialog.component';
import { AppDialogService } from '../../../../shared/components/app-dialog/app-dialog.service';
import {
  AppointmentFormField,
  AppointmentFormGroup,
} from '../../models/appointment-form.model';
import {
  AppointmentAvailabilityService,
  SLOT_LOAD_ERROR_MESSAGE,
} from '../../services/appointment-availability.service';
import { AppointmentCatalogService } from '../../services/appointment-catalog.service';
import { AppointmentFormStore } from '../../services/appointment-form.store';
import { AppointmentsFacadeService } from '../../services/appointments-facade.service';
import { todayDateInputValue } from '../../utils/appointment-date';

/** Inputs of one debounced slot query. */
interface SlotQuery {
  readonly doctorId: string;
  readonly serviceId: string;
  readonly date: string;
  readonly candidateDoctorIds: readonly string[];
}

/** Outcome of one slot query, kept inside the stream so a failure stays retryable. */
type SlotLoadResult =
  | { readonly ok: true; readonly slots: readonly string[] }
  | { readonly ok: false; readonly error: unknown };

/**
 * Smart container of the appointment creation form.
 *
 * The component owns the form store, loads the catalogs once per session and translates
 * schedule responses into slot buttons. Fallible work stays here; the store and the
 * cascade reducer remain pure and synchronous.
 */
@Component({
  selector: 'app-appointment-create-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CdkTrapFocus,
    AppDialogComponent,
    AppComboboxComponent,
    AppDateFieldComponent,
  ],
  providers: [AppointmentFormStore],
  templateUrl: './appointment-create-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentCreateModalComponent implements OnInit {
  private readonly catalogService = inject(AppointmentCatalogService);
  private readonly availability = inject(AppointmentAvailabilityService);
  private readonly facade = inject(AppointmentsFacadeService);
  private readonly dialogs = inject(AppDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly store = inject(AppointmentFormStore);
  protected readonly form: FormGroup<AppointmentFormGroup> = this.store.form;

  readonly created = output<void>();
  readonly closed = output<void>();

  protected readonly today = todayDateInputValue();
  protected readonly isCatalogsLoading = signal<boolean>(true);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly slotError = signal<string | null>(null);
  protected readonly slotsLoadError = signal<string | null>(null);

  protected readonly formValue = this.store.value;
  protected readonly cascade = this.store.cascade;
  protected readonly confirmEnabled = this.store.confirmEnabled;
  protected readonly isSubmitting = this.store.isSubmitting;
  protected readonly isLoadingSlots = this.store.isLoadingSlots;

  protected readonly slots = computed<readonly string[]>(() =>
    [...this.store.availableSlots()].sort((left, right) => left.localeCompare(right))
  );

  /**
   * True when the selected service exists in the Appointments API scheduling catalog.
   *
   * The schedule endpoint resolves `serviceId` against that catalog, so a service missing
   * there can never produce slots. When the catalog could not be read (`null`) the check
   * is skipped so a secondary endpoint failure does not block the form.
   */
  protected readonly serviceSchedulable = computed<boolean>(() => {
    const serviceId = this.formValue().serviceId;
    const schedulable = this.store.catalogs().schedulableServiceIds;

    if (serviceId.length === 0 || schedulable === null) {
      return true;
    }

    return schedulable.has(serviceId);
  });

  protected readonly patientUnavailable = computed(
    () => !this.isCatalogsLoading() && this.store.catalogs().patients.length === 0
  );

  protected readonly patientOptions = computed<readonly AutocompleteOption[]>(() =>
    this.store.options().patients.map((patient) => ({
      id: patient.id,
      label: patient.fullName,
    }))
  );

  protected readonly specializationOptions = computed<readonly AutocompleteOption[]>(() =>
    this.store.options().specializations.map((specialization) => ({
      id: specialization.id,
      label: specialization.name,
    }))
  );

  protected readonly doctorOptions = computed<readonly AutocompleteOption[]>(() =>
    this.store.options().doctors.map((doctor) => ({
      id: doctor.id,
      label: doctor.fullName,
    }))
  );

  protected readonly serviceOptions = computed<readonly AutocompleteOption[]>(() =>
    this.store.options().services.map((service) => ({
      id: service.id,
      label: service.name,
    }))
  );

  protected readonly officeOptions = computed(() => this.store.options().offices);

  private readonly slotQuery = new Subject<SlotQuery | null>();

  /** Last slot inputs that produced a query; prevents duplicate requests per render. */
  private lastSlotKey = '';

  /** Last issued query, reused by the retry action after a failed load. */
  private pendingSlotQuery: SlotQuery | null = null;

  constructor() {
    this.slotQuery
      .pipe(
        debounceTime(250),
        switchMap((query) =>
          this.loadSlots(query).pipe(
            map((slots): SlotLoadResult => ({ ok: true, slots })),
            // Keep the failure inside the stream: an error that escapes `switchMap`
            // tears down the subscription and the retry action would never run.
            catchError((error: unknown) => of<SlotLoadResult>({ ok: false, error }))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.isLoadingSlots.set(false);

        if (!result.ok) {
          this.store.availableSlots.set([]);
          this.slotsLoadError.set(SLOT_LOAD_ERROR_MESSAGE);
          this.notifications.showError(this.toErrorMessage(result.error));
          return;
        }

        this.store.availableSlots.set(result.slots);
        this.slotsLoadError.set(null);
      });

    effect(() => {
      const value = this.store.value();
      const slotsEnabled = this.store.cascade().slotsEnabled;
      const schedulable = this.serviceSchedulable();
      const key = [
        value.date,
        value.specializationId,
        value.serviceId,
        value.doctorId,
        value.officeId,
        schedulable ? 'schedulable' : 'unschedulable',
      ].join('|');

      if (key === this.lastSlotKey) {
        return;
      }

      this.lastSlotKey = key;

      if (!slotsEnabled || !schedulable) {
        this.store.availableSlots.set([]);
        this.isLoadingSlots.set(false);
        this.slotsLoadError.set(null);
        this.pendingSlotQuery = null;
        this.slotQuery.next(null);
        return;
      }

      const query: SlotQuery = {
        doctorId: value.doctorId,
        serviceId: value.serviceId,
        date: value.date,
        candidateDoctorIds: this.store.options().doctors.map((doctor) => doctor.id),
      };

      this.isLoadingSlots.set(true);
      this.slotsLoadError.set(null);
      this.pendingSlotQuery = query;
      this.slotQuery.next(query);
    });
  }

  ngOnInit(): void {
    this.loadCatalogs(false);
  }

  protected onOptionSelected(field: AppointmentFormField, option: AutocompleteOption): void {
    this.store.selectOption(field, option);
  }

  protected onTextChange(field: AppointmentFormField, text: string): void {
    this.store.setText(field, text);
  }

  protected onFieldBlur(field: AppointmentFormField): void {
    this.store.markTouched(field);
  }

  protected onDateChange(date: string): void {
    this.slotError.set(null);
    this.slotsLoadError.set(null);
    this.store.setDate(date);
  }

  protected onOfficeChange(event: Event): void {
    const officeId = (event.target as HTMLSelectElement).value;

    this.store.selectOption('office', { id: officeId, label: officeId });
    this.store.markTouched('office');
  }

  protected onSlotSelected(slot: string): void {
    this.slotError.set(null);
    this.store.markTouched('timeSlot');
    this.store.availableDoctors.set(null);
    this.store.selectSlot(slot);

    const value = this.store.value();
    const candidates = this.store.options().doctors.map((doctor) => doctor.id);

    if (candidates.length === 0) {
      this.store.availableDoctors.set(new Set<string>());
      return;
    }

    this.availability
      .getDoctorAvailability(candidates, value.serviceId, value.date, slot)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (available) => this.store.availableDoctors.set(available),
        error: () => this.store.availableDoctors.set(new Set<string>()),
      });
  }

  protected async onConfirm(): Promise<void> {
    this.store.markAllTouched();

    if (!this.store.confirmEnabled()) {
      return;
    }

    this.slotError.set(null);
    this.store.isSubmitting.set(true);

    const outcome = await this.facade.create(this.store.payload());

    this.store.isSubmitting.set(false);

    switch (outcome.kind) {
      case 'created':
        this.created.emit();
        this.closed.emit();
        return;
      case 'slotConflict':
        this.slotError.set(outcome.message);
        this.notifications.showError(outcome.message);
        this.reloadSlotsAfterConflict();
        return;
      case 'patientInactive':
        this.notifications.showError(outcome.message);
        this.store.setText('patient', '');
        this.store.markTouched('patient');
        return;
      case 'failed':
        this.notifications.showError(outcome.message);
        return;
    }
  }

  protected async onRequestClose(): Promise<void> {
    if (this.store.isSubmitting()) {
      return;
    }

    const confirmed = await this.dialogs.confirmExit();

    if (confirmed) {
      this.closed.emit();
    }
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    void this.onRequestClose();
  }

  protected retryCatalogs(): void {
    this.loadCatalogs(true);
  }

  /** Re-runs the last slot query after a load failure. */
  protected retrySlots(): void {
    const query = this.pendingSlotQuery;

    if (query === null) {
      return;
    }

    this.slotsLoadError.set(null);
    this.isLoadingSlots.set(true);
    this.slotQuery.next(query);
  }

  protected patientError(): string | null {
    return this.store.errors().patient;
  }

  protected specializationError(): string | null {
    return this.store.errors().specialization;
  }

  protected doctorError(): string | null {
    return this.store.errors().doctor;
  }

  protected serviceError(): string | null {
    return this.store.errors().service;
  }

  protected officeError(): string | null {
    return this.store.errors().office;
  }

  protected dateError(): string | null {
    return this.store.errors().date;
  }

  protected timeSlotError(): string | null {
    return this.store.errors().timeSlot;
  }

  private loadCatalogs(force: boolean): void {
    this.isCatalogsLoading.set(true);
    this.catalogError.set(null);

    this.catalogService
      .load(force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogs) => {
          this.store.setCatalogs(catalogs);
          this.isCatalogsLoading.set(false);
        },
        error: (error: unknown) => {
          const message = this.toErrorMessage(error);
          this.catalogError.set(message);
          this.isCatalogsLoading.set(false);
          this.notifications.showError(message);
        },
      });
  }

  private loadSlots(query: SlotQuery | null): Observable<readonly string[]> {
    if (query === null) {
      return of<readonly string[]>([]);
    }

    if (query.doctorId.length > 0) {
      return this.availability.getSlots(query.doctorId, query.serviceId, query.date);
    }

    return this.availability.getSlotsForCandidates(
      query.candidateDoctorIds,
      query.serviceId,
      query.date
    );
  }

  private reloadSlotsAfterConflict(): void {
    const value = this.store.value();
    const query: SlotQuery = {
      doctorId: value.doctorId,
      serviceId: value.serviceId,
      date: value.date,
      candidateDoctorIds: this.store.options().doctors.map((doctor) => doctor.id),
    };

    this.availability.invalidate();
    this.store.availableSlots.set([]);
    this.store.selectSlot('');
    this.isLoadingSlots.set(true);
    this.slotsLoadError.set(null);
    this.pendingSlotQuery = query;
    this.slotQuery.next(query);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }
}
