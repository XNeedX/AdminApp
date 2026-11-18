import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** One tab descriptor rendered by the strip. */
export interface AppTab {
  readonly id: string;
  readonly label: string;
}

/** Focusable adapter required by `FocusKeyManager`. */
class TabFocusable {
  constructor(private readonly element: HTMLElement) {}

  focus(): void {
    this.element.focus();
  }
}

/**
 * Accessible tab strip (Tailwind + CDK a11y).
 *
 * Angular CDK has no tab component, so only the roving-focus behaviour is borrowed:
 * `FocusKeyManager` owns ArrowLeft/ArrowRight/Home/End and the consumer owns which
 * panel is rendered. Panels are provided by the parent with `role="tabpanel"` and
 * `aria-labelledby="tab-<id>"`.
 */
@Component({
  selector: 'app-app-tabs',
  standalone: true,
  templateUrl: './app-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppTabsComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  readonly tabs = input.required<readonly AppTab[]>();
  readonly activeId = input.required<string>();

  readonly activeChange = output<string>();

  protected readonly activeIndex = computed<number>(() =>
    Math.max(
      0,
      this.tabs().findIndex((tab) => tab.id === this.activeId())
    )
  );

  private keyManager: FocusKeyManager<TabFocusable> | null = null;

  constructor() {
    // Keep the key manager aligned with programmatic or click-driven selection so the
    // next arrow key continues from the visible active tab instead of the initial one.
    effect(() => {
      this.keyManager?.updateActiveItem(this.activeIndex());
    });
  }

  ngAfterViewInit(): void {
    const items = this.buttons().map((button) => new TabFocusable(button.nativeElement));
    const manager = new FocusKeyManager<TabFocusable>(items)
      .withHorizontalOrientation('ltr')
      .withHomeAndEnd();

    manager.change.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((index) => {
      const tab = this.tabs()[index];

      if (tab !== undefined && tab.id !== this.activeId()) {
        this.activeChange.emit(tab.id);
      }
    });

    // `updateActiveItem` (unlike `setActiveItem`) seeds the manager without moving
    // focus, so a page that merely renders the tabs does not steal the user's focus.
    manager.updateActiveItem(this.activeIndex());
    this.keyManager = manager;
  }

  protected onKeydown(event: KeyboardEvent): void {
    this.keyManager?.onKeydown(event);
  }

  protected select(id: string): void {
    const index = this.tabs().findIndex((tab) => tab.id === id);

    if (index >= 0) {
      this.keyManager?.updateActiveItem(index);
    }

    if (id !== this.activeId()) {
      this.activeChange.emit(id);
    }
  }

  protected tabId(id: string): string {
    return `tab-${id}`;
  }

  protected panelId(id: string): string {
    return `panel-${id}`;
  }
}
