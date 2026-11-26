import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { statusPresentation } from '../../../doctors/models/doctor-status.presentation';
import { DoctorProfile } from '../../models/profile.model';

/**
 * Read-only doctor profile card.
 *
 * Dumb component: it only renders the profile passed in and reports the "Edit"
 * action to its parent. No services, no state.
 */
@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './profile-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileViewComponent {
  readonly profile = input<DoctorProfile | null>(null);

  readonly photoUrl = input<string | null>(null);

  readonly edit = output<void>();

  protected readonly initials = computed<string>(() => {
    const profile = this.profile();
    if (profile === null) {
      return '';
    }

    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly statusBadge = computed(() => {
    const profile = this.profile();
    return profile === null ? null : statusPresentation(profile.status);
  });

  protected onEdit(): void {
    this.edit.emit();
  }
}
