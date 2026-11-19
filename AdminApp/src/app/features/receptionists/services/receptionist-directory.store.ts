import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { readApiAcknowledgment, readApiEnvelope } from '../../../api/api-envelope';
import { ReceptionistsService } from '../../../api/generated/profiles/services/receptionists.service';
import { extractErrorMessage } from '../../../core/interceptors/api-error.interceptor';
import { ReceptionistProfile, ReceptionistRow } from '../models/receptionist.model';
import { fullName } from '../utils/receptionist-presentation';
import { isPagedReceptionistRows } from './receptionist-contract.guards';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * Single owner of the receptionist directory.
 *
 * The backend list is paged; the application loads every page and exposes one table,
 * following the existing staff-directory convention.
 */
@Injectable({ providedIn: 'root' })
export class ReceptionistDirectoryStore {
  private readonly receptionists = inject(ReceptionistsService);

  readonly rows = signal<readonly ReceptionistRow[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  private inFlight: Promise<void> | null = null;

  /** Loads every page sequentially unless a load is already running. */
  loadAll(): Promise<void> {
    if (this.inFlight !== null) {
      return this.inFlight;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.inFlight = this.fetchAll().finally(() => {
      this.isLoading.set(false);
      this.inFlight = null;
    });

    return this.inFlight;
  }

  /** Deletes one profile and removes its row only after a successful acknowledgment. */
  async delete(id: string): Promise<boolean> {
    if (this.deletingId() !== null) {
      return false;
    }

    this.deletingId.set(id);
    this.deleteError.set(null);

    try {
      const payload = await firstValueFrom(this.receptionists.receptionistsIdDelete({ id }));
      readApiAcknowledgment(payload);
      this.rows.update((rows) => rows.filter((row) => row.id !== id));
      return true;
    } catch (error: unknown) {
      this.deleteError.set(toErrorMessage(error));
      return false;
    } finally {
      this.deletingId.set(null);
    }
  }

  private async fetchAll(): Promise<void> {
    const collected: ReceptionistProfile[] = [];

    try {
      let page = 1;
      let totalCount = 0;

      do {
        const payload = await firstValueFrom(
          this.receptionists.receptionistsGet({ page, pageSize: PAGE_SIZE }),
        );
        const result = readApiEnvelope(payload, isPagedReceptionistRows);

        collected.push(...result.data);
        totalCount = result.totalCount;

        if (result.data.length === 0) {
          break;
        }

        page += 1;
      } while (collected.length < totalCount && page <= MAX_PAGES);

      this.rows.set(collected.map(toRow));
    } catch (error: unknown) {
      this.rows.set([]);
      this.loadError.set(toErrorMessage(error));
    }
  }
}

function toRow(profile: ReceptionistProfile): ReceptionistRow {
  return {
    id: profile.id,
    fullName: fullName(profile),
    officeAddress: profile.officeAddress,
    photoPath: profile.photoPath,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return extractErrorMessage(error);
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
