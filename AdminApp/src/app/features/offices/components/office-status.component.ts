import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OfficeStatus } from '../../../api/generated/offices/models/office-status';
import { OFFICE_STATUS_OPTIONS } from '../models/office.model';

@Component({
  selector: 'app-office-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [disabled]="busy()" class="flex flex-wrap gap-x-4 gap-y-2" (click)="$event.stopPropagation()">
      <legend class="sr-only">{{ label() }}</legend>
      @for (option of options; track option.value) {
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            [name]="name()"
            [checked]="status() === option.value"
            (click)="requestChange($event, option.value)"
            class="size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
          {{ option.label }}
        </label>
      }
    </fieldset>
  `,
})
export class OfficeStatusComponent {
  readonly name = input.required<string>();
  readonly label = input.required<string>();
  readonly status = input.required<OfficeStatus>();
  readonly busy = input(false);
  readonly statusChange = output<OfficeStatus>();

  protected readonly options = OFFICE_STATUS_OPTIONS;

  protected requestChange(event: MouseEvent, status: OfficeStatus): void {
    event.preventDefault();
    if (!this.busy() && status !== this.status()) {
      this.statusChange.emit(status);
    }
  }
}
