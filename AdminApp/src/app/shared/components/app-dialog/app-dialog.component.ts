import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

let nextDialogId = 0;

/**
 * Presentational dialog chrome: title, optional subtitle, close button and a footer slot.
 *
 * The component renders the panel only. Callers either place it inside their own
 * backdrop (the inline creation modal) or host it in a CDK dialog, which supplies focus
 * trapping, restore-focus and the overlay backdrop.
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  templateUrl: './app-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDialogComponent {
  private readonly instanceId = `app-dialog-${nextDialogId++}`;

  readonly title = input<string>('');
  readonly subtitle = input<string | null>(null);
  readonly showClose = input<boolean>(true);
  readonly closeLabel = input<string>('Close');

  readonly close = output<void>();

  protected readonly titleId = `${this.instanceId}-title`;
  protected readonly hasHeader = computed(
    () => this.title().length > 0 || (this.subtitle() ?? '').length > 0 || this.showClose()
  );

  protected onClose(): void {
    this.close.emit();
  }
}
