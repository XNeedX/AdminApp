import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';

/**
 * Landing route: sends each role to its home screen.
 *
 * Receptionists manage the doctor list; Doctors land on their own profile
 * because the Doctors listing is Receptionist-only.
 */
@Component({
  selector: 'app-home-redirect',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const roles = this.auth.user()?.roles ?? [];
    const target = roles.includes('Receptionist') ? '/doctors' : '/my-schedule';

    void this.router.navigate([target], { replaceUrl: true });
  }
}
