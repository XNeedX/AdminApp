import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';

import { ServiceService } from '../../../../api/generated/services/services/service.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { ServiceFormComponent } from '../../components/service-form/service-form.component';
import { ServiceFormValue, toCreateServiceRequest } from '../../models/service.model';

/** Context the specialization page passes to the creation dialog. */
export interface ServiceCreateDialogData {
  readonly specializationId: string;
}

/** Result of a successful creation. */
export interface ServiceCreateDialogResult {
  readonly id: string;
}

/** Message required by US1 AC-5 (must not be reworded). */
export const CANCEL_CREATE_DIALOG_MESSAGE =
  'Do you really want to cancel? Entered data will not be saved.';

/**
 * Smart host for the Create flow.
 *
 * Owns the create request, the dialog lifecycle and the cancel confirmation; the
 * reusable form stays dumb and only reports the entered value.
 */
@Component({
  selector: 'app-service-create-dialog',
  standalone: true,
  imports: [ServiceFormComponent],
  templateUrl: './service-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCreateDialogComponent {
  private readonly servicesApi = inject(ServiceService);
  private readonly dialogRef = inject<DialogRef<ServiceCreateDialogResult | null>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<ServiceCreateDialogData>(DIALOG_DATA);

  readonly submitting = signal(false);

  onSubmit(value: ServiceFormValue): void {
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);

    this.servicesApi
      .servicePost({ body: toCreateServiceRequest(value, this.data.specializationId) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);

          const id = response.data;
          if (typeof id !== 'string' || id.length === 0) {
            this.notifications.showError(
              'The service was created, but the API did not return its identifier.'
            );
            return;
          }

          this.dialogRef.close({ id });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.notifications.showError(this.toErrorMessage(error));
        },
      });
  }

  onCancel(): void {
    const dialogRef = this.dialog.open<boolean, CancelConfirmDialogData>(
      CancelConfirmDialogComponent,
      {
        data: { message: CANCEL_CREATE_DIALOG_MESSAGE },
        disableClose: true,
        ariaLabelledBy: 'cancel-confirm-dialog-message',
        restoreFocus: true,
      }
    );

    dialogRef.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed === true) {
        this.dialogRef.close(null);
      }
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return extractErrorMessage(error);
    }

    return 'Could not create the service. Please try again.';
  }
}
