import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';

import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  DoctorCreateDialogComponent,
  DoctorCreateDialogResult,
} from '../../components/doctor-create-dialog/doctor-create-dialog.component';
import { DoctorFiltersComponent } from '../../components/doctor-filters/doctor-filters.component';
import { DoctorTableComponent } from '../../components/doctor-table/doctor-table.component';
import { DoctorFilterState } from '../../models/doctor-directory.model';
import { DoctorStatus } from '../../models/doctor-form.model';
import { DoctorDirectoryStore } from '../../services/doctor-directory.store';

/** Receptionist workspace: create, filter and maintain doctor profiles. */
@Component({
  selector: 'app-doctors-page',
  standalone: true,
  imports: [DoctorFiltersComponent, DoctorTableComponent],
  templateUrl: './doctors-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorsPageComponent implements OnInit {
  private readonly directory = inject(DoctorDirectoryStore);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = this.directory.visibleRows;
  protected readonly isLoading = this.directory.isLoading;
  protected readonly loadError = this.directory.loadError;
  protected readonly filterState = this.directory.filterState;
  protected readonly nameOptions = this.directory.nameOptions;
  protected readonly specializationOptions = this.directory.specializationOptions;
  protected readonly officeOptions = this.directory.officeOptions;
  protected readonly hasActiveFilters = this.directory.hasActiveFilters;

  protected readonly canChangeStatus = computed<boolean>(
    () => this.auth.user()?.roles.includes('Receptionist') ?? false
  );

  ngOnInit(): void {
    void this.directory.loadAll();
  }

  protected reload(): void {
    void this.directory.loadAll();
  }

  protected onFilterChange(state: DoctorFilterState): void {
    this.directory.applyFilters(state);
  }

  protected clearFilters(): void {
    this.directory.clearFilters();
  }

  protected async onStatusChange(event: {
    readonly id: string;
    readonly status: DoctorStatus;
  }): Promise<void> {
    try {
      await this.directory.setStatus(event.id, event.status);
      this.notifications.showSuccess(`Status changed to "${event.status}"`);
    } catch (error: unknown) {
      this.notifications.showError(this.toErrorMessage(error));
    }
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open<DoctorCreateDialogResult>(DoctorCreateDialogComponent, {
      disableClose: true,
      ariaLabel: 'Create doctor profile',
      restoreFocus: true,
      // Keeps the tall form inside the viewport on 375 px screens.
      width: 'min(48rem, calc(100vw - 2rem))',
      maxHeight: '90vh',
    });

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.created !== null && result?.created !== undefined) {
        this.notifications.showSuccess(`Doctor ${result.created.fullName} was created.`);
        void this.directory.loadAll();
      }
    });
  }

  protected openProfile(id: string): void {
    void this.router.navigate(['/doctors', id, 'profile']);
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
