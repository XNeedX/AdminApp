import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { AppDialogComponent } from './app-dialog.component';

/** Message data accepted by the shared confirmation dialog. */
export interface AppConfirmDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmText: string;
  readonly cancelText: string;
}

/**
 * Generic Yes/No confirmation hosted in a CDK dialog.
 *
 * Only the buttons resolve it with `true`/`false`; Escape resolves to `false` so a
 * confirmation can never delete or discard silently, and the returned promise always
 * settles.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [AppDialogComponent],
  templateUrl: './app-confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppConfirmDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<AppConfirmDialogData>(DIALOG_DATA);

  @HostListener('keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    event.preventDefault();
    this.cancel();
  }

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
