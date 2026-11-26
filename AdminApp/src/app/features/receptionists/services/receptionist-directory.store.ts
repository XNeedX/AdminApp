import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiContractError, readApiAcknowledgment } from '../../../api/api-envelope';
import { ReceptionistsService } from '../../../api/generated/profiles/services/receptionists.service';
import { extractErrorMessage } from '../../../core/interceptors/api-error.interceptor';
import { PagedReceptionistRows, ReceptionistRow } from '../models/receptionist.model';
import { readReceptionistPage } from './receptionist-contract.guards';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/** Shown when a page does not match the expected contract but earlier pages were loaded. */
const CONTRACT_ERROR_MESSAGE =
  'The receptionists service returned an unexpected response. Some entries may be missing.';

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

  /**
   * Fetches every page. Each page is validated and handled on its own so a contract
   * mismatch (or transport failure) on one page keeps the pages already loaded and is
   * reported as an error, instead of collapsing the table into a misleading empty state.
   */
  private async fetchAll(): Promise<void> {
    const collected: ReceptionistRow[] = [];
    let failure: string | null = null;
    let page = 1;
    let totalCount = 0;

    do {
      let result: PagedReceptionistRows;

      try {
        const payload = await firstValueFrom(
          this.receptionists.receptionistsGet({ page, pageSize: PAGE_SIZE }),
        );
        result = readReceptionistPage(payload);
      } catch (error: unknown) {
        failure =
          error instanceof ApiContractError
            ? contractFailureMessage(error, collected.length)
            : toErrorMessage(error);
        break;
      }

      collected.push(...result.data);
      totalCount = result.totalCount;

      if (result.data.length === 0) {
        break;
      }

      page += 1;
    } while (collected.length < totalCount && page <= MAX_PAGES);

    this.rows.set(collected);
    this.loadError.set(failure);
  }
}

/**
 * Message for a page that failed validation. `ApiContractError` covers both a server
 * `isSuccess: false` (which carries a useful backend message) and a genuinely malformed
 * payload; with rows already collected the message must say the list is partial.
 */
function contractFailureMessage(error: ApiContractError, rowsAlreadyLoaded: number): string {
  if (rowsAlreadyLoaded > 0) {
    return CONTRACT_ERROR_MESSAGE;
  }

  return error.message;
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
