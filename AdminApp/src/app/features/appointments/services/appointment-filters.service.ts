import { Injectable } from '@angular/core';

import { AppointmentsReceptionistGet$Params } from '../../../api/generated/appointments/fn/appointments/appointments-receptionist-get';
import { DoctorOption, ServiceOption } from '../models/appointment-catalog.model';
import { AppointmentFilterState } from '../models/appointment-filter.model';
import { AppointmentRow } from '../models/appointment.model';

const exactCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Catalog lookups needed to translate ids into the names the list endpoint filters on. */
export interface AppointmentFilterLookups {
  readonly doctors: readonly DoctorOption[];
  readonly services: readonly ServiceOption[];
}

/** Maps the filter panel state to the generated list-query parameters. */
@Injectable({ providedIn: 'root' })
export class AppointmentFiltersService {
  /**
   * `status: 'all'` omits `isApproved`; the doctor is narrowed by surname because the
   * endpoint matches first **or** last name as a substring.
   */
  toParams(
    state: AppointmentFilterState,
    lookups: AppointmentFilterLookups
  ): AppointmentsReceptionistGet$Params {
    const params: AppointmentsReceptionistGet$Params = {};

    if (state.date.length > 0) {
      // ФИКС ЗДЕСЬ: добавляем T00:00:00Z, чтобы бэкенд распознал дату как UTC
      params.date = state.date + 'T00:00:00Z';
    }

    if (state.doctorId.length > 0) {
      const doctor = lookups.doctors.find((option) => option.id === state.doctorId);

      if (doctor !== undefined) {
        params.doctorName = doctor.lastName;
      }
    }

    if (state.serviceId.length > 0) {
      const service = lookups.services.find((option) => option.id === state.serviceId);

      if (service !== undefined) {
        params.serviceName = service.name;
      }
    }

    if (state.status === 'approved') {
      params.isApproved = true;
    } else if (state.status === 'notApproved') {
      params.isApproved = false;
    }

    if (state.officeId.length > 0) {
      params.officeId = state.officeId;
    }

    return params;
  }

  /**
   * Keeps only the rows of the selected doctor.
   *
   * The API cannot match `"Surname Name Middle"` as one string, so the exact comparison
   * happens client-side after the substring narrowing.
   */
  refineByExactDoctor(
    rows: readonly AppointmentRow[],
    doctor: DoctorOption | null
  ): readonly AppointmentRow[] {
    if (doctor === null) {
      return rows;
    }

    const expected = [doctor.lastName, doctor.firstName, doctor.middleName ?? '']
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return rows.filter(
      (row) => exactCollator.compare(row.doctorFullName.replace(/\s+/g, ' ').trim(), expected) === 0
    );
  }
}