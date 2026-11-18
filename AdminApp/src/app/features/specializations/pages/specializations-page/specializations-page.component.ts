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
  SpecializationListRow,
  sortBySpecializationName,
  toSpecializationListRows,
  toSpecializationStatusRequest,
} from '../../models/specialization.model';
import {
  SpecializationStatusChange,
  SpecializationTableComponent,
} from '../../components/specialization-table/specialization-table.component';
import { openSpecializationCreateDialog } from '../../utils/open-specialization-create-dialog';

const SPECIALIZATION_PAGE_SIZE = 200;

/**
 * Smart specializations list page.
 *
 * Owns loading, ordering, retryable errors, the create dialog and immediate status
 * changes. Status cascade is backend-only; this page only calls the generated PATCH.
 */
@Component({
  selector: 'app-specializations-page',
  standalone: true,
  imports: [SpecializationTableComponent],
  templateUrl: './specializations-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecializationsPageComponent implements OnInit {
  private readonly specializationsApi = inject(SpecializationService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = signal<readonly SpecializationListRow[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly statusSavingId = signal<string | null>(null);

  readonly isEmpty = computed(
    () => !this.isLoading() && this.loadError() === null && this.rows().length === 0,
  );

  /** Guards against an older list response overwriting newer local state. */
  private requestId = 0;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const requestId = ++this.requestId;

    this.isLoading.set(true);
    this.loadError.set(null);

    this.specializationsApi
      .specializationGet({ Page: 1, PageSize: SPECIALIZATION_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.isLoading.set(false);

          const items = response.data?.items;

          if (!Array.isArray(items)) {
            this.loadError.set('The API returned an unexpected specializations payload.');
            return;
          }

          try {
            this.rows.set(sortBySpecializationName(toSpecializationListRows(items)));
          } catch {
            this.loadError.set('The specialization data returned by the API is incomplete.');
          }
        },
        error: (error: unknown) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.isLoading.set(false);
          this.loadError.set(
            this.toErrorMessage(error, 'Could not load the specializations. Please try again.'),
          );
        },
      });
  }

  retry(): void {
    this.load();
  }

  onOpen(id: string): void {
    void this.router.navigate(['/specializations', id]);
  }

  onCreate(): void {
    openSpecializationCreateDialog(this.dialog)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result !== null) {
          this.load();
        }
      });
  }

  /**
   * Immediate status change with an optimistic update; a failure restores the previous
   * value and reports the error. No cascade logic runs in the browser (US5).
   */
  onStatusChange(change: SpecializationStatusChange): void {
    const row = this.rows().find((entry) => entry.id === change.id);

    if (row === undefined || row.status === change.status || this.statusSavingId() !== null) {
      return;
    }

    const previous = row.status;

    this.rows.update((rows) =>
      rows.map((entry) => (entry.id === change.id ? { ...entry, status: change.status } : entry)),
    );
    this.statusSavingId.set(change.id);

    this.specializationsApi
      .specializationIdStatusPatch({
        id: change.id,
        body: toSpecializationStatusRequest(change.status),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.statusSavingId.set(null);
          this.notifications.showSuccess('Specialization status updated successfully');
        },
        error: (error: unknown) => {
          this.statusSavingId.set(null);
          this.rows.update((rows) =>
            rows.map((entry) => (entry.id === change.id ? { ...entry, status: previous } : entry)),
          );
          this.notifications.showError(
            this.toErrorMessage(
              error,
              'Could not update the specialization status. Please try again.',
            ),
          );
        },
      });
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    return fallback;
  }
}
