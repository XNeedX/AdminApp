import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';

import { SpecializationService } from '../../../../api/generated/services/services/specialization.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  ServiceListRow,
  SpecializationOption,
  toServiceListRows,
  toSpecializationHeader,
  toSpecializationOptions,
} from '../../models/service.model';
import { openServiceCreateDialog } from '../../utils/open-service-create-dialog';

const SPECIALIZATION_PAGE_SIZE = 50;

/**
 * Services tab: the Receptionist picks a specialization, then lists, creates and opens
 * the services that belong to it.
 *
 * The Services API has no "all services" endpoint, so the specialization is the list
 * context. Every request goes through the generated client.
 */
@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './services-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPageComponent implements OnInit {
  private readonly specializationsApi = inject(SpecializationService);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly specializations = signal<readonly SpecializationOption[]>([]);
  readonly selectedSpecializationId = signal('');
  readonly selectedSpecializationName = signal('');
  readonly rows = signal<readonly ServiceListRow[]>([]);
  readonly isLoadingSpecializations = signal(true);
  readonly isLoadingServices = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly servicesError = signal<string | null>(null);

  readonly hasSpecializations = computed(() => this.specializations().length > 0);
  readonly canCreate = computed(() => this.selectedSpecializationId().length > 0);

  /** Guards against an older specialization response overwriting a newer one. */
  private servicesRequestId = 0;

  ngOnInit(): void {
    this.loadSpecializations();
  }

  loadSpecializations(): void {
    this.isLoadingSpecializations.set(true);
    this.loadError.set(null);

    this.specializationsApi
      .specializationGet({ Page: 1, PageSize: SPECIALIZATION_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoadingSpecializations.set(false);

          const items = response.data?.items;
          if (!Array.isArray(items)) {
            this.loadError.set('The API returned an unexpected specializations payload.');
            return;
          }

          try {
            const options = toSpecializationOptions(items);
            this.specializations.set(options);

            const first = options[0];
            if (first !== undefined) {
              this.selectSpecialization(first.id);
            }
          } catch {
            this.loadError.set('The specialization data returned by the API is incomplete.');
          }
        },
        error: (error: unknown) => {
          this.isLoadingSpecializations.set(false);
          this.loadError.set(this.toErrorMessage(error));
        },
      });
  }

  onSpecializationChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectSpecialization(select.value);
  }

  selectSpecialization(id: string): void {
    this.selectedSpecializationId.set(id);
    this.selectedSpecializationName.set(
      this.specializations().find((option) => option.id === id)?.name ?? ''
    );
    this.servicesError.set(null);

    if (id.length === 0) {
      this.servicesRequestId += 1;
      this.rows.set([]);
      this.isLoadingServices.set(false);
      return;
    }

    this.loadServices(id);
  }

  loadServices(id: string): void {
    const requestId = (this.servicesRequestId += 1);
    this.isLoadingServices.set(true);
    this.servicesError.set(null);

    this.specializationsApi
      .specializationIdGet({ id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.servicesRequestId) {
            return;
          }

          this.isLoadingServices.set(false);

          if (response.data === undefined) {
            this.rows.set([]);
            this.servicesError.set('The specialization was not found.');
            return;
          }

          try {
            this.selectedSpecializationName.set(toSpecializationHeader(response.data).name);
            this.rows.set(toServiceListRows(response.data.services ?? []));
          } catch {
            this.rows.set([]);
            this.servicesError.set('The service data returned by the API is incomplete.');
          }
        },
        error: (error: unknown) => {
          if (requestId !== this.servicesRequestId) {
            return;
          }

          this.isLoadingServices.set(false);
          this.rows.set([]);
          this.servicesError.set(this.toErrorMessage(error));
        },
      });
  }

  retry(): void {
    this.loadSpecializations();
  }

  reloadServices(): void {
    const id = this.selectedSpecializationId();

    if (id.length > 0) {
      this.loadServices(id);
    }
  }

  openCreate(): void {
    const specializationId = this.selectedSpecializationId();

    if (specializationId.length === 0) {
      return;
    }

    openServiceCreateDialog(this.dialog, specializationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === null) {
          return;
        }

        this.notifications.showSuccess('Service created successfully');
        this.loadServices(specializationId);
      });
  }

  openService(id: string): void {
    void this.router.navigate(['/services', id]);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  }
}
