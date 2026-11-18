import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import {
  AppHeaderComponent,
  HeaderNavItem,
} from './shared/layout/app-header/app-header.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly isDoctor = computed(() => this.auth.user()?.roles.includes('Doctor') ?? false);
  readonly navItems = computed<readonly HeaderNavItem[]>(() => {
    const roles = this.auth.user()?.roles ?? [];

    return roles.includes('Receptionist')
      ? [
          { label: 'Appointments', path: '/appointments' },
          { label: 'Doctors', path: '/doctors' },
          { label: 'Services', path: '/services' },
          { label: 'Specializations', path: '/specializations' },
        ]
      : [];
  });
  readonly toasts = this.notifications.toasts;

  onOpenProfile(): void {
    void this.router.navigate(['/profile']);
  }

  onSignOut(): void {
    this.auth
      .signOut()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.router.navigate(['/sign-in'], { replaceUrl: true });
      });
  }

  dismissToast(id: string): void {
    this.notifications.dismiss(id);
  }
}
