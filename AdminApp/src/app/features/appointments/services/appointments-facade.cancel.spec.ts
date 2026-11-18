import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentsService } from '../../../api/generated/appointments/services/appointments.service';
import { NotificationService } from '../../../core/services/notification.service';
import { EMPTY_APPOINTMENT_CATALOGS } from '../models/appointment-catalog.model';
import { AppointmentFilterState } from '../models/appointment-filter.model';
import { AppointmentRow } from '../models/appointment.model';
import { AppointmentFiltersService } from './appointment-filters.service';
import { AppointmentsFacadeService } from './appointments-facade.service';

interface AppointmentsApiMock {
  readonly appointmentsReceptionistGet: ReturnType<typeof vi.fn>;
  readonly appointmentsIdApprovePatch: ReturnType<typeof vi.fn>;
  readonly appointmentsIdDelete: ReturnType<typeof vi.fn>;
  readonly appointmentsPatientIdPost: ReturnType<typeof vi.fn>;
}

interface NotificationMock {
  readonly showSuccess: ReturnType<typeof vi.fn>;
  readonly showError: ReturnType<typeof vi.fn>;
}

const FILTER: AppointmentFilterState = {
  date: '2026-11-20',
  doctorId: '',
  serviceId: '',
  status: 'all',
  officeId: '',
  hasGenerated: true,
};

const ROW = {
  id: 'appt-1',
  startTime: '2026-11-20T09:00:00',
  endTime: '2026-11-20T09:20:00',
  doctorFullName: 'Ivanov Ivan Ivanovich',
  patientFullName: 'Petrov Petr Petrovich',
  patientPhoneNumber: '+10000000000',
  serviceName: 'ECG',
  isApproved: false,
};

function envelope(data: unknown): unknown {
  return { isSuccess: true, message: null, errors: [], data };
}

describe('AppointmentsFacadeService cancellation', () => {
  let api: AppointmentsApiMock;
  let notifications: NotificationMock;
  let facade: AppointmentsFacadeService;

  beforeEach(() => {
    api = {
      appointmentsReceptionistGet: vi.fn(() => of(envelope([ROW]))),
      appointmentsIdApprovePatch: vi.fn(() => of(envelope(null))),
      appointmentsIdDelete: vi.fn(() => of(envelope(null))),
      appointmentsPatientIdPost: vi.fn(() => of(envelope(null))),
    };
    notifications = { showSuccess: vi.fn(), showError: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AppointmentsFacadeService,
        AppointmentFiltersService,
        { provide: AppointmentsService, useValue: api },
        { provide: NotificationService, useValue: notifications },
      ],
    });

    facade = TestBed.inject(AppointmentsFacadeService);
  });

  async function seedRows(rows: readonly unknown[] = [ROW]): Promise<AppointmentRow> {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope(rows)));
    await facade.load(FILTER, EMPTY_APPOINTMENT_CATALOGS);

    const row = facade.rows()[0];

    if (row === undefined) {
      throw new Error('The seeded row is missing.');
    }

    return row;
  }

  it('removes the row only after the delete succeeds', async () => {
    const response = new Subject<unknown>();
    api.appointmentsIdDelete.mockReturnValue(response.asObservable());
    const row = await seedRows();

    const deletion = facade.cancel(row);

    expect(api.appointmentsIdDelete).toHaveBeenCalledWith({ id: row.id });
    expect(facade.rows()[0]).toMatchObject({ isDeleting: true });
    expect(facade.rows()).toHaveLength(1);

    response.next(envelope(null));
    response.complete();
    await deletion;

    expect(facade.rows()).toHaveLength(0);
    expect(notifications.showSuccess).toHaveBeenCalledWith('Appointment has been cancelled');
  });

  it('ignores a second cancellation while the first one is in flight', async () => {
    const response = new Subject<unknown>();
    api.appointmentsIdDelete.mockReturnValue(response.asObservable());
    const row = await seedRows();

    const first = facade.cancel(row);
    const second = facade.cancel(row);

    expect(api.appointmentsIdDelete).toHaveBeenCalledTimes(1);

    response.next(envelope(null));
    response.complete();
    await Promise.all([first, second]);

    expect(api.appointmentsIdDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps the row with its prior data when the delete fails', async () => {
    api.appointmentsIdDelete.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { message: 'Internal Server Error' },
          })
      )
    );
    const row = await seedRows();

    await facade.cancel(row);

    expect(facade.rows()).toHaveLength(1);
    expect(facade.rows()[0]).toMatchObject({
      id: row.id,
      doctorFullName: row.doctorFullName,
      patientPhoneNumber: row.patientPhoneNumber,
      serviceName: row.serviceName,
      isDeleting: false,
    });
    expect(notifications.showError).toHaveBeenCalled();
    expect(notifications.showSuccess).not.toHaveBeenCalled();
  });

  it('reports the empty state after the last row is removed', async () => {
    const row = await seedRows([ROW]);

    expect(facade.isEmpty()).toBe(false);

    await facade.cancel(row);

    expect(facade.rows()).toHaveLength(0);
    expect(facade.isEmpty()).toBe(true);
  });

  it('allows an approved row to be cancelled', async () => {
    const row = await seedRows([{ ...ROW, isApproved: true }]);

    expect(row.isApproved).toBe(true);

    await facade.cancel(row);

    expect(facade.rows()).toHaveLength(0);
  });
});
