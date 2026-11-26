import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideApiConfiguration } from '../../../api/generated/appointments/api-configuration';
import { NotificationService } from '../../../core/services/notification.service';
import { EMPTY_APPOINTMENT_CATALOGS } from '../models/appointment-catalog.model';
import { createEmptyFilterState } from '../models/appointment-filter.model';
import { AppointmentsFacadeService } from './appointments-facade.service';

describe('AppointmentsFacadeService date and time', () => {
  let facade: AppointmentsFacadeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApiConfiguration('/appointments-api'),
        { provide: NotificationService, useValue: { showSuccess: vi.fn(), showError: vi.fn() } },
      ],
    });
    facade = TestBed.inject(AppointmentsFacadeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the selected calendar day and clinic-local slot as UTC values', async () => {
    const result = facade.create({
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      serviceId: 'service-1',
      officeId: 'office-1',
      date: '2036-11-25',
      timeSlot: '17:00',
    });

    const request = http.expectOne({ method: 'POST', url: '/appointments-api/Appointments/patient-1' });
    expect(request.request.body).toEqual({
      doctorId: 'doctor-1',
      serviceId: 'service-1',
      officeId: 'office-1',
      date: '2036-11-25T00:00:00Z',
      timeSlot: '2036-11-25T14:00:00.000Z',
    });
    request.flush({ isSuccess: true });
    await expect(result).resolves.toEqual({ kind: 'created' });
  });

  it('filters by the clinic date and displays the UTC response in clinic time', async () => {
    const filter = createEmptyFilterState(new Date('2036-11-24T22:30:00Z'));
    const result = facade.load(filter, EMPTY_APPOINTMENT_CATALOGS);

    const request = http.expectOne((req) => req.url === '/appointments-api/Appointments/receptionist');
    expect(request.request.params.get('date')).toBe('2036-11-25T00:00:00Z');
    request.flush({
      isSuccess: true,
      data: [
        {
          id: 'appointment-1',
          startTime: '2036-11-25T14:00:00Z',
          endTime: '2036-11-25T14:20:00Z',
          doctorFullName: 'Bennett Maya',
          patientFullName: 'Scott Ella',
          patientPhoneNumber: '+12025550120',
          serviceName: 'Dermoscopy',
          isApproved: false,
        },
      ],
    });

    await result;
    expect(facade.rows()[0]?.timeRangeLabel).toBe('17:00 - 17:20');
  });
});
