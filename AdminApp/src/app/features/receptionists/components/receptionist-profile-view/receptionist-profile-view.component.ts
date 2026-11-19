import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ReceptionistProfile } from '../../models/receptionist.model';
import {
  displayValue,
  initials,
  officeLabel,
  photoUrl,
} from '../../utils/receptionist-presentation';

/**
 * Read-only receptionist profile card.
 *
 * Dumb component: it only renders the profile passed in and reports the "Edit"
 * action to its parent. No services, no state.
 */
@Component({
  selector: 'app-receptionist-profile-view',
  standalone: true,
  templateUrl: './receptionist-profile-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionistProfileViewComponent {
  readonly profile = input<ReceptionistProfile | null>(null);

  readonly edit = output<void>();

  protected readonly photo = computed<string | null>(() =>
    photoUrl(this.profile()?.photoPath ?? null),
  );

  protected readonly initialsValue = computed<string>(() => {
    const profile = this.profile();
    return profile === null ? '' : initials(profile);
  });

  protected readonly middleName = computed<string>(() =>
    displayValue(this.profile()?.middleName ?? null),
  );

  protected readonly office = computed<string>(() =>
    officeLabel(this.profile()?.officeAddress ?? ''),
  );
}
