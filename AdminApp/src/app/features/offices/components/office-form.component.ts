import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { OFFICE_ADDRESS_FIELDS, OFFICE_STATUS_OPTIONS, OfficeFormControls } from '../models/office.model';

@Component({
  selector: 'app-office-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './office-form.component.html',
})
export class OfficeFormComponent {
  readonly form = input.required<FormGroup<OfficeFormControls>>();
  readonly photoUrl = input<string | null>(null);
  readonly photoError = input<string | null>(null);
  readonly saveError = input<string | null>(null);
  readonly busy = input(false);
  readonly photoSelected = output<File>();
  readonly photoRemoved = output<void>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly addressFields = OFFICE_ADDRESS_FIELDS;
  protected readonly statusOptions = OFFICE_STATUS_OPTIONS;
  protected readonly inputClass = 'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

  protected onPhotoChange(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file !== undefined) this.photoSelected.emit(file);
    input.value = '';
  }
}
