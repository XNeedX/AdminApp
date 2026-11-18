import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-cancel-dialog',
  standalone: true,
  templateUrl: './confirm-cancel-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmCancelDialogComponent {
  readonly message = input<string>('Do you really want to cancel? Entered data will not be saved.');
  readonly confirmText = input<string>('Yes');
  readonly cancelText = input<string>('No');

  readonly confirmed = output<boolean>();

  onConfirm(): void {
    this.confirmed.emit(true);
  }

  onCancel(): void {
    this.confirmed.emit(false);
  }
}
