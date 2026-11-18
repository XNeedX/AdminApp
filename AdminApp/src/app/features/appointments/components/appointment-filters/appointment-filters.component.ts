import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import { AppComboboxComponent } from '../../../../shared/components/app-combobox/app-combobox.component';
import { AppDateFieldComponent } from '../../../../shared/components/app-date-field/app-date-field.component';
import {
  DoctorOption,
  OfficeOption,
  ServiceOption,
  SpecializationOption,
} from '../../models/appointment-catalog.model';
import {
  AppointmentFilterState,
  AppointmentStatusFilter,
} from '../../models/appointment-filter.model';

/** Status options in the exact order required by the UI contract. */
const STATUS_OPTIONS: readonly { readonly value: AppointmentStatusFilter; readonly label: string }[] =
  [
    { value: 'approved', label: 'Approved' },
    { value: 'notApproved', label: 'Not Approved' },
    { value: 'all', label: 'All' },
  ];

function isStatusFilter(value: string): value is AppointmentStatusFilter {
  return value === 'all' || value === 'approved' || value === 'notApproved';
}

function matchesLabel(option: AutocompleteOption, text: string): boolean {
  return option.label.trim().toLowerCase() === text.trim().toLowerCase();
}

/**
 * Filter panel of the appointments workspace.
 *
 * Dumb component: it receives the current state and the catalogs, and emits a complete
 * replacement state on every change. It never mutates the `state` input.
 */
@Component({
  selector: 'app-appointment-filters',
  standalone: true,
  imports: [FormsModule, AppComboboxComponent, AppDateFieldComponent],
  templateUrl: './appointment-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentFiltersComponent {
  readonly state = input.required<AppointmentFilterState>();
  readonly specializations = input<readonly SpecializationOption[]>([]);
  readonly services = input<readonly ServiceOption[]>([]);
  readonly doctors = input<readonly DoctorOption[]>([]);
  readonly offices = input<readonly OfficeOption[]>([]);
  readonly isLoading = input<boolean>(false);

  readonly generate = output<void>();
  readonly filterChange = output<AppointmentFilterState>();
  readonly dateChange = output<string>();
  readonly createRequested = output<void>();

  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly doctorOptions = computed<readonly AutocompleteOption[]>(() =>
    this.doctors().map((doctor) => ({ id: doctor.id, label: doctor.fullName }))
  );

  protected readonly serviceOptions = computed<readonly AutocompleteOption[]>(() =>
    this.services().map((service) => ({ id: service.id, label: service.name }))
  );

  /** Visible combobox text, kept in sync with the selected id unless the user is typing. */
  protected readonly doctorText = linkedSignal(() => {
    const doctor = this.doctors().find((option) => option.id === this.state().doctorId);
    return doctor?.fullName ?? '';
  });

  protected readonly serviceText = linkedSignal(() => {
    const service = this.services().find((option) => option.id === this.state().serviceId);
    return service?.name ?? '';
  });

  protected onDoctorText(text: string): void {
    this.doctorText.set(text);
  }

  protected onServiceText(text: string): void {
    this.serviceText.set(text);
  }

  protected onDoctorSelected(option: AutocompleteOption): void {
    this.emitChange({ ...this.state(), doctorId: option.id });
  }

  protected onServiceSelected(option: AutocompleteOption): void {
    this.emitChange({ ...this.state(), serviceId: option.id });
  }

  protected onDoctorBlur(): void {
    const id = this.resolveId(this.doctorOptions(), this.doctorText());
    this.emitChange({ ...this.state(), doctorId: id });
  }

  protected onServiceBlur(): void {
    const id = this.resolveId(this.serviceOptions(), this.serviceText());
    this.emitChange({ ...this.state(), serviceId: id });
  }

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (!isStatusFilter(value)) {
      return;
    }

    this.emitChange({ ...this.state(), status: value });
  }

  protected onOfficeChange(event: Event): void {
    this.emitChange({ ...this.state(), officeId: (event.target as HTMLSelectElement).value });
  }

  protected onDateChange(date: string): void {
    this.dateChange.emit(date);
  }

  protected onGenerate(): void {
    this.generate.emit();
  }

  protected onCreateRequested(): void {
    this.createRequested.emit();
  }

  private emitChange(next: AppointmentFilterState): void {
    this.filterChange.emit(next);
  }

  private resolveId(options: readonly AutocompleteOption[], text: string): string {
    if (text.trim().length === 0) {
      return '';
    }

    return options.find((option) => matchesLabel(option, text))?.id ?? '';
  }
}
