import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

/** Payload accepted by the shared cancel-confirmation dialog. */
export interface CancelConfirmDialogData {
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
}

/**
 * Dumb confirmation dialog opened through CDK `Dialog.open`.
 *
 * CDK supplies the backdrop, focus trap, `aria-modal` container and focus restoration.
 * Closing with `true` confirms the discard, `false` keeps the user in the current mode.
 */
@Component({
  selector: 'app-cancel-confirm-dialog',
  standalone: true,
  templateUrl: './cancel-confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelConfirmDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<CancelConfirmDialogData>(DIALOG_DATA);

  readonly message: string = this.data.message;
  readonly confirmText: string = this.data.confirmText ?? 'Yes';
  readonly cancelText: string = this.data.cancelText ?? 'No';

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
