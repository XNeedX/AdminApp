import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppointmentRow } from '../../models/appointment.model';
import { AppointmentStatusBadgeComponent } from '../appointment-status-badge/appointment-status-badge.component';

/**
 * Read-only appointment table.
 *
 * Every action is reported to the page through an output; the table owns no transport
 * and no filter logic. Approval and deletion flags come from the facade row model, so a
 * button can be disabled without the table knowing why.
 */
@Component({
  selector: 'app-appointment-table',
  standalone: true,
  imports: [AppointmentStatusBadgeComponent],
  templateUrl: './appointment-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentTableComponent {
  readonly rows = input.required<readonly AppointmentRow[]>();
  readonly isLoading = input<boolean>(false);
  readonly hasGenerated = input<boolean>(false);
  readonly loadError = input<string | null>(null);

  readonly approve = output<AppointmentRow>();
  readonly cancel = output<AppointmentRow>();
  readonly rescheduleRequested = output<AppointmentRow>();

  protected approveLabel(row: AppointmentRow): string {
    return `Approve appointment ${row.timeRangeLabel} for ${row.patientFullName}`;
  }

  protected cancelLabel(row: AppointmentRow): string {
    return `Cancel appointment ${row.timeRangeLabel} for ${row.patientFullName}`;
  }

  protected rescheduleLabel(row: AppointmentRow): string {
    return `Reschedule appointment ${row.timeRangeLabel} for ${row.patientFullName}`;
  }

  protected onApprove(row: AppointmentRow): void {
    this.approve.emit(row);
  }

  protected onCancel(row: AppointmentRow): void {
    this.cancel.emit(row);
  }

  protected onReschedule(row: AppointmentRow): void {
    this.rescheduleRequested.emit(row);
  }
}
