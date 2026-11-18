import { Injectable, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';

import { AppConfirmDialogComponent, AppConfirmDialogData } from './app-confirm-dialog.component';

/** Exact copy required by the appointment spec. */
export const EXIT_APPOINTMENT_MESSAGE =
  'Do you really want to exit? Appointment will not be saved.';

/** Exact copy required by the appointment spec. */
export const CANCEL_APPOINTMENT_MESSAGE =
  'Do you really want to cancel the appointment? It will be permanently deleted.';

/**
 * Opens the shared dialogs used by the appointments feature.
 *
 * Every confirmation is hosted by `@angular/cdk/dialog`, so focus is trapped, focus is
 * restored to the triggering control, and Escape resolves to `false`.
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialog = inject(Dialog);

  /** Opens a Yes/No confirmation and resolves `true` only when the user confirms. */
  confirm(data: AppConfirmDialogData): Promise<boolean> {
    const dialogRef = this.dialog.open<boolean, AppConfirmDialogData>(AppConfirmDialogComponent, {
      data,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      disableClose: true,
      backdropClass: 'bg-gray-900/50',
      panelClass: ['w-full', 'max-w-md'],
    });

    return firstValueFrom(dialogRef.closed).then((result) => result === true);
  }

  /** `Do you really want to exit? Appointment will not be saved.` */
  confirmExit(): Promise<boolean> {
    return this.confirm({
      title: 'Exit',
      message: EXIT_APPOINTMENT_MESSAGE,
      confirmText: 'Yes',
      cancelText: 'No',
    });
  }

  /** `Do you really want to cancel the appointment? It will be permanently deleted.` */
  confirmCancelAppointment(): Promise<boolean> {
    return this.confirm({
      title: 'Cancel appointment',
      message: CANCEL_APPOINTMENT_MESSAGE,
      confirmText: 'Yes',
      cancelText: 'No',
    });
  }
}
