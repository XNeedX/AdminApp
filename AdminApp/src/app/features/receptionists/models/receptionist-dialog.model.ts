import { ReceptionistCreatedSummary } from './receptionist.model';

/* Exact dialog copy required by the feature specification (must not be reworded). */
export const CANCEL_CREATE_DIALOG_MESSAGE =
  'Do you really want to cancel? Entered data will not be saved.';
export const CANCEL_EDIT_DIALOG_MESSAGE =
  'Do you really want to cancel? Changes will not be saved.';
export const DELETE_DIALOG_MESSAGE = 'Do you really want to delete? Data will be lost.';

export const CONFIRM_YES_LABEL = 'Yes';
export const CONFIRM_NO_LABEL = 'No';

/** Result every `Dialog.open(ReceptionistCreateDialogComponent)` receives. */
export interface ReceptionistCreateDialogResult {
  readonly created: ReceptionistCreatedSummary | null;
}
