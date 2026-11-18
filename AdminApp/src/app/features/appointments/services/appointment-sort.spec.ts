import { describe, expect, it } from 'vitest';

import { AppointmentRow } from '../models/appointment.model';
import { sortAppointments } from './appointment-sort';

interface RowSeed {
  readonly id: string;
  readonly startTime: string;
  readonly doctorFullName: string;
  readonly serviceName?: string;
}

function makeRow(seed: RowSeed): AppointmentRow {
  return {
    id: seed.id,
    startTime: seed.startTime,
    endTime: seed.startTime,
    timeRangeLabel: '',
    doctorFullName: seed.doctorFullName,
    patientFullName: 'Petrov Petr',
    patientPhoneNumber: '+10000000000',
    serviceName: seed.serviceName ?? 'ECG',
    isApproved: false,
    officeId: null,
    isApproving: false,
    isDeleting: false,
  };
}

function ids(rows: readonly AppointmentRow[]): readonly string[] {
  return rows.map((row) => row.id);
}

describe('sortAppointments', () => {
  it('orders by start time first', () => {
    const rows = [
      makeRow({ id: 'late', startTime: '2026-11-20T11:00:00', doctorFullName: 'Ivanov Ivan' }),
      makeRow({ id: 'early', startTime: '2026-11-20T09:00:00', doctorFullName: 'Petrov Petr' }),
    ];

    expect(ids(sortAppointments(rows))).toEqual(['early', 'late']);
  });

  it('orders rows with the same time by doctor surname', () => {
    const rows = [
      makeRow({ id: 'sidorov', startTime: '2026-11-20T09:00:00', doctorFullName: 'Sidorov Sergey' }),
      makeRow({ id: 'ivanov', startTime: '2026-11-20T09:00:00', doctorFullName: 'Ivanov Ivan' }),
    ];

    expect(ids(sortAppointments(rows))).toEqual(['ivanov', 'sidorov']);
  });

  it('orders rows with the same surname by doctor first name', () => {
    const rows = [
      makeRow({ id: 'petr', startTime: '2026-11-20T09:00:00', doctorFullName: 'Ivanov Petr' }),
      makeRow({ id: 'ivan', startTime: '2026-11-20T09:00:00', doctorFullName: 'Ivanov Ivan' }),
    ];

    expect(ids(sortAppointments(rows))).toEqual(['ivan', 'petr']);
  });

  it('orders rows of the same doctor and time by service name', () => {
    const rows = [
      makeRow({
        id: 'mri',
        startTime: '2026-11-20T09:00:00',
        doctorFullName: 'Ivanov Ivan',
        serviceName: 'MRI',
      }),
      makeRow({
        id: 'ecg',
        startTime: '2026-11-20T09:00:00',
        doctorFullName: 'Ivanov Ivan',
        serviceName: 'ECG',
      }),
    ];

    expect(ids(sortAppointments(rows))).toEqual(['ecg', 'mri']);
  });

  it('compares names accent- and case-insensitively', () => {
    const rows = [
      makeRow({ id: 'accent', startTime: '2026-11-20T09:00:00', doctorFullName: 'Álvarez Ana' }),
      makeRow({ id: 'plain', startTime: '2026-11-20T09:00:00', doctorFullName: 'Alvarez Ana' }),
    ];

    expect(ids(sortAppointments(rows))).toEqual(['accent', 'plain']);
  });

  it('keeps the server order on a full tie', () => {
    const rows = [
      makeRow({ id: 'first', startTime: '2026-11-20T09:00:00', doctorFullName: 'Ivanov Ivan' }),
      makeRow({ id: 'second', startTime: '2026-11-20T09:00:00', doctorFullName: 'Ivanov Ivan' }),
    ];

    expect(ids(sortAppointments(rows))).toEqual(['first', 'second']);
  });

  it('does not mutate the input array', () => {
    const rows = [
      makeRow({ id: 'late', startTime: '2026-11-20T11:00:00', doctorFullName: 'Ivanov Ivan' }),
      makeRow({ id: 'early', startTime: '2026-11-20T09:00:00', doctorFullName: 'Ivanov Ivan' }),
    ];
    const before = ids(rows);

    sortAppointments(rows);

    expect(ids(rows)).toEqual(before);
  });
});
