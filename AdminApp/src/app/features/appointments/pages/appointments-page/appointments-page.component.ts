import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import { AppDialogService } from '../../../../shared/components/app-dialog/app-dialog.service';
import { AppointmentCreateModalComponent } from '../../components/appointment-create-modal/appointment-create-modal.component';
import { AppointmentFiltersComponent } from '../../components/appointment-filters/appointment-filters.component';
import { AppointmentTableComponent } from '../../components/appointment-table/appointment-table.component';
import {
  AppointmentCatalogs,
  EMPTY_APPOINTMENT_CATALOGS,
} from '../../models/appointment-catalog.model';
import {
  AppointmentFilterState,
  createEmptyFilterState,
} from '../../models/appointment-filter.model';
import { AppointmentRow } from '../../models/appointment.model';
import { AppointmentCatalogService } from '../../services/appointment-catalog.service';
import { AppointmentsFacadeService } from '../../services/appointments-facade.service';

/**
 * Receptionist appointments workspace.
 *
 * Owns the filter state and the create-modal visibility; rows, loading and error state
 * come from the facade. The table stays hidden until the first `Generate`.
 */
@Component({
  selector: 'app-appointments-page',
  standalone: true,
  imports: [AppointmentFiltersComponent, AppointmentTableComponent, AppointmentCreateModalComponent],
  templateUrl: './appointments-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsPageComponent implements OnInit {
  private readonly catalogService = inject(AppointmentCatalogService);
  private readonly facade = inject(AppointmentsFacadeService);
  private readonly dialogs = inject(AppDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly filters = signal<AppointmentFilterState>(createEmptyFilterState());
  protected readonly catalogs = signal<AppointmentCatalogs>(EMPTY_APPOINTMENT_CATALOGS);
  protected readonly isLoadingCatalogs = signal<boolean>(true);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly rescheduling = signal<AppointmentRow | null>(null);
  protected readonly isCreateOpen = signal<boolean>(false);

  protected readonly rows = this.facade.rows;
  protected readonly isLoading = this.facade.isLoading;
  protected readonly loadError = this.facade.loadError;

  constructor() {
    this.destroyRef.onDestroy(() => this.facade.clear());
  }

  ngOnInit(): void {
    this.loadCatalogs(false);
  }

  protected onGenerate(): void {
    this.filters.update((state) => ({ ...state, hasGenerated: true }));
    this.load();
  }

  protected onFiltersChange(next: AppointmentFilterState): void {
    this.filters.set({ ...next, hasGenerated: this.filters().hasGenerated });

    if (this.filters().hasGenerated) {
      this.load();
    }
  }

  protected onDateChange(date: string): void {
    this.filters.update((state) => ({ ...state, date }));

    if (this.filters().hasGenerated) {
      this.load();
    }
  }

  protected onCreateRequested(): void {
    this.isCreateOpen.set(true);
  }

  protected onRescheduleRequested(row: AppointmentRow): void {
    if (row.isApproved || row.booking === undefined || row.isApproving || row.isDeleting) {
      return;
    }

    this.rescheduling.set(row);
    this.isCreateOpen.set(true);
  }

  protected onAppointmentCreated(): void {
    if (this.filters().hasGenerated) {
      this.load();
    }
  }

  protected onModalClosed(): void {
    this.isCreateOpen.set(false);
    this.rescheduling.set(null);
  }

  protected onApprove(row: AppointmentRow): void {
    void this.facade.approve(row);
  }

  protected async onCancel(row: AppointmentRow): Promise<void> {
    const confirmed = await this.dialogs.confirmCancelAppointment();

    if (confirmed) {
      await this.facade.cancel(row);
    }
  }

  protected retryCatalogs(): void {
    this.loadCatalogs(true);
  }

  private load(): void {
    void this.facade.load(this.filters(), this.catalogs());
  }

  private loadCatalogs(force: boolean): void {
    this.isLoadingCatalogs.set(true);
    this.catalogError.set(null);

    this.catalogService
      .load(force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogs) => {
          this.catalogs.set(catalogs);
          this.isLoadingCatalogs.set(false);
        },
        error: (error: unknown) => {
          const message = this.toErrorMessage(error);
          this.catalogError.set(message);
          this.isLoadingCatalogs.set(false);
          this.notifications.showError(message);
        },
      });
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
