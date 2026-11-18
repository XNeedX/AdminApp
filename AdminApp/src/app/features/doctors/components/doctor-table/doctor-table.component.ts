import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DoctorDirectoryEntry } from '../../models/doctor-directory.model';
import { DOCTOR_STATUSES, DoctorStatus, isDoctorStatus } from '../../models/doctor-form.model';

/** Dumb directory table with an inline status control. */
@Component({
  selector: 'app-doctor-table',
  standalone: true,
  templateUrl: './doctor-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorTableComponent {
  readonly rows = input.required<readonly DoctorDirectoryEntry[]>();
  readonly isLoading = input<boolean>(false);
  readonly loadError = input<string | null>(null);
  readonly canChangeStatus = input<boolean>(false);

  readonly statusChange = output<{ readonly id: string; readonly status: DoctorStatus }>();
  readonly profileRequested = output<string>();
  readonly retryRequested = output<void>();

  protected readonly statuses = DOCTOR_STATUSES;

  protected onStatusChange(row: DoctorDirectoryEntry, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const next = select.value;

    if (!isDoctorStatus(next) || next === row.status) {
      select.value = row.status;
      return;
    }

    this.statusChange.emit({ id: row.id, status: next });
  }
}
