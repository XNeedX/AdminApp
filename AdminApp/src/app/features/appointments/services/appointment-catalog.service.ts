import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { readApiEnvelope } from '../../../api/api-envelope';
import { Status as AppointmentsStatus } from '../../../api/generated/appointments/models/status';
import { OfficesService } from '../../../api/generated/offices/services/offices.service';
import { ServicesService as AppointmentsServicesService } from '../../../api/generated/appointments/services/services.service';
import { DoctorsService as ProfilesDoctorsService } from '../../../api/generated/profiles/services/doctors.service';
import { Status as ServicesStatus } from '../../../api/generated/services/models/status';
import { SpecializationService } from '../../../api/generated/services/services/specialization.service';
import { DoctorStatus, isDoctorStatus } from '../../doctors/models/doctor-form.model';
import {
  AppointmentCatalogs,
  DoctorOption,
  OfficeOption,
  ServiceOption,
  SpecializationOption,
} from '../models/appointment-catalog.model';

const DOCTOR_PAGE_SIZE = 200;
const SPECIALIZATION_PAGE_SIZE = 100;

/** Narrowed office row; generated DTO fields are optional, these are not. */
interface OfficeRow {
  readonly id: string;
  readonly address?: string;
  readonly fullAddress?: string;
  readonly status?: AppointmentsStatus | string;
}

/** Narrowed ProfilesAPI doctor table row. */
interface DoctorRow {
  readonly id: string;
  readonly fullName: string;
  readonly specialization: string;
  readonly status: string;
  readonly officeAddress: string;
}

/** Narrowed specialization list row. */
interface SpecializationRow {
  readonly id: string;
  readonly name: string;
  readonly status?: ServicesStatus;
}

/** Narrowed specialization page. */
interface SpecializationPage {
  readonly items?: readonly SpecializationRow[];
}

/** Narrowed service of a specialization detail. */
interface ServiceRow {
  readonly id: string;
  readonly name: string;
  readonly status?: ServicesStatus;
}

/** Narrowed specialization detail. */
interface SpecializationDetail {
  readonly services?: readonly ServiceRow[];
}

/** Narrowed row of the Appointments API scheduling catalog. */
interface SchedulingServiceRow {
  readonly id: string;
  readonly status?: AppointmentsStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOffice(value: unknown): value is OfficeRow {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    (typeof value['address'] === 'string' || typeof value['fullAddress'] === 'string')
  );
}

function isOfficeList(value: unknown): value is readonly OfficeRow[] {
  return Array.isArray(value) && value.every(isOffice);
}

function extractOffices(payload: unknown): readonly OfficeRow[] {
  if (Array.isArray(payload)) {
    return payload.filter(isOffice);
  }
  if (isRecord(payload)) {
    const target = 'data' in payload && payload['data'] !== null ? payload['data'] : payload;
    if (Array.isArray(target)) {
      return target.filter(isOffice);
    }
    if (isRecord(target)) {
      const items = target['items'];
      if (Array.isArray(items)) {
        return items.filter(isOffice);
      }
    }
  }
  return [];
}

function isDoctorTableRow(value: unknown): value is DoctorRow {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['fullName'] === 'string' &&
    typeof value['specialization'] === 'string' &&
    typeof value['status'] === 'string' &&
    typeof value['officeAddress'] === 'string'
  );
}

function isDoctorPage(value: unknown): value is { readonly data?: readonly DoctorRow[] } {
  if (!isRecord(value) || !Array.isArray(value['data'])) {
    return false;
  }

  return value['data'].every(isDoctorTableRow);
}

function isSpecializationRow(value: unknown): value is SpecializationRow {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

function isSpecializationListPage(value: unknown): value is SpecializationPage {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    return false;
  }

  return value['items'].every(isSpecializationRow);
}

function isServiceRow(value: unknown): value is ServiceRow {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

function isSchedulingServiceRow(value: unknown): value is SchedulingServiceRow {
  return isRecord(value) && typeof value['id'] === 'string';
}

function isSchedulingServiceList(value: unknown): value is readonly SchedulingServiceRow[] {
  return Array.isArray(value) && value.every(isSchedulingServiceRow);
}

function isSpecializationDetail(value: unknown): value is SpecializationDetail {
  if (!isRecord(value) || typeof value['id'] !== 'string') {
    return false;
  }

  const services = value['services'];

  return services === undefined || (Array.isArray(services) && services.every(isServiceRow));
}

/** Normalizes an address so doctor→office matching ignores case and extra spacing. */
function normalizeAddress(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** `DoctorTableRowDto.FullName` is `First Last Middle`. */
function parseFullName(fullName: string): {
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
} {
  const tokens = fullName.trim().split(/\s+/).filter((token) => token.length > 0);
  const firstName = tokens[0] ?? '';
  const lastName = tokens[1] ?? '';
  const middleName = tokens.length > 2 ? tokens.slice(2).join(' ') : null;

  return { firstName, lastName, middleName };
}

/**
 * Loads and caches the catalogs the appointment form and filters need.
 *
 * Every request goes through a generated client. Doctor status and office come from the
 * ProfilesAPI receptionist table (the only authoritative source); appointments offices
 * supply the ids used by create/list; specialization→service links come from the
 * Services API. The Appointments API `/Services` catalog is also read so the form can
 * tell a schedulable service apart from one the schedule endpoint does not know about.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentCatalogService {
  private readonly officesApi = inject(OfficesService);
  private readonly doctorsApi = inject(ProfilesDoctorsService);
  private readonly specializationsApi = inject(SpecializationService);
  private readonly schedulingServicesApi = inject(AppointmentsServicesService);

  private cached: AppointmentCatalogs | null = null;
  private pending: Observable<AppointmentCatalogs> | null = null;

  /** Catalogs for the session; pass `force` to bypass the cache after a failure. */
  load(force = false): Observable<AppointmentCatalogs> {
    if (!force && this.cached !== null) {
      return of(this.cached);
    }

    if (!force && this.pending !== null) {
      return this.pending;
    }

    const request$ = forkJoin({
      offices: this.loadOffices(),
      doctors: this.loadDoctorRows(),
      specializations: this.loadSpecializations(),
      schedulableServiceIds: this.loadSchedulableServiceIds(),
    }).pipe(
      switchMap(({ offices, doctors, specializations, schedulableServiceIds }) =>
        this.loadServices(specializations).pipe(
          map((services) => ({
            offices,
            doctors,
            specializations,
            services,
            schedulableServiceIds,
          }))
        )
      ),
      map(({ offices, doctors, services, specializations, schedulableServiceIds }) => ({
        // Patient search is gated by the profiles patient endpoint (plan gate P-2).
        patients: [],
        offices,
        specializations,
        services,
        doctors: this.toDoctorOptions(doctors, offices, specializations),
        schedulableServiceIds,
      })),
      tap((catalogs) => {
        this.cached = catalogs;
        this.pending = null;
      }),
      catchError((error: unknown) => {
        this.pending = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.pending = request$;

    return request$;
  }

  private loadOffices(): Observable<readonly OfficeOption[]> {
    return this.officesApi.officesGet({ Page: 1, PageSize: 200 }).pipe(
      map((payload) => extractOffices(payload)),
      map((offices) =>
        offices
          .filter(
            (office) =>
              office.status === undefined ||
              office.status === AppointmentsStatus.Active ||
              office.status === 'Active'
          )
          .map((office) => {
            const address = office.fullAddress ?? office.address ?? office.id;
            return {
              id: office.id,
              address,
              displayName: address,
            };
          })
      )
    );
  }

  private loadDoctorRows(): Observable<readonly DoctorRow[]> {
    return this.doctorsApi.doctorsDoctorsGet({ page: 1, pageSize: DOCTOR_PAGE_SIZE }).pipe(
      map((payload) => readApiEnvelope(payload, isDoctorPage)),
      map((page) => page.data ?? []),
      map((rows) =>
        rows.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          specialization: row.specialization,
          status: row.status,
          officeAddress: row.officeAddress,
        }))
      )
    );
  }

  private loadSpecializations(): Observable<readonly SpecializationOption[]> {
    return this.specializationsApi
      .specializationGet({ Page: 1, PageSize: SPECIALIZATION_PAGE_SIZE })
      .pipe(
        map((payload) => readApiEnvelope(payload, isSpecializationListPage)),
        map((page) => page.items ?? []),
        map((items) =>
          items
            .filter((item) => item.status === undefined || item.status === ServicesStatus.Active)
            .map((item) => ({ id: item.id, name: item.name }))
        )
      );
  }

  private loadServices(
    specializations: readonly SpecializationOption[]
  ): Observable<readonly ServiceOption[]> {
    if (specializations.length === 0) {
      return of<readonly ServiceOption[]>([]);
    }

    return forkJoin(
      specializations.map((specialization) =>
        this.specializationsApi.specializationIdGet({ id: specialization.id }).pipe(
          map((payload) => readApiEnvelope(payload, isSpecializationDetail)),
          map((detail) => this.toServiceOptions(detail, specialization.id))
        )
      )
    ).pipe(map((groups) => groups.flat()));
  }

  /**
   * Ids the appointments schedule endpoint can resolve.
   *
   * A failure is degraded to `null` instead of failing the whole catalog load: the form
   * stays usable and falls back to querying the schedule.
   */
  private loadSchedulableServiceIds(): Observable<ReadonlySet<string> | null> {
    return this.schedulingServicesApi.servicesGet().pipe(
      map((payload) => readApiEnvelope(payload, isSchedulingServiceList)),
      map(
        (services) =>
          new Set(
            services
              .filter(
                (service) =>
                  service.status === undefined || service.status === AppointmentsStatus.Active
              )
              .map((service) => service.id)
          )
      ),
      catchError(() => of<ReadonlySet<string> | null>(null))
    );
  }

  private toServiceOptions(
    detail: SpecializationDetail,
    specializationId: string
  ): readonly ServiceOption[] {
    const services = detail.services ?? [];

    return services
      .filter((service) => service.status === undefined || service.status === ServicesStatus.Active)
      .map((service) => ({
        id: service.id,
        name: service.name,
        specializationId,
      }));
  }

  private toDoctorOptions(
    rows: readonly DoctorRow[],
    offices: readonly OfficeOption[],
    specializations: readonly SpecializationOption[]
  ): readonly DoctorOption[] {
    const officeByAddress = new Map<string, string>();

    for (const office of offices) {
      officeByAddress.set(normalizeAddress(office.address), office.id);
    }

    const specializationByName = new Map<string, SpecializationOption>();

    for (const specialization of specializations) {
      specializationByName.set(normalizeAddress(specialization.name), specialization);
    }

    const options: DoctorOption[] = [];

    for (const row of rows) {
      if (!isDoctorStatus(row.status) || row.status !== DoctorStatus.AtWork) {
        continue;
      }

      const specialization = specializationByName.get(normalizeAddress(row.specialization));

      // A doctor whose specialization is missing from the Services API cannot satisfy
      // the cascade, so the record is left out instead of offering an unusable option.
      if (specialization === undefined) {
        continue;
      }

      const { firstName, lastName, middleName } = parseFullName(row.fullName);
      const address = row.officeAddress.trim();
      const officeId =
        address.length > 0 ? officeByAddress.get(normalizeAddress(address)) ?? null : null;

      options.push({
        id: row.id,
        firstName,
        lastName,
        middleName,
        fullName: row.fullName.trim(),
        specializationId: specialization.id,
        specializationName: specialization.name,
        officeId,
        officeAddress: address.length > 0 ? address : null,
        status: row.status,
      });
    }

    return options;
  }
}
