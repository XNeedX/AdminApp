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

const FIRST_ROW = {
  id: 'appt-1',
  startTime: '2026-11-20T09:00:00',
  endTime: '2026-11-20T09:20:00',
  doctorFullName: 'Ivanov Ivan Ivanovich',
  patientFullName: 'Petrov Petr Petrovich',
  patientPhoneNumber: '+10000000000',
  serviceName: 'ECG',
  isApproved: false,
};

const SECOND_ROW = {
  ...FIRST_ROW,
  id: 'appt-2',
  startTime: '2026-11-20T10:00:00',
  endTime: '2026-11-20T10:20:00',
  doctorFullName: 'Sidorov Sergey Sergeevich',
};

function envelope(data: unknown): unknown {
  return { isSuccess: true, message: null, errors: [], data };
}

describe('AppointmentsFacadeService approval', () => {
  let api: AppointmentsApiMock;
  let notifications: NotificationMock;
  let facade: AppointmentsFacadeService;

  beforeEach(() => {
    api = {
      appointmentsReceptionistGet: vi.fn(() => of(envelope([FIRST_ROW, SECOND_ROW]))),
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

  async function seedRows(rows: readonly unknown[] = [FIRST_ROW, SECOND_ROW]): Promise<AppointmentRow> {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope(rows)));
    await facade.load(FILTER, EMPTY_APPOINTMENT_CATALOGS);

    const row = facade.rows()[0];

    if (row === undefined) {
      throw new Error('The seeded row is missing.');
    }

    return row;
  }

  it('marks the row approved optimistically and locks it after success', async () => {
    const response = new Subject<unknown>();
    api.appointmentsIdApprovePatch.mockReturnValue(response.asObservable());
    const row = await seedRows();

    const approval = facade.approve(row);

    expect(facade.rows()[0]).toMatchObject({ isApproved: true, isApproving: true });

    response.next(envelope(null));
    response.complete();
    await approval;

    expect(api.appointmentsIdApprovePatch).toHaveBeenCalledWith({ id: row.id });
    expect(facade.rows()[0]).toMatchObject({ isApproved: true, isApproving: false });
    expect(notifications.showSuccess).toHaveBeenCalledWith('Appointment has been approved');
  });

  it('ignores a second approval while the first one is in flight', async () => {
    const response = new Subject<unknown>();
    api.appointmentsIdApprovePatch.mockReturnValue(response.asObservable());
    const row = await seedRows();

    const first = facade.approve(row);
    const second = facade.approve(row);

    expect(api.appointmentsIdApprovePatch).toHaveBeenCalledTimes(1);

    response.next(envelope(null));
    response.complete();
    await Promise.all([first, second]);

    expect(api.appointmentsIdApprovePatch).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic state and notifies when approval fails', async () => {
    api.appointmentsIdApprovePatch.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { message: 'Internal Server Error' },
          })
      )
    );
    const row = await seedRows();

    await facade.approve(row);

    expect(facade.rows()[0]).toMatchObject({ isApproved: false, isApproving: false });
    expect(notifications.showError).toHaveBeenCalled();
    expect(notifications.showSuccess).not.toHaveBeenCalled();
  });

  it('keeps the row approved when the server reports an already approved appointment', async () => {
    api.appointmentsIdApprovePatch.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'The appointment has already been approved.' },
          })
      )
    );
    const row = await seedRows();

    await facade.approve(row);

    expect(facade.rows()[0]).toMatchObject({ isApproved: true, isApproving: false });
    expect(notifications.showError).toHaveBeenCalledWith(
      'The appointment has already been approved.'
    );
  });

  it('does not reorder the rows after approval', async () => {
    const row = await seedRows();
    const orderBefore = facade.rows().map((entry) => entry.id);

    await facade.approve(row);

    expect(facade.rows().map((entry) => entry.id)).toEqual(orderBefore);
  });
});
