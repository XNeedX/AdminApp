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
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, catchError, map, of, switchMap, timer } from 'rxjs';

import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import { AppComboboxComponent } from '../../../../shared/components/app-combobox/app-combobox.component';
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
import {
  AppointmentCatalogService,
  CatalogSourceError,
} from '../../services/appointment-catalog.service';
import { AppointmentRow } from '../../models/appointment.model';
import { buildCascadeOptions } from '../../services/appointment-cascade';
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

  readonly appointment = input<AppointmentRow | null>(null);
  readonly created = output<void>();
  readonly closed = output<void>();

  protected readonly today = todayDateInputValue();
  protected readonly isCatalogsLoading = signal<boolean>(true);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly slotError = signal<string | null>(null);
  protected readonly slotsLoadError = signal<string | null>(null);

  protected readonly formValue = this.store.value;
  protected readonly cascade = this.store.cascade;
  protected readonly confirmEnabled = computed(() =>
    this.store.confirmEnabled() && this.formValue().date >= this.today
  );
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
  protected readonly fixedOffice = computed(() =>
    this.store.catalogs().offices.find(({ id }) => id === this.formValue().officeId)?.displayName ?? ''
  );

  protected readonly calendarOpen = signal(false);
  protected readonly calendarMonth = signal(this.today.slice(0, 7));
  protected readonly availableDates = signal<ReadonlySet<string> | null>(null);
  protected readonly datesLoadError = signal(false);
  private readonly calendarRefresh = signal(0);
  private readonly doctorCandidates = computed(() => buildCascadeOptions({
    value: this.formValue(),
    catalogs: this.store.catalogs(),
    availableDoctors: null,
  }).doctors.map(({ id }) => id));

  protected readonly calendar = computed(() => {
    const first = new Date(this.calendarMonth() + '-01T00:00:00Z');
    const last = new Date(first);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    return {
      first: first.toISOString().slice(0, 10),
      last: last.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('en', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
      }).format(first),
      leadingDays: Array.from({ length: (first.getUTCDay() + 6) % 7 }, (_, i) => i),
      dates: Array.from({ length: last.getUTCDate() }, (_, i) => ({
        day: i + 1,
        value: this.calendarMonth() + '-' + String(i + 1).padStart(2, '0'),
      })),
    };
  });

  private closeConfirmationOpen = false;

  private readonly slotQuery = new Subject<SlotQuery | null>();

  /** Last slot inputs that produced a query; prevents duplicate requests per render. */
  private lastSlotKey = '';

  /** Last issued query, reused by the retry action after a failed load. */
  private pendingSlotQuery: SlotQuery | null = null;

  constructor() {
    this.slotQuery
      .pipe(
        switchMap((query) =>
          (query === null ? this.loadSlots(query) : timer(250).pipe(
            switchMap(() => this.loadSlots(query))
          )).pipe(
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
        const selected = this.store.value().timeSlot;
        if (selected && !result.slots.includes(selected)) {
          this.store.selectSlot('');
        }
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
        ...(value.doctorId ? [] : this.doctorCandidates()),
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
        candidateDoctorIds: this.doctorCandidates(),
      };

      this.isLoadingSlots.set(true);
      this.slotsLoadError.set(null);
      this.pendingSlotQuery = query;
      this.slotQuery.next(query);
    });

    effect((onCleanup) => {
      const { doctorId, date, serviceId, timeSlot } = this.formValue();
      if (doctorId || !date || !serviceId || !timeSlot) return;

      const request = this.availability.getDoctorAvailability(
        this.doctorCandidates(), serviceId, date, timeSlot, this.appointment()?.id
      ).subscribe((doctors) => this.store.availableDoctors.set(doctors));
      onCleanup(() => request.unsubscribe());
    });

    effect((onCleanup) => {
      this.calendarRefresh();
      if (!this.calendarOpen() || !this.cascade().dateEnabled) return;

      const { doctorId, serviceId } = this.formValue();
      const { first, last } = this.calendar();
      this.availableDates.set(null);
      this.datesLoadError.set(false);
      const request = this.availability.getAvailableDates(
        doctorId ? [doctorId] : this.doctorCandidates(),
        serviceId, first, last, this.appointment()?.id
      ).subscribe({
        next: (dates) => this.availableDates.set(dates),
        error: () => this.datesLoadError.set(true),
      });
      onCleanup(() => request.unsubscribe());
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

  protected toggleCalendar(): void {
    if (!this.calendarOpen()) {
      this.calendarMonth.set((this.formValue().date || this.today).slice(0, 7));
    }
    this.calendarOpen.update((open) => !open);
  }

  protected stepMonth(offset: number): void {
    const month = new Date(this.calendar().first + 'T00:00:00Z');
    month.setUTCMonth(month.getUTCMonth() + offset);
    this.calendarMonth.set(month.toISOString().slice(0, 7));
  }

  protected retryDates(): void {
    this.calendarRefresh.update((value) => value + 1);
  }

  protected onGroupBlur(event: FocusEvent, field: 'date' | 'timeSlot'): void {
    if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return;
    this.onFieldBlur(field);
    if (field === 'date') this.calendarOpen.set(false);
  }

  protected onDateChange(date: string): void {
    if (!this.availableDates()?.has(date) || date < this.today) return;
    this.calendarOpen.set(false);
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
    this.store.selectSlot(slot);
  }

  protected async onConfirm(): Promise<void> {
    this.store.markAllTouched();

    if (!this.confirmEnabled()) {
      return;
    }

    this.slotError.set(null);
    this.store.isSubmitting.set(true);

    const appointment = this.appointment();
    const payload = this.store.payload();
    const outcome = appointment === null
      ? await this.facade.create(payload)
      : await this.facade.reschedule(appointment.id, payload);

    this.store.isSubmitting.set(false);

    switch (outcome.kind) {
      case 'created':
        this.availability.invalidate();
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
    if (this.store.isSubmitting() || this.closeConfirmationOpen) return;

    this.closeConfirmationOpen = true;
    try {
      const confirmed = this.appointment() === null
        ? await this.dialogs.confirmExit()
        : await this.dialogs.confirm({
            title: 'Cancel changes',
            message: 'Do you really want to cancel? Entered data won’t be saved.',
            confirmText: 'Yes',
            cancelText: 'No',
          });
      if (confirmed) this.closed.emit();
    } finally {
      this.closeConfirmationOpen = false;
    }
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    if (this.calendarOpen()) {
      this.calendarOpen.set(false);
      return;
    }
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

    // The catalog is an all-or-nothing fork: one failing endpoint rejects the whole
    // load. Patients and doctors are needed to complete the form, so a failure there
    // blocks the form; the optional catalogs degrade instead (`schedulableServiceIds`
    // falls back to `null` inside the service).
    this.catalogService
      .load(force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogs) => {
          this.store.setCatalogs(catalogs);
          const appointment = this.appointment();
          if (appointment !== null) this.store.prefill(appointment);
          this.isCatalogsLoading.set(false);
        },
        error: (error: unknown) => {
          const message = this.toCatalogErrorMessage(error);
          this.catalogError.set(message);
          this.isCatalogsLoading.set(false);
          this.notifications.showError(message);
        },
      });
  }

  /**
   * Names the failing catalog so a validation failure ("unexpected payload shape") is
   * not reported without context: the user needs to know which list could not be read.
   */
  private toCatalogErrorMessage(error: unknown): string {
    if (error instanceof CatalogSourceError) {
      return `Could not load the ${error.source} list: ${this.toErrorMessage(error.cause)}`;
    }

    return this.toErrorMessage(error);
  }

  private loadSlots(query: SlotQuery | null): Observable<readonly string[]> {
    if (query === null) {
      return of<readonly string[]>([]);
    }

    if (query.doctorId.length > 0) {
      return this.availability.getSlots(query.doctorId, query.serviceId, query.date, this.appointment()?.id);
    }

    return this.availability.getSlotsForCandidates(
      query.candidateDoctorIds,
      query.serviceId,
      query.date,
      this.appointment()?.id
    );
  }

  private reloadSlotsAfterConflict(): void {
    const value = this.store.value();
    const query: SlotQuery = {
      doctorId: value.doctorId,
      serviceId: value.serviceId,
      date: value.date,
      candidateDoctorIds: this.doctorCandidates(),
    };

    this.availability.invalidate();
    this.retryDates();
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
