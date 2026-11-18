import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog, DialogRef } from '@angular/cdk/dialog';

import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { SpecializationFormComponent } from '../../components/specialization-form/specialization-form.component';
import { SpecializationFormValue } from '../../models/specialization.model';
import {
  EMPTY_WRITE_SESSION,
  SpecializationWriterService,
  WriteSessionState,
  unwrapWriteError,
  writeStateFromError,
} from '../../services/specialization-writer.service';

/** Reserved context for the creation dialog. */
export interface SpecializationCreateDialogData {
  readonly note?: string;
}

/** Result of a successful creation. */
export interface SpecializationCreateDialogResult {
  readonly id: string;
}

/** Message required by US2 AC-5..8 (must not be reworded). */
export const CANCEL_CREATE_DIALOG_MESSAGE =
  'Do you really want to cancel? Entered data will not be saved.';

const PARTIAL_FAILURE_NOTICE =
  'The specialization was saved, but some services could not be. Select "Confirm" again to finish without creating duplicates.';

/**
 * Smart host of the Create flow.
 *
 * Owns the create requests, the retry session and the dialog lifecycle; the form stays
 * dumb and only reports the entered value.
 */
@Component({
  selector: 'app-specialization-create-dialog',
  standalone: true,
  imports: [SpecializationFormComponent],
  templateUrl: './specialization-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecializationCreateDialogComponent {
  private readonly writer = inject(SpecializationWriterService);
  private readonly dialogRef =
    inject<DialogRef<SpecializationCreateDialogResult | null>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = 'Create specialization';
  readonly submitting = signal(false);
  readonly partialNotice = signal<string | null>(null);

  private writeState: WriteSessionState = EMPTY_WRITE_SESSION;

  onSubmit(value: SpecializationFormValue): void {
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);

    this.writer
      .create(value, this.writeState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.writeState = state;
          this.submitting.set(false);

          if (state.specializationId === null) {
            this.notifications.showError(
              'The specialization was created, but the API did not return its identifier.',
            );
            return;
          }

          this.notifications.showSuccess('Specialization created successfully');
          this.dialogRef.close({ id: state.specializationId });
        },
        error: (error: unknown) => {
          this.submitting.set(false);

          const partialState = writeStateFromError(error);

          if (partialState !== null) {
            this.writeState = partialState;
          }

          this.partialNotice.set(
            this.writeState.specializationId === null ? null : PARTIAL_FAILURE_NOTICE,
          );
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
      },
    );

    dialogRef.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed === true) {
        this.dialogRef.close(null);
      }
    });
  }

  private toErrorMessage(error: unknown): string {
    const cause = unwrapWriteError(error);

    if (cause instanceof HttpErrorResponse) {
      return extractErrorMessage(cause);
    }

    if (cause instanceof Error && cause.message.length > 0) {
      return cause.message;
    }

    return 'Could not save the specialization. Please try again.';
  }
}
