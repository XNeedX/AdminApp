import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Thin, accessible wrapper around the native `input[type=date]`.
 *
 * No date-picker dependency is added: the field exposes min/max bounds, a visible label
 * and an `aria-describedby` hook so the consumer can render its own error message.
 */
@Component({
  selector: 'app-app-date-field',
  standalone: true,
  templateUrl: './app-date-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDateFieldComponent {
  readonly id = input.required<string>();
  readonly label = input<string>('Date');
  readonly value = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly describedBy = input<string | null>(null);

  readonly valueChange = output<string>();

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected inputClasses(): string {
    const base =
      'block w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100';

    return this.invalid()
      ? `${base} border-red-500 focus:border-red-500 focus:ring-red-500`
      : `${base} border-gray-300 focus:border-blue-500 focus:ring-blue-500`;
  }
}
