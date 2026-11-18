import { Dialog } from '@angular/cdk/dialog';
import { Observable, map } from 'rxjs';

import {
  SpecializationCreateDialogComponent,
  SpecializationCreateDialogData,
  SpecializationCreateDialogResult,
} from '../dialogs/specialization-create-dialog/specialization-create-dialog.component';

/**
 * Opens the Create-specialization dialog and emits the created id, or `null` when the
 * Receptionist cancels.
 */
export function openSpecializationCreateDialog(
  dialog: Dialog,
): Observable<SpecializationCreateDialogResult | null> {
  const dialogRef = dialog.open<
    SpecializationCreateDialogResult | null,
    SpecializationCreateDialogData
  >(SpecializationCreateDialogComponent, {
    data: {},
    disableClose: true,
    ariaLabelledBy: 'specialization-create-dialog-title',
    restoreFocus: true,
    backdropClass: 'bg-gray-900/50',
    panelClass: ['w-full', 'max-w-3xl'],
  });

  return dialogRef.closed.pipe(map((result) => result ?? null));
}
