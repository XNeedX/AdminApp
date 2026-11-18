import { describe, expect, it } from 'vitest';

import { DoctorOption, ServiceOption } from '../models/appointment-catalog.model';
import { AppointmentFilterState } from '../models/appointment-filter.model';
import { AppointmentRow } from '../models/appointment.model';
import { DoctorStatus } from '../../doctors/models/doctor-form.model';
import { AppointmentFilterLookups, AppointmentFiltersService } from './appointment-filters.service';

const DOCTOR: DoctorOption = {
  id: 'doc-ivanov',
  firstName: 'Ivan',
  lastName: 'Ivanov',
  middleName: 'Ivanovich',
  fullName: 'Ivan Ivanov Ivanovich',
  specializationId: 'spec-cardio',
  specializationName: 'Cardiology',
  officeId: 'office-1',
  officeAddress: '1 Main St',
  status: DoctorStatus.AtWork,
};

const SERVICE: ServiceOption = {
  id: 'svc-ecg',
  name: 'ECG',
  specializationId: 'spec-cardio',
};

const LOOKUPS: AppointmentFilterLookups = {
  doctors: [DOCTOR],
  services: [SERVICE],
};

function state(overrides: Partial<AppointmentFilterState> = {}): AppointmentFilterState {
  return {
    date: '2026-11-20',
    doctorId: '',
    serviceId: '',
    status: 'all',
    officeId: '',
    hasGenerated: true,
    ...overrides,
  };
}

function row(id: string, doctorFullName: string): AppointmentRow {
  return {
    id,
    startTime: '2026-11-20T09:00:00',
    endTime: '2026-11-20T09:20:00',
    timeRangeLabel: '09:00 - 09:20',
    doctorFullName,
    patientFullName: 'Petrov Petr',
    patientPhoneNumber: '+10000000000',
    serviceName: 'ECG',
    isApproved: false,
    officeId: null,
    isApproving: false,
    isDeleting: false,
  };
}

describe('AppointmentFiltersService', () => {
  const service = new AppointmentFiltersService();

  it('serializes the date as yyyy-MM-dd', () => {
    expect(service.toParams(state({ date: '2026-12-01' }), LOOKUPS).date).toBe('2026-12-01');
  });

  it('omits isApproved for the All status', () => {
    const params = service.toParams(state({ status: 'all' }), LOOKUPS);

    expect('isApproved' in params).toBe(false);
  });

  it('sends isApproved=true for Approved', () => {
    expect(service.toParams(state({ status: 'approved' }), LOOKUPS).isApproved).toBe(true);
  });

  it('sends isApproved=false for Not Approved', () => {
    expect(service.toParams(state({ status: 'notApproved' }), LOOKUPS).isApproved).toBe(false);
  });

  it('narrows the doctor filter by surname', () => {
    expect(service.toParams(state({ doctorId: DOCTOR.id }), LOOKUPS).doctorName).toBe('Ivanov');
  });

  it('sends the exact service name', () => {
    expect(service.toParams(state({ serviceId: SERVICE.id }), LOOKUPS).serviceName).toBe('ECG');
  });

  it('sends the office id only when it is set', () => {
    expect(service.toParams(state({ officeId: 'office-1' }), LOOKUPS).officeId).toBe('office-1');
    expect('officeId' in service.toParams(state(), LOOKUPS)).toBe(false);
  });

  it('forwards every filter at once', () => {
    const params = service.toParams(
      state({
        date: '2026-11-21',
        doctorId: DOCTOR.id,
        serviceId: SERVICE.id,
        status: 'notApproved',
        officeId: 'office-1',
      }),
      LOOKUPS
    );

    expect(params).toEqual({
      date: '2026-11-21',
      doctorName: 'Ivanov',
      serviceName: 'ECG',
      isApproved: false,
      officeId: 'office-1',
    });
  });

  describe('refineByExactDoctor', () => {
    it('keeps only rows of the selected doctor', () => {
      const rows = [
        row('match', 'Ivanov Ivan Ivanovich'),
        row('same-surname', 'Ivanov Petr Ivanovich'),
        row('partial', 'Ivanov Ivan'),
      ];

      const refined = service.refineByExactDoctor(rows, DOCTOR);

      expect(refined.map((entry) => entry.id)).toEqual(['match']);
    });

    it('ignores case and extra whitespace', () => {
      const refined = service.refineByExactDoctor(
        [row('match', '  ivanov   IVAN   ivanovich ')],
        DOCTOR
      );

      expect(refined).toHaveLength(1);
    });

    it('matches a doctor without a middle name', () => {
      const withoutMiddle: DoctorOption = { ...DOCTOR, middleName: null };
      const refined = service.refineByExactDoctor(
        [row('match', 'Ivanov Ivan'), row('other', 'Ivanov Ivan Ivanovich')],
        withoutMiddle
      );

      expect(refined.map((entry) => entry.id)).toEqual(['match']);
    });

    it('returns every row when no doctor is selected', () => {
      const rows = [row('a', 'Ivanov Ivan Ivanovich')];

      expect(service.refineByExactDoctor(rows, null)).toBe(rows);
    });
  });
});
