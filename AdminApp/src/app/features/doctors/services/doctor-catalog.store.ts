import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { readApiEnvelope } from '../../../api/api-envelope';
import { OfficesService } from '../../../api/generated/appointments/services/offices.service';
import { SpecializationsService } from '../../../api/generated/appointments/services/specializations.service';
import { extractErrorMessage } from '../../../core/interceptors/api-error.interceptor';
import { AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.model';
import { isOfficeList, isSpecializationList } from './doctor-contract.guards';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Specialization and office catalogs used by the shared doctor form.
 *
 * Transport goes exclusively through the generated Appointments clients; the
 * catalogs are loaded once and cached for the lifetime of the application.
 */
@Injectable({ providedIn: 'root' })
export class DoctorCatalogStore {
  private readonly specializationsService = inject(SpecializationsService);
  private readonly officesService = inject(OfficesService);

  readonly specializations = signal<readonly AutocompleteOption[]>([]);
  readonly offices = signal<readonly AutocompleteOption[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private loaded = false;
  private inFlight: Promise<void> | null = null;

  /** Loads both catalogs unless they are already cached. */
  load(force = false): Promise<void> {
    if (!force && this.loaded) {
      return Promise.resolve();
    }

    if (this.inFlight !== null) {
      return this.inFlight;
    }

    this.inFlight = this.loadCatalogs().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async loadCatalogs(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const [specializationPayload, officePayload] = await Promise.all([
        firstValueFrom(this.specializationsService.specializationsGet()),
        firstValueFrom(this.officesService.officesGet()),
      ]);

      const specializations = readApiEnvelope(specializationPayload, isSpecializationList);
      const offices = readApiEnvelope(officePayload, isOfficeList);

      this.specializations.set(
        specializations
          .map((item) => ({ id: item.id, label: item.name }))
          .sort((left, right) => collator.compare(left.label, right.label))
      );
      this.offices.set(
        offices
          .map((item) => ({ id: item.id, label: item.address ?? item.id }))
          .sort((left, right) => collator.compare(left.label, right.label))
      );
      this.loaded = true;
    } catch (error: unknown) {
      this.error.set(this.toErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'The catalogs could not be loaded. Please try again.';
  }
}
