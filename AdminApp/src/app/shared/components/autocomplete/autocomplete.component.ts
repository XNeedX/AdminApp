import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AutocompleteOption } from './autocomplete.model';

let nextAutocompleteId = 0;

/**
 * Accessible combobox with type-to-filter, keyboard navigation and ARIA wiring.
 *
 * The component is a `ControlValueAccessor` for the **visible text** only. Consumers
 * keep the selected id in a separate hidden control and listen to `optionSelected`.
 * Styling is Tailwind-only; no component stylesheet is used.
 */
@Component({
  selector: 'app-autocomplete',
  standalone: true,
  templateUrl: './autocomplete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true,
    },
  ],
})
export class AutocompleteComponent implements ControlValueAccessor, AfterViewInit {
  private readonly instanceId = `autocomplete-${nextAutocompleteId++}`;
  private readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly inputId = input<string>(this.instanceId);
  readonly placeholder = input<string>('');
  readonly options = input<readonly AutocompleteOption[]>([]);
  /** Renders the error border; the consumer owns the message element. */
  readonly invalid = input<boolean>(false);
  /** Id of the error message element, exposed through `aria-describedby`. */
  readonly describedBy = input<string | null>(null);
  /** Marks the combobox as required for assistive technology. */
  readonly required = input<boolean>(false);

  readonly optionSelected = output<AutocompleteOption>();

  protected readonly listboxId = `${this.instanceId}-listbox`;
  protected readonly isDisabled = signal<boolean>(false);
  protected readonly isOpen = signal<boolean>(false);
  protected readonly activeIndex = signal<number>(-1);

  private readonly valueState = signal<string>('');
  private readonly typedState = signal<boolean>(false);

  protected readonly value = this.valueState.asReadonly();

  protected readonly filteredOptions = computed<readonly AutocompleteOption[]>(() => {
    const options = this.options();
    const query = this.typedState() ? this.valueState().trim().toLowerCase() : '';

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

  ngAfterViewInit(): void {
    this.syncInputElement(this.valueState());
  }

  writeValue(value: unknown): void {
    const text = typeof value === 'string' ? value : '';
    this.valueState.set(text);
    this.typedState.set(false);
    this.close();
    this.syncInputElement(text);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onTouched(): void {
    this.close();
    this.onTouchedCallback();
  }

  protected onFocus(): void {
    this.typedState.set(false);
    this.isOpen.set(true);
    this.activeIndex.set(-1);
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;

    this.valueState.set(text);
    this.typedState.set(true);
    this.isOpen.set(true);
    this.activeIndex.set(-1);
    this.onChange(text);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    const options = this.filteredOptions();

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!this.isOpen()) {
          this.isOpen.set(true);
          this.setActiveIndex(0);
          return;
        }
        this.setActiveIndex(this.activeIndex() + 1);
        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.isOpen()) {
          this.isOpen.set(true);
          this.setActiveIndex(options.length - 1);
          return;
        }
        this.setActiveIndex(this.activeIndex() - 1);
        return;
      }
      case 'Home': {
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();
        this.setActiveIndex(0);
        return;
      }
      case 'End': {
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();
        this.setActiveIndex(options.length - 1);
        return;
      }
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
      case 'Escape': {
        if (!this.isOpen()) {
          return;
        }
        event.preventDefault();
        this.close();
        return;
      }
      default:
        return;
    }
  }

  protected onOptionMouseDown(event: MouseEvent, option: AutocompleteOption): void {
    // Prevent the input blur from closing the list before the selection lands.
    event.preventDefault();
    this.selectOption(option);
  }

  protected optionId(index: number): string {
    return `${this.instanceId}-option-${index}`;
  }

  protected inputClasses(): string {
    const base =
      'mt-1 block w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100';

    return this.invalid()
      ? `${base} border-red-500 focus:border-red-500 focus:ring-red-500`
      : `${base} border-gray-300 focus:border-blue-500 focus:ring-blue-500`;
  }

  protected optionClasses(index: number): string {
    const base = 'cursor-pointer select-none px-3 py-2';

    return index === this.activeIndex()
      ? `${base} bg-blue-50 text-blue-900`
      : `${base} text-gray-900 hover:bg-blue-50 hover:text-blue-900`;
  }

  private selectOption(option: AutocompleteOption): void {
    this.valueState.set(option.label);
    this.typedState.set(false);
    this.close();
    this.syncInputElement(option.label);
    this.onChange(option.label);
    this.optionSelected.emit(option);
  }

  private setActiveIndex(index: number): void {
    const length = this.filteredOptions().length;
    this.activeIndex.set(length === 0 ? -1 : Math.max(0, Math.min(index, length - 1)));
  }

  private close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  private syncInputElement(text: string): void {
    const element = this.inputElement()?.nativeElement;

    if (element !== undefined && element.value !== text) {
      element.value = text;
    }
  }
}
