import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OfficesService } from '../../../api/generated/offices/services/offices.service';
import { ServicesService as AppointmentsServicesService } from '../../../api/generated/appointments/services/services.service';
import { DoctorsService as ProfilesDoctorsService } from '../../../api/generated/profiles/services/doctors.service';
import { SpecializationService } from '../../../api/generated/services/services/specialization.service';
import { AppointmentCatalogService } from './appointment-catalog.service';

interface SpecializationListParams {
  readonly Page?: number;
  readonly PageSize?: number;
}

interface SpecializationIdParams {
  readonly id: string;
}

interface ApiMock {
  readonly officesGet: ReturnType<typeof vi.fn>;
  readonly doctorsDoctorsGet: ReturnType<typeof vi.fn>;
  readonly specializationGet: ReturnType<typeof vi.fn>;
  readonly specializationIdGet: ReturnType<typeof vi.fn>;
  readonly servicesGet: ReturnType<typeof vi.fn>;
}

function envelope(data: unknown): unknown {
  return { isSuccess: true, message: null, errors: [], data };
}

const OFFICE = { id: 'office-1', address: '1 Main St', status: 0 };

const DOCTOR_ROW = {
  id: 'doc-1',
  fullName: 'Ivan Ivanov',
  specialization: 'Cardiology',
  status: 'At work',
  dateOfBirth: '1990-01-01T00:00:00',
  officeAddress: '1 Main St',
};

const SPECIALIZATION_ROW = { id: 'spec-1', name: 'Cardiology', status: 0 };

const SPECIALIZATION_DETAIL = {
  id: 'spec-1',
  name: 'Cardiology',
  status: 0,
  services: [
    { id: 'svc-synced', name: 'ECG', price: 10, status: 0, category: 1 },
    { id: 'svc-unsynced', name: 'Holter', price: 20, status: 0, category: 2 },
  ],
};

const SCHEDULING_SERVICE = { id: 'svc-synced', name: 'ECG', status: 0, category: 1 };

describe('AppointmentCatalogService scheduling catalog', () => {
  let api: ApiMock;
  let service: AppointmentCatalogService;

  beforeEach(() => {
    api = {
      officesGet: vi.fn((): Observable<unknown> => of(envelope([OFFICE]))),
      doctorsDoctorsGet: vi.fn(
        (_params: { page?: number; pageSize?: number }): Observable<unknown> =>
          of(envelope({ data: [DOCTOR_ROW], totalCount: 1 }))
      ),
      specializationGet: vi.fn(
        (_params: SpecializationListParams): Observable<unknown> =>
          of(envelope({ items: [SPECIALIZATION_ROW], totalCount: 1 }))
      ),
      specializationIdGet: vi.fn(
        (_params: SpecializationIdParams): Observable<unknown> =>
          of(envelope(SPECIALIZATION_DETAIL))
      ),
      servicesGet: vi.fn((): Observable<unknown> => of(envelope([SCHEDULING_SERVICE]))),
    };

    TestBed.configureTestingModule({
      providers: [
        AppointmentCatalogService,
        { provide: OfficesService, useValue: api },
        { provide: ProfilesDoctorsService, useValue: api },
        { provide: SpecializationService, useValue: api },
        { provide: AppointmentsServicesService, useValue: api },
      ],
    });

    service = TestBed.inject(AppointmentCatalogService);
  });

  it('marks the services present in the Appointments API catalog as schedulable', async () => {
    const catalogs = await firstValueFrom(service.load());

    expect(catalogs.services).toEqual([
      { id: 'svc-synced', name: 'ECG', specializationId: 'spec-1' },
      { id: 'svc-unsynced', name: 'Holter', specializationId: 'spec-1' },
    ]);
    expect(catalogs.schedulableServiceIds).not.toBeNull();
    expect([...(catalogs.schedulableServiceIds ?? [])]).toEqual(['svc-synced']);
    expect(catalogs.doctors).toHaveLength(1);
  });

  it('reports an empty scheduling catalog while keeping the Services API options visible', async () => {
    api.servicesGet.mockReturnValue(of(envelope([])));

    const catalogs = await firstValueFrom(service.load());

    expect(catalogs.services).toHaveLength(2);
    expect(catalogs.schedulableServiceIds?.size).toBe(0);
  });

  it('degrades to an unknown scheduling catalog when the request fails', async () => {
    api.servicesGet.mockReturnValue(throwError(() => new Error('offline')));

    const catalogs = await firstValueFrom(service.load());

    expect(catalogs.services).toHaveLength(2);
    expect(catalogs.schedulableServiceIds).toBeNull();
  });
});
