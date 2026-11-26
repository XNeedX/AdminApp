import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** A primary navigation entry rendered by the header. */
export interface HeaderNavItem {
  readonly label: string;
  readonly path: string;
}

/** Presentational application header: identity and navigation in, intents out. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  readonly email = input<string>('');
  readonly canViewProfile = input<boolean>(false);
  readonly navItems = input<readonly HeaderNavItem[]>([]);

  protected readonly initials = computed(() => {
    const account = this.email().split('@')[0];
    const parts = account.split(/[._-]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : account.slice(0, 2)).toUpperCase();
  });

  readonly skipToContent = output<void>();
  readonly signOut = output<void>();
  readonly openProfile = output<void>();

  onSignOut(): void {
    this.signOut.emit();
  }

  onOpenProfile(): void {
    this.openProfile.emit();
  }
}
