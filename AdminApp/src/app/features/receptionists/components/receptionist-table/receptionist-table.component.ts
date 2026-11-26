import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ReceptionistRow } from '../../models/receptionist.model';
import { officeLabel } from '../../utils/receptionist-presentation';

/** Presentational Receptionists directory table. */
@Component({
  selector: 'app-receptionist-table',
  standalone: true,
  templateUrl: './receptionist-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionistTableComponent {
  readonly rows = input.required<readonly ReceptionistRow[]>();
  readonly isLoading = input<boolean>(false);
  readonly loadError = input<string | null>(null);
  readonly deletingId = input<string | null>(null);

  readonly profileRequested = output<string>();
  readonly deleteRequested = output<ReceptionistRow>();
  readonly retryRequested = output<void>();

  protected displayOffice(value: string | null): string {
    return officeLabel(value);
  }

  protected onRowActivate(row: ReceptionistRow): void {
    if (row.id !== null) {
      this.profileRequested.emit(row.id);
    }
  }

  protected onProfile(event: Event, row: ReceptionistRow): void {
    event.stopPropagation();
    this.onRowActivate(row);
  }

  protected onDelete(event: Event, row: ReceptionistRow): void {
    event.stopPropagation();
    this.deleteRequested.emit(row);
  }
}
