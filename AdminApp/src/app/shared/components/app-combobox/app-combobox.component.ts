import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectionPositionPair, Overlay, OverlayModule } from '@angular/cdk/overlay';

import { AutocompleteOption } from '../autocomplete/autocomplete.model';

let nextComboboxId = 0;

/**
 * Accessible combobox whose suggestion panel is rendered in a CDK overlay.
 *
 * The component is a `ControlValueAccessor` for the **visible text** only; the consumer
 * owns the selected id and receives it through `optionSelected`. The panel is connected
 * to the input, matches its width and repositions on scroll, so it is not clipped by a
 * scrolling modal.
 */
@Component({
  selector: 'app-app-combobox',
  standalone: true,
  imports: [OverlayModule],
  templateUrl: './app-combobox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppComboboxComponent),
      multi: true,
    },
  ],
})
export class AppComboboxComponent implements ControlValueAccessor {
  private readonly overlay = inject(Overlay);
  private readonly instanceId = `app-combobox-${nextComboboxId++}`;

  protected readonly scrollStrategy = this.overlay.scrollStrategies.reposition();

  readonly inputId = input<string>(this.instanceId);
  readonly options = input.required<readonly AutocompleteOption[]>();
  readonly placeholder = input<string>('');
  readonly invalid = input<boolean>(false);
  readonly describedBy = input<string | null>(null);
  readonly disabled = input<boolean>(false);
  readonly emptyText = input<string>('No matches');

  readonly optionSelected = output<AutocompleteOption>();
  readonly textChange = output<string>();
  readonly blurred = output<void>();

  protected readonly listboxId = `${this.instanceId}-listbox`;
  protected readonly positions: ConnectionPositionPair[] = [
    new ConnectionPositionPair(
      { originX: 'start', originY: 'bottom' },
      { overlayX: 'start', overlayY: 'top' },
      0,
      4
    ),
    new ConnectionPositionPair(
      { originX: 'start', originY: 'top' },
      { overlayX: 'start', overlayY: 'bottom' },
      0,
      -4
    ),
  ];

  protected readonly isOpen = signal<boolean>(false);
  protected readonly activeIndex = signal<number>(-1);
  private readonly textState = signal<string>('');
  private readonly typedState = signal<boolean>(false);
  private readonly formDisabled = signal<boolean>(false);

  protected readonly text = this.textState.asReadonly();
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly visibleOptions = computed<readonly AutocompleteOption[]>(() => {
    const options = this.options();
    const query = this.typedState() ? this.textState().trim().toLowerCase() : '';

    if (query.length === 0) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(query));
  });

  protected readonly activeOptionId = computed<string | null>(() => {
    const index = this.activeIndex();
    return index >= 0 ? this.optionId(index) : null;
  });

  private onChange: (value: string) => void = () => {};

  private onTouchedCallback: () => void = () => {};

  writeValue(value: unknown): void {
    const text = typeof value === 'string' ? value : '';
    this.textState.set(text);
    this.typedState.set(false);
    this.close();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  protected onFocus(): void {
    if (this.isDisabled()) {
      return;
    }

    this.typedState.set(false);
    this.isOpen.set(true);
    this.activeIndex.set(-1);
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;

    this.textState.set(text);
    this.typedState.set(true);
    this.isOpen.set(true);
    this.activeIndex.set(-1);
    this.onChange(text);
    this.textChange.emit(text);
  }

  protected onBlur(): void {
    this.close();
    this.onTouchedCallback();
    this.blurred.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    const options = this.visibleOptions();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) {
          this.isOpen.set(true);
          this.setActiveIndex(0);
          return;
        }
        this.setActiveIndex(this.activeIndex() + 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.isOpen()) {
          this.isOpen.set(true);
          this.setActiveIndex(options.length - 1);
          return;
        }
        this.setActiveIndex(this.activeIndex() - 1);
        return;
      case 'Home':
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();
        this.setActiveIndex(0);
        return;
      case 'End':
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();
        this.setActiveIndex(options.length - 1);
        return;
      case 'Enter': {
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();

        const index = this.activeIndex();
        const option =
          index >= 0 ? options[index] : options.length === 1 ? options[0] : undefined;

        if (option !== undefined) {
          this.selectOption(option);
        } else {
          this.close();
        }
        return;
      }
      case 'Escape':
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();
        // Keep the key from reaching an enclosing dialog, where Escape has its own meaning.
        event.stopPropagation();
        this.close();
        return;
      default:
        return;
    }
  }

  protected onOptionMouseDown(event: MouseEvent, option: AutocompleteOption): void {
    // Keep focus on the input so the panel is not closed before the selection lands.
    event.preventDefault();
    this.selectOption(option);
  }

  protected optionId(index: number): string {
    return `${this.instanceId}-option-${index}`;
  }

  protected inputClasses(): string {
    const base =
      'block w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100';

    return this.invalid()
      ? `${base} border-red-500 focus:border-red-500 focus:ring-red-500`
      : `${base} border-gray-300 focus:border-blue-500 focus:ring-blue-500`;
  }

  protected onDetach(): void {
    this.close();
  }

  private selectOption(option: AutocompleteOption): void {
    this.textState.set(option.label);
    this.typedState.set(false);
    this.close();
    this.onChange(option.label);
    this.optionSelected.emit(option);
  }

  private setActiveIndex(index: number): void {
    const length = this.visibleOptions().length;
    this.activeIndex.set(length === 0 ? -1 : Math.max(0, Math.min(index, length - 1)));
  }

  private close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }
}
