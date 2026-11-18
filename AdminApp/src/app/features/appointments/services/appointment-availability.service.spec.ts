import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleService } from '../../../api/generated/appointments/services/schedule.service';
import {
  AppointmentAvailabilityService,
  SlotLoadError,
} from './appointment-availability.service';

interface ScheduleParams {
  readonly doctorId?: string;
  readonly serviceId?: string;
  readonly date?: string;
}

interface ScheduleMock {
  readonly scheduleAvailableTimeSlotsGet: ReturnType<typeof vi.fn>;
}

function envelope(data: unknown): unknown {
  return { isSuccess: true, message: null, errors: [], data };
}

function slotsResponse(slots: readonly string[]): Observable<unknown> {
  return of(envelope(slots));
}

describe('AppointmentAvailabilityService', () => {
  let api: ScheduleMock;
  let service: AppointmentAvailabilityService;

  beforeEach(() => {
    api = {
      scheduleAvailableTimeSlotsGet: vi.fn((_params: ScheduleParams) =>
        slotsResponse(['09:00', '10:00'])
      ),
    };

    TestBed.configureTestingModule({
      providers: [AppointmentAvailabilityService, { provide: ScheduleService, useValue: api }],
    });

    service = TestBed.inject(AppointmentAvailabilityService);
  });

  it('requests the slots for the doctor, the service and the date', async () => {
    await firstValueFrom(service.getSlots('doc-1', 'svc-1', '2026-11-20'));

    expect(api.scheduleAvailableTimeSlotsGet).toHaveBeenCalledWith({
      doctorId: 'doc-1',
      serviceId: 'svc-1',
      date: '2026-11-20',
    });
  });

  it('treats an empty data array as no free slots', async () => {
    api.scheduleAvailableTimeSlotsGet.mockReturnValue(slotsResponse([]));

    await expect(firstValueFrom(service.getSlots('doc-1', 'svc-1', '2026-11-20'))).resolves.toEqual(
      []
    );
  });

  it('reuses a cached successful result', async () => {
    await firstValueFrom(service.getSlots('doc-1', 'svc-1', '2026-11-20'));
    await firstValueFrom(service.getSlots('doc-1', 'svc-1', '2026-11-20'));

    expect(api.scheduleAvailableTimeSlotsGet).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed request', async () => {
    api.scheduleAvailableTimeSlotsGet
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(slotsResponse(['09:00']));

    await expect(
      firstValueFrom(service.getSlots('doc-1', 'svc-1', '2026-11-20'))
    ).rejects.toThrow('offline');
    await expect(firstValueFrom(service.getSlots('doc-1', 'svc-1', '2026-11-20'))).resolves.toEqual([
      '09:00',
    ]);

    expect(api.scheduleAvailableTimeSlotsGet).toHaveBeenCalledTimes(2);
  });

  it('merges the candidate slots and removes duplicates', async () => {
    api.scheduleAvailableTimeSlotsGet.mockImplementation((params: ScheduleParams) =>
      slotsResponse(params.doctorId === 'doc-1' ? ['10:00', '09:00'] : ['11:00', '09:00'])
    );

    const slots = await firstValueFrom(
      service.getSlotsForCandidates(['doc-1', 'doc-2'], 'svc-1', '2026-11-20')
    );

    expect(slots).toEqual(['09:00', '10:00', '11:00']);
  });

  it('keeps the slots of healthy candidates when one probe fails', async () => {
    api.scheduleAvailableTimeSlotsGet.mockImplementation((params: ScheduleParams) =>
      params.doctorId === 'doc-1'
        ? throwError(() => new Error('offline'))
        : slotsResponse(['09:00'])
    );

    const slots = await firstValueFrom(
      service.getSlotsForCandidates(['doc-1', 'doc-2'], 'svc-1', '2026-11-20')
    );

    expect(slots).toEqual(['09:00']);
  });

  it('propagates an error only when every candidate probe failed', async () => {
    api.scheduleAvailableTimeSlotsGet.mockReturnValue(throwError(() => new Error('offline')));

    await expect(
      firstValueFrom(service.getSlotsForCandidates(['doc-1', 'doc-2'], 'svc-1', '2026-11-20'))
    ).rejects.toBeInstanceOf(SlotLoadError);
  });

  it('does not let one failed probe hide the doctors of the healthy probes', async () => {
    api.scheduleAvailableTimeSlotsGet.mockImplementation((params: ScheduleParams) => {
      if (params.doctorId === 'doc-1') {
        return throwError(() => new Error('offline'));
      }

      return slotsResponse(['09:00']);
    });

    const available = await firstValueFrom(
      service.getDoctorAvailability(['doc-1', 'doc-2'], 'svc-1', '2026-11-20', '09:00')
    );

    expect([...available]).toEqual(['doc-2']);
  });
});
