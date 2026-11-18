import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';

import { ServiceService } from '../../../../api/generated/services/services/service.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { ServiceFormComponent } from '../../components/service-form/service-form.component';
import { SERVICE_STATUS_OPTIONS } from '../../models/service-form.model';
import {
  ServiceFormValue,
  ServiceStatus,
  ServiceView,
  toEditStatusRequest,
  toServiceView,
  toUpdateServiceRequest,
} from '../../models/service.model';

/** Message required by US3 AC-5 (must not be reworded). */
export const CANCEL_EDIT_DIALOG_MESSAGE = 'Do you really want to cancel? Changes will not be saved.';

const SERVICE_NOT_FOUND_MESSAGE = 'Service not found.';

/**
 * Smart service information page.
 *
 * Owns the loaded service, the View/Edit mode signal, saving, status changes, dialogs
 * and notifications. The form itself stays dumb and is reused for Create and Edit.
 */
@Component({
  selector: 'app-service-info',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, ServiceFormComponent],
  templateUrl: './service-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceInfoComponent implements OnInit {
  private readonly servicesApi = inject(ServiceService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly service = signal<ServiceView | null>(null);
  readonly isEditMode = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly statusSaving = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly statusOptions = SERVICE_STATUS_OPTIONS;
  /** View-mode status group; kept in a control so rollbacks repaint the radios. */
  readonly statusControl = new FormControl<ServiceStatus>('Active', { nonNullable: true });

  constructor() {
    this.statusControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.changeStatus(status));

    // Single source of truth: the loaded/optimistically-updated service status.
    // Syncing in an effect (instead of inside the request handlers) keeps the radios
    // correct even when a rollback happens while the native `change` event is still
    // being processed, because `RadioControlRegistry` unchecks the group afterwards.
    effect(() => {
      const status = this.service()?.status;

      if (status !== undefined) {
        this.statusControl.setValue(status, { emitEvent: false });
      }
    });

    effect(() => {
      if (this.statusSaving()) {
        this.statusControl.disable({ emitEvent: false });
      } else {
        this.statusControl.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id === null || id.length === 0) {
      this.loadError.set(SERVICE_NOT_FOUND_MESSAGE);
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.servicesApi
      .serviceIdGet({ id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);

          if (response.data === undefined) {
            this.loadError.set(SERVICE_NOT_FOUND_MESSAGE);
            return;
          }

          try {
            this.service.set(toServiceView(response.data));
          } catch {
            this.loadError.set('The service data returned by the API is incomplete.');
          }
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.loadError.set(this.toLoadErrorMessage(error));
        },
      });
  }

  retry(): void {
    this.load();
  }

  enterEdit(): void {
    if (this.service() === null) {
      return;
    }

    this.isEditMode.set(true);
  }

  onSubmitted(value: ServiceFormValue): void {
    const current = this.service();

    if (current === null || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);

    this.servicesApi
      .serviceIdPut({ id: current.id, body: toUpdateServiceRequest(value) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.service.set({
            ...current,
            name: value.name.trim(),
            price: value.price,
            category: value.category,
            status: value.status,
          });
          this.isEditMode.set(false);
          this.notifications.showSuccess('Service updated successfully');
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.notifications.showError(this.toErrorMessage(error));
        },
      });
  }

  onCancelled(): void {
    const dialogRef = this.dialog.open<boolean, CancelConfirmDialogData>(
      CancelConfirmDialogComponent,
      {
        data: { message: CANCEL_EDIT_DIALOG_MESSAGE },
        disableClose: true,
        ariaLabelledBy: 'cancel-confirm-dialog-message',
        restoreFocus: true,
      }
    );

    dialogRef.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed === true) {
        this.isEditMode.set(false);
      }
    });
  }

  /**
   * View-mode status change: persists immediately with an optimistic update.
   * A failure restores the previously displayed status and reports the error.
   */
  changeStatus(next: ServiceStatus): void {
    const current = this.service();

    if (current === null || current.status === next || this.statusSaving()) {
      return;
    }

    const previous = current.status;
    this.service.set({ ...current, status: next });
    this.statusSaving.set(true);

    this.servicesApi
      .serviceIdStatusPatch({ id: current.id, body: toEditStatusRequest(next) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.statusSaving.set(false);
          this.notifications.showSuccess('Service status updated successfully');
        },
        error: (error: unknown) => {
          this.statusSaving.set(false);
          this.service.set({ ...current, status: previous });
          this.notifications.showError(this.toErrorMessage(error));
        },
      });
  }

  private toLoadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return SERVICE_NOT_FOUND_MESSAGE;
    }

    return this.toErrorMessage(error);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    return 'Could not save the service. Please try again.';
  }
}
