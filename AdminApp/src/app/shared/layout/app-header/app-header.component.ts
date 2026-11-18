import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

  readonly signOut = output<void>();
  readonly openProfile = output<void>();

  onSignOut(): void {
    this.signOut.emit();
  }

  onOpenProfile(): void {
    this.openProfile.emit();
  }
}
