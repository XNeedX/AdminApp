import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiContractError, readApiAcknowledgment, readApiEnvelope } from '../../../api/api-envelope';
import { AppointmentsService } from '../../../api/generated/appointments/services/appointments.service';
import { extractErrorMessage } from '../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../core/services/notification.service';
import { AppointmentCatalogs } from '../models/appointment-catalog.model';
import { AppointmentFilterState } from '../models/appointment-filter.model';
import { AppointmentRow } from '../models/appointment.model';
import { toTimeRangeLabel } from '../utils/appointment-date';
import { AppointmentFiltersService } from './appointment-filters.service';
import { sortAppointments } from './appointment-sort';

/** Payload accepted by the create command. */
export interface CreateAppointmentPayload {
  readonly patientId: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly officeId: string;
  readonly date: string;
  readonly timeSlot: string;
}

/** Result of a create attempt, mapped to the modal's reaction. */
export type CreateAppointmentOutcome =
  | { readonly kind: 'created' }
  | { readonly kind: 'slotConflict'; readonly message: string }
  | { readonly kind: 'patientInactive'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string };

interface AppointmentRowDto {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly doctorFullName: string;
  readonly patientFullName: string;
  readonly patientPhoneNumber: string;
  readonly serviceName: string;
  readonly isApproved: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAppointmentRowDto(value: unknown): value is AppointmentRowDto {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['startTime'] === 'string' &&
    typeof value['endTime'] === 'string' &&
    typeof value['doctorFullName'] === 'string' &&
    typeof value['patientFullName'] === 'string' &&
    typeof value['patientPhoneNumber'] === 'string' &&
    typeof value['serviceName'] === 'string' &&
    typeof value['isApproved'] === 'boolean'
  );
}

function isAppointmentListDto(value: unknown): value is readonly AppointmentRowDto[] {
  return Array.isArray(value) && value.every(isAppointmentRowDto);
}

/** Reads the human-readable message the backend put in the response body. */
function serverMessage(error: HttpErrorResponse): string | null {
  const body = error.error;

  if (!isRecord(body)) {
    return null;
  }

  const message = body['message'];

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  const errors = body['errors'];

  if (Array.isArray(errors)) {
    const first = errors.find((entry): entry is string => typeof entry === 'string');
    return first ?? null;
  }

  return null;
}

/**
 * Orchestrates every appointments command and query.
 *
 * All transport goes through the generated `AppointmentsService`; the facade is the only
 * place that maps HTTP failures to user-facing outcomes, so components stay free of
 * status-code logic.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsFacadeService {
  private readonly appointments = inject(AppointmentsService);
  private readonly filters = inject(AppointmentFiltersService);
  private readonly notifications = inject(NotificationService);

  private readonly rowsSignal = signal<readonly AppointmentRow[]>([]);
  private readonly isLoadingSignal = signal<boolean>(false);
  private readonly loadErrorSignal = signal<string | null>(null);

  private readonly approving = new Set<string>();
  private readonly deleting = new Set<string>();

  /** Guards against an older list response overwriting a newer one. */
  private requestSequence = 0;

  readonly rows = this.rowsSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();
  readonly isEmpty = computed(
    () => !this.isLoadingSignal() && this.loadErrorSignal() === null && this.rowsSignal().length === 0
  );

  /** Loads the filtered list, keeps previous rows on failure and ignores stale responses. */
  async load(
    filter: AppointmentFilterState,
    catalogs: AppointmentCatalogs
  ): Promise<void> {
    const sequence = (this.requestSequence += 1);
    this.isLoadingSignal.set(true);
    this.loadErrorSignal.set(null);

    try {
      const response = await firstValueFrom(
        this.appointments.appointmentsReceptionistGet(
          this.filters.toParams(filter, {
            doctors: catalogs.doctors,
            services: catalogs.services,
          })
        )
      );

      if (sequence !== this.requestSequence) {
        return;
      }

      const dtos = readApiEnvelope(response, isAppointmentListDto);
      const doctor = catalogs.doctors.find((option) => option.id === filter.doctorId) ?? null;
      const rows = dtos.map((dto) => this.toRow(dto, filter.officeId));
      const refined = this.filters.refineByExactDoctor(rows, doctor);

      this.rowsSignal.set(sortAppointments(refined));
    } catch (error: unknown) {
      if (sequence !== this.requestSequence) {
        return;
      }

      const message = this.toErrorMessage(error);
      this.loadErrorSignal.set(message);
      this.notifications.showError(message);
    } finally {
      if (sequence === this.requestSequence) {
        this.isLoadingSignal.set(false);
      }
    }
  }

  /** Creates the appointment; the modal decides how to react to each outcome. */
  async create(payload: CreateAppointmentPayload): Promise<CreateAppointmentOutcome> {
    try {
      const response = await firstValueFrom(
        this.appointments.appointmentsPatientIdPost({
          patientId: payload.patientId,
          body: {
            doctorId: payload.doctorId,
            serviceId: payload.serviceId,
            officeId: payload.officeId,
            date: payload.date,
            timeSlot: `${payload.date}T${payload.timeSlot}:00`,
          },
        })
      );

      readApiAcknowledgment(response);
      this.notifications.showSuccess('Appointment has been created');

      return { kind: 'created' };
    } catch (error: unknown) {
      return this.toCreateOutcome(error);
    }
  }

  /** Optimistically approves a row and reverts it when the server rejects the call. */
  async approve(row: AppointmentRow): Promise<void> {
    if (row.isApproved || this.approving.has(row.id)) {
      return;
    }

    this.approving.add(row.id);
    this.patchRow(row.id, { isApproved: true, isApproving: true });

    try {
      const response = await firstValueFrom(
        this.appointments.appointmentsIdApprovePatch({ id: row.id })
      );

      readApiAcknowledgment(response);
      this.patchRow(row.id, { isApproved: true, isApproving: false });
      this.notifications.showSuccess('Appointment has been approved');
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        // The server already holds the approval; lock the row and surface its message.
        this.patchRow(row.id, { isApproved: true, isApproving: false });
        this.notifications.showError(serverMessage(error) ?? extractErrorMessage(error));
      } else {
        this.patchRow(row.id, { isApproved: false, isApproving: false });
        this.notifications.showError(this.toErrorMessage(error));
      }
    } finally {
      this.approving.delete(row.id);
    }
  }

  /** Permanently deletes the appointment; the row is removed only on success. */
  async cancel(row: AppointmentRow): Promise<void> {
    if (this.deleting.has(row.id)) {
      return;
    }

    this.deleting.add(row.id);
    this.patchRow(row.id, { isDeleting: true });

    try {
      const response = await firstValueFrom(
        this.appointments.appointmentsIdDelete({ id: row.id })
      );

      readApiAcknowledgment(response);
      this.rowsSignal.update((rows) => rows.filter((entry) => entry.id !== row.id));
      this.notifications.showSuccess('Appointment has been cancelled');
    } catch (error: unknown) {
      this.notifications.showError(this.toErrorMessage(error));
    } finally {
      this.deleting.delete(row.id);
      this.patchRow(row.id, { isDeleting: false });
    }
  }

  /** Drops every row, for example when the page is left. */
  clear(): void {
    this.requestSequence += 1;
    this.rowsSignal.set([]);
    this.loadErrorSignal.set(null);
    this.isLoadingSignal.set(false);
  }

  private toRow(dto: AppointmentRowDto, officeId: string): AppointmentRow {
    return {
      id: dto.id,
      startTime: dto.startTime,
      endTime: dto.endTime,
      timeRangeLabel: toTimeRangeLabel(dto.startTime, dto.endTime),
      doctorFullName: dto.doctorFullName,
      patientFullName: dto.patientFullName,
      patientPhoneNumber: dto.patientPhoneNumber,
      serviceName: dto.serviceName,
      isApproved: dto.isApproved,
      officeId: officeId.length > 0 ? officeId : null,
      isApproving: false,
      isDeleting: false,
    };
  }

  private patchRow(id: string, patch: Partial<AppointmentRow>): void {
    this.rowsSignal.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  private toCreateOutcome(error: unknown): CreateAppointmentOutcome {
    if (error instanceof HttpErrorResponse) {
      const message = serverMessage(error) ?? extractErrorMessage(error);

      if (error.status === 400 && /time\s*slot/i.test(message)) {
        return {
          kind: 'slotConflict',
          message: 'The selected time slot is no longer available. Please choose another one.',
        };
      }

      if (error.status === 403) {
        return { kind: 'patientInactive', message };
      }

      return { kind: 'failed', message };
    }

    if (error instanceof ApiContractError) {
      return { kind: 'failed', message: error.message };
    }

    return { kind: 'failed', message: this.toErrorMessage(error) };
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof ApiContractError) {
      return 'The appointments service returned an unexpected response. Please try again.';
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }
}
