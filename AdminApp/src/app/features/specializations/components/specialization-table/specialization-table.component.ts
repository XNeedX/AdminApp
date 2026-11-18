import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SPECIALIZATION_STATUS_OPTIONS } from '../../models/specialization-form.model';
import { SpecializationListRow, SpecializationStatus } from '../../models/specialization.model';

/** Payload emitted when a row's status radio changes. */
export interface SpecializationStatusChange {
  readonly id: string;
  readonly status: SpecializationStatus;
}

/**
 * Dumb specializations table.
 *
 * Renders the two required columns and reports row activation and status changes.
 * It never injects the API client, router or dialogs.
 */
@Component({
  selector: 'app-specialization-table',
  standalone: true,
  templateUrl: './specialization-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecializationTableComponent {
  readonly rows = input<readonly SpecializationListRow[]>([]);
  readonly statusSavingId = input<string | null>(null);

  readonly open = output<string>();
  readonly statusChange = output<SpecializationStatusChange>();

  readonly statusOptions = SPECIALIZATION_STATUS_OPTIONS;

  onOpen(id: string): void {
    this.open.emit(id);
  }

  onStatusChange(id: string, status: SpecializationStatus): void {
    this.statusChange.emit({ id, status });
  }
}
