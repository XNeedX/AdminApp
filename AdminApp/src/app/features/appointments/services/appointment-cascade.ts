import {
  AppointmentCatalogs,
  DoctorOption,
  OfficeOption,
  ServiceOption,
} from '../models/appointment-catalog.model';
import {
  AppointmentFormField,
  AppointmentFormValue,
  CascadeInput,
  CascadeOptions,
  CascadePlan,
  CascadeWrite,
} from '../models/appointment-form.model';

/** Maps a form field to the normalized value key it owns. */
const FIELD_KEYS: Readonly<Record<AppointmentFormField, keyof AppointmentFormValue>> = {
  patient: 'patientId',
  specialization: 'specializationId',
  doctor: 'doctorId',
  service: 'serviceId',
  office: 'officeId',
  date: 'date',
  timeSlot: 'timeSlot',
};

/** Upper bound for the fixed-point loop; the cascade converges in at most two passes. */
const MAX_PASSES = 5;

type MutableFormValue = { -readonly [K in keyof AppointmentFormValue]: AppointmentFormValue[K] };

function findById<T extends { readonly id: string }>(
  items: readonly T[],
  id: string
): T | null {
  if (id.length === 0) {
    return null;
  }

  return items.find((item) => item.id === id) ?? null;
}

function nonEmptyIds(
  doctors: readonly DoctorOption[],
  getter: (doctor: DoctorOption) => string | null
): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const doctor of doctors) {
    const id = getter(doctor);

    if (id !== null && id.length > 0) {
      ids.add(id);
    }
  }

  return ids;
}

/**
 * Computes the option set each combobox may display.
 *
 * The order is fixed — doctor, service, specialization, office — so a later filter can
 * only narrow a set that a stronger rule already constrained.
 */
export function buildCascadeOptions(input: {
  readonly value: AppointmentFormValue;
  readonly catalogs: AppointmentCatalogs;
  readonly availableDoctors: ReadonlySet<string> | null;
}): CascadeOptions {
  const { value, catalogs, availableDoctors } = input;

  const doctor = findById(catalogs.doctors, value.doctorId);
  const service = findById(catalogs.services, value.serviceId);
  const requiredSpecializationId =
    value.specializationId.length > 0
      ? value.specializationId
      : (service?.specializationId ?? '');

  const officeDoctorSpecializations =
    value.officeId.length > 0
      ? nonEmptyIds(
          catalogs.doctors.filter((candidate) => candidate.officeId === value.officeId),
          (candidate) => candidate.specializationId
        )
      : null;

  const availabilityResolved =
    availableDoctors !== null && value.date.length > 0 && value.timeSlot.length > 0;

  let doctors: readonly DoctorOption[] = catalogs.doctors.filter(
    (candidate) => candidate.status === 'At work'
  );

  if (value.specializationId.length > 0) {
    doctors = doctors.filter(
      (candidate) => candidate.specializationId === value.specializationId
    );
  }

  if (service !== null) {
    doctors = doctors.filter(
      (candidate) => candidate.specializationId === service.specializationId
    );
  }

  if (value.officeId.length > 0) {
    doctors = doctors.filter((candidate) => candidate.officeId === value.officeId);
  }

  if (availabilityResolved) {
    const available = availableDoctors;
    doctors = doctors.filter((candidate) => available.has(candidate.id));
  }

  let services: readonly ServiceOption[] = catalogs.services;

  if (requiredSpecializationId.length > 0) {
    services = services.filter(
      (candidate) => candidate.specializationId === requiredSpecializationId
    );
  }

  if (officeDoctorSpecializations !== null) {
    services = services.filter((candidate) =>
      officeDoctorSpecializations.has(candidate.specializationId)
    );
  }

  let specializations = catalogs.specializations;

  if (officeDoctorSpecializations !== null) {
    specializations = specializations.filter((candidate) =>
      officeDoctorSpecializations.has(candidate.id)
    );
  }

  if (doctor !== null) {
    specializations = specializations.filter(
      (candidate) => candidate.id === doctor.specializationId
    );
  }

  if (service !== null) {
    specializations = specializations.filter(
      (candidate) => candidate.id === service.specializationId
    );
  }

  let offices: readonly OfficeOption[] = catalogs.offices;

  if (doctor !== null) {
    const officeId = doctor.officeId;
    offices = officeId === null ? [] : offices.filter((candidate) => candidate.id === officeId);
  } else if (requiredSpecializationId.length > 0) {
    const officeIds = nonEmptyIds(
      catalogs.doctors.filter(
        (candidate) => candidate.specializationId === requiredSpecializationId
      ),
      (candidate) => candidate.officeId
    );

    offices = offices.filter((candidate) => officeIds.has(candidate.id));
  }

  return {
    patients: catalogs.patients,
    specializations,
    doctors,
    services,
    offices,
  };
}

/**
 * Pure implementation of the appointment form cascade.
 *
 * Clears are applied before auto-fills, the reducer never writes `lastEditedField`, and
 * the loop runs to a fixed point so the returned plan is always the complete set of
 * writes required to reach a consistent state. Applying the same input twice therefore
 * yields zero writes.
 */
export function reduceAppointmentCascade(input: CascadeInput): CascadePlan {
  const { catalogs, lastEditedField, availableDoctors } = input;
  const state: MutableFormValue = { ...input.value };

  const clear: CascadeWrite[] = [];
  const autoFill: CascadeWrite[] = [];

  const isWritable = (field: AppointmentFormField): boolean => field !== lastEditedField;

  const record = (bucket: CascadeWrite[], field: AppointmentFormField, value: string): void => {
    const existing = bucket.findIndex((write) => write.field === field);

    if (existing >= 0) {
      bucket.splice(existing, 1);
    }

    bucket.push({ field, value });
  };

  const clearField = (field: AppointmentFormField): boolean => {
    if (!isWritable(field)) {
      return false;
    }

    const key = FIELD_KEYS[field];

    if (state[key].length === 0) {
      return false;
    }

    state[key] = '';
    record(clear, field, '');

    return true;
  };

  const autoFillField = (field: AppointmentFormField, value: string): boolean => {
    if (!isWritable(field) || value.length === 0) {
      return false;
    }

    const key = FIELD_KEYS[field];

    if (state[key] === value) {
      return false;
    }

    state[key] = value;
    record(autoFill, field, value);

    return true;
  };

  const isDoctorAvailable = (): boolean =>
    availableDoctors !== null &&
    state.date.length > 0 &&
    state.timeSlot.length > 0 &&
    state.doctorId.length > 0;

  let doctorDroppedForAvailability = false;

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let changed = false;

    const doctor = findById(catalogs.doctors, state.doctorId);
    const service = findById(catalogs.services, state.serviceId);

    // C10 — a selection that disappeared from its catalog is dropped.
    if (state.patientId.length > 0 && findById(catalogs.patients, state.patientId) === null) {
      changed = clearField('patient') || changed;
    }

    if (
      state.specializationId.length > 0 &&
      findById(catalogs.specializations, state.specializationId) === null
    ) {
      changed = clearField('specialization') || changed;
    }

    if (state.doctorId.length > 0 && doctor === null) {
      changed = clearField('doctor') || changed;
    }

    if (state.serviceId.length > 0 && service === null) {
      changed = clearField('service') || changed;
    }

    if (state.officeId.length > 0 && findById(catalogs.offices, state.officeId) === null) {
      changed = clearField('office') || changed;
    }

    const currentDoctor = findById(catalogs.doctors, state.doctorId);
    const currentService = findById(catalogs.services, state.serviceId);

    // C1 — the doctor must belong to the chosen specialization.
    if (
      state.specializationId.length > 0 &&
      currentDoctor !== null &&
      currentDoctor.specializationId !== state.specializationId
    ) {
      changed = clearField('doctor') || changed;
    }

    // C2 — the service must belong to the chosen specialization.
    if (
      state.specializationId.length > 0 &&
      currentService !== null &&
      currentService.specializationId !== state.specializationId
    ) {
      changed = clearField('service') || changed;
    }

    // C3 — the doctor must work in the chosen office.
    if (
      state.officeId.length > 0 &&
      currentDoctor !== null &&
      currentDoctor.officeId !== null &&
      currentDoctor.officeId !== state.officeId
    ) {
      changed = clearField('doctor') || changed;
    }

    // C4 — an office must be able to host the chosen specialization/service.
    if (state.officeId.length > 0) {
      const officeDoctors = catalogs.doctors.filter(
        (candidate) => candidate.officeId === state.officeId
      );
      const officeSpecializations = nonEmptyIds(
        officeDoctors,
        (candidate) => candidate.specializationId
      );

      if (
        state.specializationId.length > 0 &&
        !officeSpecializations.has(state.specializationId)
      ) {
        let cleared = clearField('specialization');

        if (!cleared) {
          cleared = clearField('office');
        }

        changed = cleared || changed;
      }

      const officeService = findById(catalogs.services, state.serviceId);

      if (
        officeService !== null &&
        !officeSpecializations.has(officeService.specializationId)
      ) {
        let cleared = clearField('service');

        if (!cleared) {
          cleared = clearField('office');
        }

        changed = cleared || changed;
      }
    }

    // C5 — the doctor must be able to perform the chosen service.
    if (
      state.serviceId.length > 0 &&
      currentService !== null &&
      currentDoctor !== null &&
      currentDoctor.specializationId !== currentService.specializationId
    ) {
      changed = clearField('doctor') || changed;
    }

    // C9 — the doctor must be free at the chosen date and slot.
    if (
      isDoctorAvailable() &&
      availableDoctors !== null &&
      !availableDoctors.has(state.doctorId)
    ) {
      const cleared = clearField('doctor');
      doctorDroppedForAvailability = doctorDroppedForAvailability || cleared;
      changed = cleared || changed;
    }

    // C6/C7/C8 — derived value invalidation.
    if (
      state.doctorId.length === 0 &&
      state.timeSlot.length > 0 &&
      !doctorDroppedForAvailability
    ) {
      changed = clearField('timeSlot') || changed;
    }

    if (state.date.length === 0 && state.timeSlot.length > 0) {
      changed = clearField('timeSlot') || changed;
    }

    if (
      (state.specializationId.length === 0 || state.serviceId.length === 0) &&
      (state.date.length > 0 || state.timeSlot.length > 0)
    ) {
      const clearedDate = clearField('date');
      const clearedSlot = clearField('timeSlot');
      changed = clearedDate || clearedSlot || changed;
    }

    // A1/A2 — a chosen doctor determines the specialization and the office.
    const autoDoctor = findById(catalogs.doctors, state.doctorId);

    if (autoDoctor !== null) {
      changed =
        autoFillField('specialization', autoDoctor.specializationId) || changed;

      if (autoDoctor.officeId !== null) {
        changed = autoFillField('office', autoDoctor.officeId) || changed;
      }
    }

    // A3 — a chosen service determines the specialization.
    const autoService = findById(catalogs.services, state.serviceId);

    if (autoService !== null) {
      changed = autoFillField('specialization', autoService.specializationId) || changed;
    }

    // A4 — a single remaining doctor after the date/slot choice is selected.
    const options = buildCascadeOptions({ value: state, catalogs, availableDoctors });

    if (state.date.length > 0 && state.timeSlot.length > 0 && options.doctors.length === 1) {
      const onlyDoctor = options.doctors[0];

      if (onlyDoctor !== undefined) {
        const filled = autoFillField('doctor', onlyDoctor.id);

        if (filled) {
          changed =
            autoFillField('specialization', onlyDoctor.specializationId) || changed;

          if (onlyDoctor.officeId !== null) {
            changed = autoFillField('office', onlyDoctor.officeId) || changed;
          }
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  const options = buildCascadeOptions({ value: state, catalogs, availableDoctors });
  const hasPendingWrites = clear.length > 0 || autoFill.length > 0;

  return {
    options,
    autoFill,
    clear,
    dateEnabled: state.specializationId.length > 0 && state.serviceId.length > 0,
    slotsEnabled:
      state.specializationId.length > 0 &&
      state.serviceId.length > 0 &&
      state.date.length > 0,
    dateVisible: true,
    isComplete: isComplete(state, options) && !hasPendingWrites,
  };
}

function isComplete(value: AppointmentFormValue, options: CascadeOptions): boolean {
  if (
    value.patientId.length === 0 ||
    value.specializationId.length === 0 ||
    value.doctorId.length === 0 ||
    value.serviceId.length === 0 ||
    value.officeId.length === 0 ||
    value.date.length === 0 ||
    value.timeSlot.length === 0
  ) {
    return false;
  }

  const doctor = options.doctors.find((candidate) => candidate.id === value.doctorId);
  const service = options.services.find((candidate) => candidate.id === value.serviceId);

  if (doctor === undefined || service === undefined) {
    return false;
  }

  if (!options.patients.some((candidate) => candidate.id === value.patientId)) {
    return false;
  }

  if (!options.specializations.some((candidate) => candidate.id === value.specializationId)) {
    return false;
  }

  if (!options.offices.some((candidate) => candidate.id === value.officeId)) {
    return false;
  }

  if (doctor.specializationId !== value.specializationId) {
    return false;
  }

  if (service.specializationId !== value.specializationId) {
    return false;
  }

  return doctor.officeId === null || doctor.officeId === value.officeId;
}
