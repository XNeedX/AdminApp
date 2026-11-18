import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { readApiAcknowledgment, readApiEnvelope } from '../../../api/api-envelope';
import { DoctorsService } from '../../../api/generated/profiles/services/doctors.service';
import { UpdateDoctorDto } from '../../../api/generated/profiles/models/update-doctor-dto';
import { extractErrorMessage } from '../../../core/interceptors/api-error.interceptor';
import { AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.model';
import {
  DoctorDirectoryEntry,
  DoctorFilterState,
  EMPTY_DOCTOR_FILTERS,
  distinctSortedValues,
  matchesNameQuery,
  sortByFullName,
} from '../models/doctor-directory.model';
import { DoctorStatus, isDoctorStatus } from '../models/doctor-form.model';
import {
  DoctorTableRow,
  isDoctorDetails,
  isPagedDoctorRows,
} from './doctor-contract.guards';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * Single owner of the doctor directory.
 *
 * The complete list is loaded once and every filter — including the office ↔
 * specialization cascade — is derived with `computed`, so there is no writable
 * derived state and therefore no feedback loop.
 */
@Injectable({ providedIn: 'root' })
export class DoctorDirectoryStore {
  private readonly doctors = inject(DoctorsService);

  readonly rows = signal<readonly DoctorDirectoryEntry[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  readonly nameQuery = signal<string>('');
  readonly selectedDoctorId = signal<string>('');
  readonly specialization = signal<string>('');
  readonly officeAddress = signal<string>('');

  readonly filterState = computed<DoctorFilterState>(() => ({
    nameQuery: this.nameQuery(),
    selectedDoctorId: this.selectedDoctorId(),
    specialization: this.specialization(),
    officeAddress: this.officeAddress(),
  }));

  /** Specializations available for the current office (or all when no office). */
  readonly specializationOptions = computed<readonly string[]>(() => {
    const office = this.officeAddress();

    return distinctSortedValues(
      this.rows()
        .filter((row) => office.length === 0 || row.officeAddress === office)
        .map((row) => row.specialization)
    );
  });

  /** Offices that actually employ the current specialization (or all). */
  readonly officeOptions = computed<readonly string[]>(() => {
    const specialization = this.specialization();

    return distinctSortedValues(
      this.rows()
        .filter((row) => specialization.length === 0 || row.specialization === specialization)
        .map((row) => row.officeAddress)
    );
  });

  readonly nameOptions = computed<readonly AutocompleteOption[]>(() =>
    sortByFullName(this.rows()).map((row) => ({ id: row.id, label: row.fullName }))
  );

  readonly visibleRows = computed<readonly DoctorDirectoryEntry[]>(() => {
    const query = this.nameQuery();
    const selectedId = this.selectedDoctorId();
    const specialization = this.specialization();
    const office = this.officeAddress();

    return this.rows().filter(
      (row) =>
        matchesNameQuery(row.fullName, query) &&
        (selectedId.length === 0 || row.id === selectedId) &&
        (specialization.length === 0 || row.specialization === specialization) &&
        (office.length === 0 || row.officeAddress === office)
    );
  });

  readonly hasActiveFilters = computed<boolean>(() => {
    const state = this.filterState();

    return (
      state.nameQuery.length > 0 ||
      state.selectedDoctorId.length > 0 ||
      state.specialization.length > 0 ||
      state.officeAddress.length > 0
    );
  });

  readonly isNarrowed = computed<boolean>(
    () => this.hasActiveFilters() && this.visibleRows().length !== this.rows().length
  );

  readonly isEmpty = computed<boolean>(
    () => !this.isLoading() && this.loadError() === null && this.visibleRows().length === 0
  );

  private inFlight: Promise<void> | null = null;

  constructor() {
    // Safety net for values that disappear after a reload: drop the value that the
    // other filter no longer offers. `applyFilters` resolves contradictions earlier,
    // based on which filter the user actually changed.
    effect(() => {
      const specialization = this.specialization();

      if (specialization.length > 0 && !this.specializationOptions().includes(specialization)) {
        this.specialization.set('');
      }
    });

    effect(() => {
      const office = this.officeAddress();

      if (office.length > 0 && !this.officeOptions().includes(office)) {
        this.officeAddress.set('');
      }
    });
  }

  /**
   * Applies a complete replacement state emitted by the dumb filter panel.
   *
   * When the user changes only one of the two cascade filters, the other one is kept
   * only if the pair still exists in the loaded directory; otherwise the older filter
   * is cleared. This makes the last change win without a feedback loop.
   */
  applyFilters(state: DoctorFilterState): void {
    const previous = this.filterState();
    const specializationChanged = state.specialization !== previous.specialization;
    const officeChanged = state.officeAddress !== previous.officeAddress;

    this.nameQuery.set(state.nameQuery);
    this.selectedDoctorId.set(state.selectedDoctorId);
    this.specialization.set(state.specialization);
    this.officeAddress.set(state.officeAddress);

    if (
      specializationChanged &&
      !officeChanged &&
      !this.offersSpecialization(state.officeAddress, state.specialization)
    ) {
      this.officeAddress.set('');
    } else if (
      officeChanged &&
      !specializationChanged &&
      !this.offersOffice(state.specialization, state.officeAddress)
    ) {
      this.specialization.set('');
    }
  }

  /** Clears every filter in one call. */
  clearFilters(): void {
    this.applyFilters(EMPTY_DOCTOR_FILTERS);
  }

  /** Loads every page once so the cascade has the complete mapping. */
  loadAll(): Promise<void> {
    if (this.inFlight !== null) {
      return this.inFlight;
    }

    this.inFlight = this.loadAllPages().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  /**
   * Persists a new status for one row.
   *
   * The value is patched optimistically and restored if either the profile read or
   * the update fails. `GET /Doctors/{id}` carries no status, so the status written
   * to the update body is the one the user selected — the body is otherwise complete.
   */
  async setStatus(id: string, next: DoctorStatus): Promise<void> {
    const current = this.rows().find((row) => row.id === id);

    if (current === undefined || current.status === next || current.isSavingStatus) {
      return;
    }

    const previousStatus = current.status;
    this.patchRow(id, { status: next, isSavingStatus: true });

    try {
      const detailsPayload = await firstValueFrom(this.doctors.doctorsIdGet({ id }));
      const details = readApiEnvelope(detailsPayload, isDoctorDetails);

      const body: UpdateDoctorDto = {
        photoPath: details.photoPath ?? null,
        firstName: details.firstName,
        lastName: details.lastName,
        middleName: details.middleName ?? null,
        dateOfBirth: details.dateOfBirth,
        specialization: details.specialization,
        officeAddress: details.officeAddress,
        careerStartYear: details.careerStartYear,
        status: next,
      };

      const acknowledgment = await firstValueFrom(this.doctors.doctorsIdPut({ id, body }));
      readApiAcknowledgment(acknowledgment);
      this.patchRow(id, { isSavingStatus: false });
    } catch (error: unknown) {
      this.patchRow(id, { status: previousStatus, isSavingStatus: false });
      throw error;
    }
  }

  /** `true` when the pair exists in the loaded directory (empty values never restrict). */
  private offersSpecialization(office: string, specialization: string): boolean {
    if (specialization.length === 0) {
      return true;
    }

    return this.rows().some(
      (row) =>
        (office.length === 0 || row.officeAddress === office) &&
        row.specialization === specialization
    );
  }

  /** `true` when the pair exists in the loaded directory (empty values never restrict). */
  private offersOffice(specialization: string, office: string): boolean {
    if (office.length === 0) {
      return true;
    }

    return this.rows().some(
      (row) =>
        (specialization.length === 0 || row.specialization === specialization) &&
        row.officeAddress === office
    );
  }

  private async loadAllPages(): Promise<void> {    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const collected: DoctorTableRow[] = [];
      let page = 1;
      let totalCount = 0;

      do {
        const payload = await firstValueFrom(
          this.doctors.doctorsDoctorsGet({ page, pageSize: PAGE_SIZE })
        );
        const current = readApiEnvelope(payload, isPagedDoctorRows);

        collected.push(...current.data);
        totalCount = current.totalCount;

        if (current.data.length === 0) {
          break;
        }

        page += 1;
      } while (collected.length < totalCount && page <= MAX_PAGES);

      this.rows.set(this.toEntries(collected));
    } catch (error: unknown) {
      this.rows.set([]);
      this.loadError.set(this.toErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private toEntries(rows: readonly DoctorTableRow[]): readonly DoctorDirectoryEntry[] {
    return rows.flatMap((row) => {
      const status = row.status;

      if (!isDoctorStatus(status)) {
        return [];
      }

      return [
        {
          id: row.id,
          fullName: row.fullName,
          specialization: row.specialization,
          officeAddress: row.officeAddress,
          dateOfBirth: row.dateOfBirth.slice(0, 10),
          status,
          isSavingStatus: false,
        },
      ];
    });
  }

  private patchRow(id: string, patch: Partial<DoctorDirectoryEntry>): void {
    this.rows.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'The doctors list could not be loaded. Please try again.';
  }
}
