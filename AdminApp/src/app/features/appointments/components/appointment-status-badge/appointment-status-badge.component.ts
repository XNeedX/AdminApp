import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Approval state of one appointment row.
 *
 * Presentational only: it derives a label and a colour pair from the boolean the table
 * receives, so the table never duplicates the status wording.
 */
@Component({
  selector: 'app-appointment-status-badge',
  standalone: true,
  templateUrl: './appointment-status-badge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentStatusBadgeComponent {
  readonly approved = input.required<boolean>();

  protected readonly label = computed(() => (this.approved() ? 'Approved' : 'Not Approved'));

  protected readonly classes = computed(() =>
    this.approved()
      ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
      : 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
  );
}
