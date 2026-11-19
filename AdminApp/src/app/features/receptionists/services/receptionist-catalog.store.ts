import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { readApiEnvelope } from '../../../api/api-envelope';
import { OfficesService } from '../../../api/generated/offices/services/offices.service';
import { OfficeOption } from '../models/receptionist.model';
import { extractOfficeList } from './receptionist-contract.guards';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Office catalog used by the create dialog and the profile edit mode.
 *
 * Transport goes exclusively through the generated Appointments client; the catalog is
 * loaded once and cached for the lifetime of the application.
 */
@Injectable({ providedIn: 'root' })
export class ReceptionistCatalogStore {
  private readonly officesService = inject(OfficesService);

  readonly offices = signal<readonly OfficeOption[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  private loaded = false;
  private inFlight: Promise<void> | null = null;

  /** Loads the office catalog unless it is already cached. */
  load(force = false): Promise<void> {
    if (this.loaded && !force) {
      return Promise.resolve();
    }

    if (this.inFlight !== null) {
      return this.inFlight;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.inFlight = this.fetch().finally(() => {
      this.isLoading.set(false);
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async fetch(): Promise<void> {
    try {
      const payload = await firstValueFrom(this.officesService.officesGet({ Page: 1, PageSize: 200 }));
      const offices = extractOfficeList(payload);

      this.offices.set(
        offices
          .filter((item) => item.status === undefined || item.status === 'Active' || item.status === 0)
          .map((item) => ({ id: item.id, label: item.fullAddress ?? item.address ?? item.id }))
          .sort((left, right) => collator.compare(left.label, right.label)),
      );
      this.loaded = true;
    } catch (error: unknown) {
      this.loadError.set(toErrorMessage(error));
    }
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'The office list could not be loaded.';
}
