import { Dialog } from '@angular/cdk/dialog';
import { Observable, map } from 'rxjs';

import {
  ServiceCreateDialogComponent,
  ServiceCreateDialogData,
  ServiceCreateDialogResult,
} from '../dialogs/service-create-dialog/service-create-dialog.component';

/**
 * Opens the Create-service dialog and emits the new service id, or `null` when the
 * Receptionist cancels. The prerequisite specialization page only needs this call.
 */
export function openServiceCreateDialog(
  dialog: Dialog,
  specializationId: string
): Observable<ServiceCreateDialogResult | null> {
  const dialogRef = dialog.open<ServiceCreateDialogResult | null, ServiceCreateDialogData>(
    ServiceCreateDialogComponent,
    {
      data: { specializationId },
      disableClose: true,
      ariaLabelledBy: 'service-create-dialog-title',
      restoreFocus: true,
    }
  );

  return dialogRef.closed.pipe(map((result) => result ?? null));
}
