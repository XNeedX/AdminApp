import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Toast } from '../../../core/services/notification.service';

/** Pure presentational toast list: data in, dismiss events out. */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  readonly toasts = input<readonly Toast[]>([]);

  readonly dismissed = output<string>();

  dismiss(id: string): void {
    this.dismissed.emit(id);
  }
}
