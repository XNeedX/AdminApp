import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.model';
import {
  AppointmentCatalogs,
  EMPTY_APPOINTMENT_CATALOGS,
} from '../models/appointment-catalog.model';
import {
  AppointmentFormField,
  AppointmentFormGroup,
  AppointmentFormValue,
  CascadePlan,
  CascadeWrite,
} from '../models/appointment-form.model';
import { AppointmentRow } from '../models/appointment.model';
import { toTimeLabel } from '../utils/appointment-date';
import { reduceAppointmentCascade } from './appointment-cascade';

/**
 * Signal store behind the appointment creation form.
 *
 * `form.valueChanges` is bridged with `toSignal`; the cascade plan is a `computed`; a
 * single `effect` applies the plan's writes with `emitEvent: false`. The reducer never
 * targets the field that was just edited and every write is compared by value first, so
 * the synchronisation is idempotent and cannot loop.
 */
@Injectable()
export class AppointmentFormStore {
  private readonly fb = inject(FormBuilder);

  readonly form: FormGroup<AppointmentFormGroup> = this.fb.group<AppointmentFormGroup>({
    patientId: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    patientText: this.fb.control<string>('', { nonNullable: true }),
    specializationId: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    specializationText: this.fb.control<string>('', { nonNullable: true }),
    doctorId: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    doctorText: this.fb.control<string>('', { nonNullable: true }),
    serviceId: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    serviceText: this.fb.control<string>('', { nonNullable: true }),
    officeId: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    date: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    timeSlot: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  private readonly formValueChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly latestValue = signal<AppointmentFormValue>(
    toFormValue(this.form.getRawValue())
  );

  private readonly touchedFields = signal<ReadonlySet<AppointmentFormField>>(new Set());

  private readonly lockedFields = signal<ReadonlySet<AppointmentFormField>>(new Set());
  private readonly doctorText = signal('');

  readonly catalogs = signal<AppointmentCatalogs>(EMPTY_APPOINTMENT_CATALOGS);
  readonly lastEditedField = signal<AppointmentFormField | null>(null);
  readonly availableDoctors = signal<ReadonlySet<string> | null>(null);
  readonly availableSlots = signal<readonly string[]>([]);
  readonly isLoadingSlots = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly value = this.latestValue.asReadonly();
  readonly doctorSearch = this.doctorText.asReadonly();

  readonly cascade = computed<CascadePlan>(() =>
    reduceAppointmentCascade({
      value: this.latestValue(),
      catalogs: this.catalogs(),
      lockedFields: this.lockedFields(),
      lastEditedField: this.lastEditedField(),
      availableDoctors: this.availableDoctors(),
    })
  );

  readonly options = computed(() => this.cascade().options);

  readonly confirmEnabled = computed(() => {
    const value = this.latestValue();
    const plan = this.cascade();

    return (
      this.form.valid &&
      plan.dateEnabled &&
      plan.isComplete &&
      value.date.length > 0 &&
      value.timeSlot.length > 0 &&
      this.availableSlots().includes(value.timeSlot) &&
      !this.isLoadingSlots() &&
      !this.isSubmitting()
    );
  });

  /** Field error messages, gated by touch so a pristine form stays quiet. */
  readonly errors = computed<Readonly<Record<AppointmentFormField, string | null>>>(() => {
    const touched = this.touchedFields();
    const value = this.latestValue();
    const raw = this.form.getRawValue();
    const patientText = raw.patientText.trim();

    return {
      patient: touched.has('patient')
        ? value.patientId.length > 0
          ? null
          : patientText.length === 0
            ? 'Please, choose the patient'
            : 'Invalid patient name'
        : null,
      specialization:
        touched.has('specialization') && value.specializationId.length === 0
          ? 'Please, choose the specialization'
          : null,
      doctor:
        touched.has('doctor') &&
        !this.options().doctors.some((doctor) => doctor.id === value.doctorId)
          ? this.doctorText().trim() ? 'Invalid doctor name' : 'Please, choose the doctor'
          : null,
      service:
        touched.has('service') && value.serviceId.length === 0
          ? 'Please, choose the service'
          : null,
      office:
        touched.has('office') && value.officeId.length === 0 ? 'Please, choose the office' : null,
      date: touched.has('date') && value.date.length === 0 ? 'Please, select the date' : null,
      timeSlot:
        touched.has('timeSlot') && value.timeSlot.length === 0
          ? 'Please, select the time slot'
          : null,
    };
  });

  constructor() {
    effect(() => {
      // `valueChanges` is tracked only as the trigger: internal cascade writes use
      // `emitEvent: false`, so its cached value can lag behind the form. The raw value
      // is the source of truth.
      this.formValueChanges();

      const next = toFormValue(this.form.getRawValue());

      if (!sameValue(next, untracked(this.latestValue))) {
        this.latestValue.set(next);
      }
    });

    effect(() => {
      const plan = this.cascade();
      const writes: readonly CascadeWrite[] = [...plan.clear, ...plan.autoFill];

      if (writes.length > 0) {
        this.applyWrites(writes);
      }
    });
  }

  setCatalogs(catalogs: AppointmentCatalogs): void {
    this.catalogs.set(catalogs);
  }

  prefill(row: AppointmentRow): void {
    const booking = row.booking;
    if (booking === undefined) return;

    const catalogs = this.catalogs();
    const doctor = catalogs.doctors.find(({ id }) => id === booking.doctorId);
    const service = catalogs.services.find(({ id }) => id === booking.serviceId);
    const specializationId = service?.specializationId ?? doctor?.specializationId ?? '';

    this.lockedFields.set(new Set(['patient', 'specialization', 'service', 'office']));
    this.form.setValue({
      patientId: booking.patientId,
      patientText: row.patientFullName,
      specializationId,
      specializationText: this.labelFor('specialization', specializationId),
      doctorId: booking.doctorId,
      doctorText: doctor?.fullName ?? row.doctorFullName,
      serviceId: booking.serviceId,
      serviceText: row.serviceName,
      officeId: booking.officeId,
      date: booking.date,
      timeSlot: toTimeLabel(row.startTime),
    });
    for (const field of ['patientText', 'specializationText', 'serviceText', 'officeId'] as const) {
      this.form.controls[field].disable({ emitEvent: false });
    }
    this.doctorText.set(this.form.controls.doctorText.value);
    this.latestValue.set(toFormValue(this.form.getRawValue()));
  }

  /** Selects a catalog entry; the id becomes the source of truth. */
  selectOption(field: AppointmentFormField, option: AutocompleteOption): void {
    if (this.lockedFields().has(field)) return;
    this.availableDoctors.set(null);
    this.lastEditedField.set(field);
    this.writeField(field, option.id);
    this.patchValue(field, option.id);
  }

  /** Stores free text typed into a combobox; an unmatched text clears the id. */
  setText(field: AppointmentFormField, text: string): void {
    if (this.lockedFields().has(field)) return;
    if (field === 'doctor') this.doctorText.set(text);
    const textControl = this.textControlFor(field);

    if (textControl !== null && textControl.value !== text) {
      textControl.setValue(text);
    }

    const match = this.findOptionByLabel(field, text);
    const id = match?.id ?? '';
    if (field !== 'doctor') this.availableDoctors.set(null);

    this.lastEditedField.set(field === 'doctor' && text.trim().length === 0 ? null : field);
    this.writeField(field, id, { keepText: true });
    this.patchValue(field, id);
  }

  /** Changing the date always invalidates the previously selected slot. */
  setDate(date: string): void {
    const previous = this.latestValue().date;

    if (previous === date) {
      return;
    }

    this.lastEditedField.set('date');
    this.writeField('date', date);
    this.patchValue('date', date);

    if (this.latestValue().timeSlot.length > 0) {
      this.writeField('timeSlot', '');
      this.patchValue('timeSlot', '');
    }

    this.availableDoctors.set(null);
    this.availableSlots.set([]);
  }

  selectSlot(slot: string): void {
    this.availableDoctors.set(null);
    this.lastEditedField.set('timeSlot');
    this.writeField('timeSlot', slot);
    this.patchValue('timeSlot', slot);
  }

  markTouched(field: AppointmentFormField): void {
    this.touchedFields.update((fields) => {
      if (fields.has(field)) {
        return fields;
      }

      const next = new Set(fields);
      next.add(field);

      return next;
    });
  }

  markAllTouched(): void {
    this.touchedFields.set(
      new Set<AppointmentFormField>([
        'patient',
        'specialization',
        'doctor',
        'service',
        'office',
        'date',
        'timeSlot',
      ])
    );
  }

  /** Payload accepted by `POST /Appointments/{patientId}`. */
  payload(): {
    readonly patientId: string;
    readonly doctorId: string;
    readonly serviceId: string;
    readonly officeId: string;
    readonly date: string;
    readonly timeSlot: string;
  } {
    const raw = this.form.getRawValue();

    return {
      patientId: raw.patientId,
      doctorId: raw.doctorId,
      serviceId: raw.serviceId,
      officeId: raw.officeId,
      date: raw.date,
      timeSlot: raw.timeSlot,
    };
  }

  private applyWrites(writes: readonly CascadeWrite[]): void {
    for (const write of writes) {
      this.writeField(write.field, write.value);
    }

    this.latestValue.set(toFormValue(this.form.getRawValue()));
  }

  private patchValue(field: AppointmentFormField, value: string): void {
    this.latestValue.update((current) => {
      switch (field) {
        case 'patient':
          return { ...current, patientId: value };
        case 'specialization':
          return { ...current, specializationId: value };
        case 'doctor':
          return { ...current, doctorId: value };
        case 'service':
          return { ...current, serviceId: value };
        case 'office':
          return { ...current, officeId: value };
        case 'date':
          return { ...current, date: value };
        case 'timeSlot':
          return { ...current, timeSlot: value };
      }
    });
  }

  private writeField(
    field: AppointmentFormField,
    value: string,
    options: { readonly keepText?: boolean } = {}
  ): void {
    const controls = this.form.controls;
    const emitEvent = false;

    switch (field) {
      case 'patient':
        setControlValue(controls.patientId, value, emitEvent);

        if (options.keepText !== true) {
          setControlValue(controls.patientText, this.labelFor('patient', value), emitEvent);
        }
        return;
      case 'specialization':
        setControlValue(controls.specializationId, value, emitEvent);

        if (options.keepText !== true) {
          setControlValue(
            controls.specializationText,
            this.labelFor('specialization', value),
            emitEvent
          );
        }
        return;
      case 'doctor':
        setControlValue(controls.doctorId, value, emitEvent);

        if (options.keepText !== true) {
          const label = this.labelFor('doctor', value);
          this.doctorText.set(label);
          setControlValue(controls.doctorText, label, emitEvent);
        }
        return;
      case 'service':
        setControlValue(controls.serviceId, value, emitEvent);

        if (options.keepText !== true) {
          setControlValue(controls.serviceText, this.labelFor('service', value), emitEvent);
        }
        return;
      case 'office':
        setControlValue(controls.officeId, value, emitEvent);
        return;
      case 'date':
        setControlValue(controls.date, value, emitEvent);
        return;
      case 'timeSlot':
        setControlValue(controls.timeSlot, value, emitEvent);
        return;
    }
  }

  private labelFor(field: AppointmentFormField, id: string): string {
    if (id.length === 0) {
      return '';
    }

    const catalogs = this.catalogs();

    switch (field) {
      case 'patient':
        return catalogs.patients.find((option) => option.id === id)?.fullName ?? '';
      case 'specialization':
        return catalogs.specializations.find((option) => option.id === id)?.name ?? '';
      case 'doctor':
        return catalogs.doctors.find((option) => option.id === id)?.fullName ?? '';
      case 'service':
        return catalogs.services.find((option) => option.id === id)?.name ?? '';
      default:
        return '';
    }
  }

  private findOptionByLabel(
    field: AppointmentFormField,
    text: string
  ): { readonly id: string } | null {
    const normalized = text.trim().toLowerCase();

    if (normalized.length === 0) {
      return null;
    }

    const catalogs = this.catalogs();
    const candidates: readonly { readonly id: string; readonly label: string }[] =
      field === 'patient'
        ? catalogs.patients.map((option) => ({ id: option.id, label: option.fullName }))
        : field === 'specialization'
          ? catalogs.specializations.map((option) => ({ id: option.id, label: option.name }))
          : field === 'doctor'
            ? this.options().doctors.map((option) => ({ id: option.id, label: option.fullName }))
            : field === 'service'
              ? catalogs.services.map((option) => ({ id: option.id, label: option.name }))
              : [];

    return candidates.find((option) => option.label.trim().toLowerCase() === normalized) ?? null;
  }

  private textControlFor(field: AppointmentFormField): FormControl<string> | null {
    const controls = this.form.controls;

    switch (field) {
      case 'patient':
        return controls.patientText;
      case 'specialization':
        return controls.specializationText;
      case 'doctor':
        return controls.doctorText;
      case 'service':
        return controls.serviceText;
      default:
        return null;
    }
  }
}

function setControlValue(
  control: FormControl<string>,
  value: string,
  emitEvent: boolean
): void {
  if (control.value !== value) {
    control.setValue(value, { emitEvent });
  }
}

function toFormValue(raw: {
  readonly patientId?: string;
  readonly specializationId?: string;
  readonly doctorId?: string;
  readonly serviceId?: string;
  readonly officeId?: string;
  readonly date?: string;
  readonly timeSlot?: string;
}): AppointmentFormValue {
  return {
    patientId: raw.patientId ?? '',
    specializationId: raw.specializationId ?? '',
    doctorId: raw.doctorId ?? '',
    serviceId: raw.serviceId ?? '',
    officeId: raw.officeId ?? '',
    date: raw.date ?? '',
    timeSlot: raw.timeSlot ?? '',
  };
}

function sameValue(left: AppointmentFormValue, right: AppointmentFormValue): boolean {
  return (
    left.patientId === right.patientId &&
    left.specializationId === right.specializationId &&
    left.doctorId === right.doctorId &&
    left.serviceId === right.serviceId &&
    left.officeId === right.officeId &&
    left.date === right.date &&
    left.timeSlot === right.timeSlot
  );
}
