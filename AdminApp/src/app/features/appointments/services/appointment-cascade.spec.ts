import { describe, expect, it } from 'vitest';

import { DoctorStatus } from '../../doctors/models/doctor-form.model';
import {
  AppointmentCatalogs,
  DoctorOption,
  OfficeOption,
  PatientOption,
  ServiceOption,
  SpecializationOption,
} from '../models/appointment-catalog.model';
import {
  AppointmentFormField,
  AppointmentFormValue,
  EMPTY_APPOINTMENT_FORM_VALUE,
} from '../models/appointment-form.model';
import { reduceAppointmentCascade } from './appointment-cascade';

const CARDIOLOGY: SpecializationOption = { id: 'spec-cardio', name: 'Cardiology' };
const NEUROLOGY: SpecializationOption = { id: 'spec-neuro', name: 'Neurology' };

const ECG: ServiceOption = { id: 'svc-ecg', name: 'ECG', specializationId: CARDIOLOGY.id };
const MRI: ServiceOption = { id: 'svc-mri', name: 'MRI', specializationId: NEUROLOGY.id };

const OFFICE_ONE: OfficeOption = { id: 'office-1', address: '1 Main St', displayName: '1 Main St' };
const OFFICE_TWO: OfficeOption = { id: 'office-2', address: '2 Main St', displayName: '2 Main St' };

const PATIENT: PatientOption = {
  id: 'pat-1',
  fullName: 'Petrov Petr Petrovich',
  phoneNumber: '+10000000000',
};

interface DoctorSeed {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly officeId: string | null;
  readonly officeAddress: string | null;
  readonly status?: DoctorStatus;
}

function makeDoctor(seed: DoctorSeed): DoctorOption {
  return {
    id: seed.id,
    firstName: seed.firstName,
    lastName: seed.lastName,
    middleName: null,
    fullName: `${seed.firstName} ${seed.lastName}`,
    specializationId: seed.specializationId,
    specializationName: seed.specializationName,
    officeId: seed.officeId,
    officeAddress: seed.officeAddress,
    status: seed.status ?? DoctorStatus.AtWork,
  };
}

const IVANOV = makeDoctor({
  id: 'doc-ivanov',
  firstName: 'Ivan',
  lastName: 'Ivanov',
  specializationId: CARDIOLOGY.id,
  specializationName: CARDIOLOGY.name,
  officeId: OFFICE_ONE.id,
  officeAddress: OFFICE_ONE.address,
});

const SIDOROV = makeDoctor({
  id: 'doc-sidorov',
  firstName: 'Sergey',
  lastName: 'Sidorov',
  specializationId: CARDIOLOGY.id,
  specializationName: CARDIOLOGY.name,
  officeId: OFFICE_TWO.id,
  officeAddress: OFFICE_TWO.address,
});

const PETROV = makeDoctor({
  id: 'doc-petrov',
  firstName: 'Petr',
  lastName: 'Petrov',
  specializationId: NEUROLOGY.id,
  specializationName: NEUROLOGY.name,
  officeId: OFFICE_TWO.id,
  officeAddress: OFFICE_TWO.address,
});

const NO_OFFICE = makeDoctor({
  id: 'doc-no-office',
  firstName: 'Oleg',
  lastName: 'Orlov',
  specializationId: CARDIOLOGY.id,
  specializationName: CARDIOLOGY.name,
  officeId: null,
  officeAddress: null,
});

const ON_VACATION = makeDoctor({
  id: 'doc-vacation',
  firstName: 'Viktor',
  lastName: 'Volkov',
  specializationId: CARDIOLOGY.id,
  specializationName: CARDIOLOGY.name,
  officeId: OFFICE_ONE.id,
  officeAddress: OFFICE_ONE.address,
  status: DoctorStatus.OnVacation,
});

function makeCatalogs(overrides: Partial<AppointmentCatalogs> = {}): AppointmentCatalogs {
  return {
    patients: [PATIENT],
    specializations: [CARDIOLOGY, NEUROLOGY],
    services: [ECG, MRI],
    doctors: [IVANOV, SIDOROV, PETROV, NO_OFFICE, ON_VACATION],
    offices: [OFFICE_ONE, OFFICE_TWO],
    schedulableServiceIds: new Set([ECG.id, MRI.id]),
    ...overrides,
  };
}

function makeInput(options: {
  readonly value?: Partial<AppointmentFormValue>;
  readonly catalogs?: AppointmentCatalogs;
  readonly lastEditedField?: AppointmentFormField | null;
  readonly availableDoctors?: ReadonlySet<string> | null;
} = {}) {
  return {
    value: { ...EMPTY_APPOINTMENT_FORM_VALUE, ...options.value },
    catalogs: options.catalogs ?? makeCatalogs(),
    lastEditedField: options.lastEditedField ?? null,
    availableDoctors: options.availableDoctors ?? null,
  };
}

const FIELD_KEYS: Readonly<Record<AppointmentFormField, keyof AppointmentFormValue>> = {
  patient: 'patientId',
  specialization: 'specializationId',
  doctor: 'doctorId',
  service: 'serviceId',
  office: 'officeId',
  date: 'date',
  timeSlot: 'timeSlot',
};

function applyPlan(
  value: AppointmentFormValue,
  plan: ReturnType<typeof reduceAppointmentCascade>
): AppointmentFormValue {
  const next: { -readonly [K in keyof AppointmentFormValue]: AppointmentFormValue[K] } = {
    ...value,
  };

  for (const write of [...plan.clear, ...plan.autoFill]) {
    next[FIELD_KEYS[write.field]] = write.value;
  }

  return next;
}

const DATE = '2026-11-20';
const SLOT = '09:00';

describe('reduceAppointmentCascade', () => {
  it('auto-fills specialization and office when a doctor with an office is selected', () => {
    const plan = reduceAppointmentCascade(
      makeInput({ value: { doctorId: IVANOV.id }, lastEditedField: 'doctor' })
    );

    expect(plan.clear).toHaveLength(0);
    expect(plan.autoFill).toContainEqual({ field: 'specialization', value: CARDIOLOGY.id });
    expect(plan.autoFill).toContainEqual({ field: 'office', value: OFFICE_ONE.id });
    expect(plan.autoFill.some((write) => write.field === 'doctor')).toBe(false);
    expect(plan.isComplete).toBe(false);
  });

  it('fills only the specialization when the doctor has no resolvable office', () => {
    const plan = reduceAppointmentCascade(
      makeInput({ value: { doctorId: NO_OFFICE.id }, lastEditedField: 'doctor' })
    );

    expect(plan.autoFill).toEqual([{ field: 'specialization', value: CARDIOLOGY.id }]);
    expect(plan.autoFill.some((write) => write.field === 'office')).toBe(false);
    expect(plan.isComplete).toBe(false);
  });

  it('clears the doctor when the chosen office does not host them', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: { doctorId: IVANOV.id, officeId: OFFICE_TWO.id },
        lastEditedField: 'office',
      })
    );

    expect(plan.clear).toContainEqual({ field: 'doctor', value: '' });
    expect(plan.autoFill.some((write) => write.field === 'doctor')).toBe(false);
  });

  it('clears the doctor when a service of another specialization is selected', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: { doctorId: IVANOV.id, serviceId: MRI.id },
        lastEditedField: 'service',
      })
    );

    expect(plan.clear).toContainEqual({ field: 'doctor', value: '' });
    expect(plan.autoFill).toContainEqual({ field: 'specialization', value: NEUROLOGY.id });
  });

  it('clears a mismatching doctor when another specialization is chosen', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: { doctorId: IVANOV.id, specializationId: NEUROLOGY.id },
        lastEditedField: 'specialization',
      })
    );

    expect(plan.clear).toContainEqual({ field: 'doctor', value: '' });
  });

  it('clears the date and the slot and disables the date when the specialization is cleared', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: {
          doctorId: IVANOV.id,
          specializationId: '',
          serviceId: '',
          date: DATE,
          timeSlot: SLOT,
        },
        lastEditedField: 'specialization',
      })
    );

    expect(plan.clear).toContainEqual({ field: 'date', value: '' });
    expect(plan.clear).toContainEqual({ field: 'timeSlot', value: '' });
    expect(plan.dateEnabled).toBe(false);
    expect(plan.slotsEnabled).toBe(false);
  });

  it('keeps the doctor but clears the date when only the service is cleared', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: {
          doctorId: IVANOV.id,
          specializationId: CARDIOLOGY.id,
          serviceId: '',
          date: DATE,
          timeSlot: SLOT,
        },
        lastEditedField: 'service',
      })
    );

    expect(plan.clear).toContainEqual({ field: 'date', value: '' });
    expect(plan.clear).toContainEqual({ field: 'timeSlot', value: '' });
    expect(plan.clear.some((write) => write.field === 'doctor')).toBe(false);
  });

  it('auto-fills the only available doctor and their office', () => {
    const value: AppointmentFormValue = {
      ...EMPTY_APPOINTMENT_FORM_VALUE,
      patientId: PATIENT.id,
      specializationId: CARDIOLOGY.id,
      serviceId: ECG.id,
      officeId: OFFICE_ONE.id,
      date: DATE,
      timeSlot: SLOT,
    };
    const availableDoctors = new Set<string>([IVANOV.id]);
    const plan = reduceAppointmentCascade(
      makeInput({ value, lastEditedField: 'timeSlot', availableDoctors })
    );

    expect(plan.autoFill).toContainEqual({ field: 'doctor', value: IVANOV.id });
    // The plan still carries the auto-fill, so completeness is reached only after the
    // store applies the writes and reduces the settled state again (contract §7).
    expect(plan.isComplete).toBe(false);

    const settled = reduceAppointmentCascade(
      makeInput({
        value: applyPlan(value, plan),
        lastEditedField: 'timeSlot',
        availableDoctors,
      })
    );

    expect(settled.clear).toHaveLength(0);
    expect(settled.autoFill).toHaveLength(0);
    expect(settled.isComplete).toBe(true);
    expect(settled.dateEnabled).toBe(true);
    expect(settled.slotsEnabled).toBe(true);
  });

  it('clears the doctor but keeps the slot when no doctor is available', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: {
          patientId: PATIENT.id,
          specializationId: CARDIOLOGY.id,
          doctorId: IVANOV.id,
          serviceId: ECG.id,
          officeId: OFFICE_ONE.id,
          date: DATE,
          timeSlot: SLOT,
        },
        availableDoctors: new Set<string>(),
      })
    );

    expect(plan.clear).toContainEqual({ field: 'doctor', value: '' });
    expect(plan.clear.some((write) => write.field === 'timeSlot')).toBe(false);
    expect(plan.isComplete).toBe(false);
  });

  it('is idempotent: applying a plan twice yields no further writes', () => {
    const value = { ...EMPTY_APPOINTMENT_FORM_VALUE, doctorId: IVANOV.id };
    const first = reduceAppointmentCascade(makeInput({ value, lastEditedField: 'doctor' }));
    const applied = applyPlan(value, first);
    const second = reduceAppointmentCascade(makeInput({ value: applied, lastEditedField: 'doctor' }));

    expect(first.autoFill.length).toBeGreaterThan(0);
    expect(second.clear).toHaveLength(0);
    expect(second.autoFill).toHaveLength(0);
  });

  it('drops a doctor that disappeared from the catalog', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: { doctorId: 'doc-gone', specializationId: CARDIOLOGY.id },
        lastEditedField: null,
      })
    );

    expect(plan.clear).toContainEqual({ field: 'doctor', value: '' });
    expect(plan.isComplete).toBe(false);
  });

  it('drops a specialization that disappeared from the catalog', () => {
    const plan = reduceAppointmentCascade(
      makeInput({
        value: { specializationId: 'spec-gone' },
        lastEditedField: null,
      })
    );

    expect(plan.clear).toContainEqual({ field: 'specialization', value: '' });
    expect(plan.dateEnabled).toBe(false);
  });

  it('offers only at-work doctors in the option lists', () => {
    const plan = reduceAppointmentCascade(makeInput());

    expect(plan.options.doctors.map((doctor) => doctor.id)).not.toContain(ON_VACATION.id);
    expect(plan.options.doctors.map((doctor) => doctor.id)).toContain(IVANOV.id);
  });

  it('narrows services to the selected doctor specialization', () => {
    const plan = reduceAppointmentCascade(
      makeInput({ value: { doctorId: IVANOV.id }, lastEditedField: 'doctor' })
    );

    expect(plan.options.services.map((service) => service.id)).toEqual([ECG.id]);
    expect(plan.options.specializations.map((specialization) => specialization.id)).toEqual([
      CARDIOLOGY.id,
    ]);
  });
});
