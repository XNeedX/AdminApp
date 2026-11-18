import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AutocompleteComponent } from '../../../../shared/components/autocomplete/autocomplete.component';
import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import {
  CATALOG_ALL_LABEL,
  DoctorFilterState,
  EMPTY_DOCTOR_FILTERS,
} from '../../models/doctor-directory.model';

/**
 * Dumb filter panel: one immutable replacement state per change.
 *
 * The panel never mutates the incoming state and never talks to a store; the office
 * and specialization option lists are already narrowed by the parent.
 */
@Component({
  selector: 'app-doctor-filters',
  standalone: true,
  imports: [ReactiveFormsModule, AutocompleteComponent],
  templateUrl: './doctor-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorFiltersComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly state = input.required<DoctorFilterState>();
  readonly nameOptions = input<readonly AutocompleteOption[]>([]);
  readonly specializationOptions = input<readonly string[]>([]);
  readonly officeOptions = input<readonly string[]>([]);

  readonly filterChange = output<DoctorFilterState>();

  protected readonly allLabel = CATALOG_ALL_LABEL;
  protected readonly nameControl = new FormControl<string>('', { nonNullable: true });

  protected readonly hasActiveFilters = computed<boolean>(() => {
    const state = this.state();

    return (
      state.nameQuery.length > 0 ||
      state.selectedDoctorId.length > 0 ||
      state.specialization.length > 0 ||
      state.officeAddress.length > 0
    );
  });

  /** A previously chosen value that the narrowed catalog no longer offers. */
  protected readonly missingSpecialization = computed<boolean>(() => {
    const selected = this.state().specialization;

    return selected.length > 0 && !this.specializationOptions().includes(selected);
  });

  protected readonly missingOffice = computed<boolean>(() => {
    const selected = this.state().officeAddress;

    return selected.length > 0 && !this.officeOptions().includes(selected);
  });

  constructor() {
    effect(() => {
      const query = this.state().nameQuery;

      if (this.nameControl.value !== query) {
        this.nameControl.setValue(query, { emitEvent: false });
      }
    });

    this.nameControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        const current = this.state();

        // Selecting an option writes its label first and emits `optionSelected`
        // immediately after; that single event carries both query and id.
        if (this.nameOptions().some((option) => option.label === query)) {
          return;
        }

        if (current.nameQuery === query && current.selectedDoctorId.length === 0) {
          return;
        }

        this.emit({ ...current, nameQuery: query, selectedDoctorId: '' });
      });
  }

  protected onNameSelected(option: AutocompleteOption): void {
    this.emit({ ...this.state(), nameQuery: option.label, selectedDoctorId: option.id });
  }

  protected onSpecializationChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.emit({ ...this.state(), specialization: select.value });
  }

  protected onOfficeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.emit({ ...this.state(), officeAddress: select.value });
  }

  protected clear(): void {
    this.emit(EMPTY_DOCTOR_FILTERS);
  }

  private emit(state: DoctorFilterState): void {
    this.filterChange.emit(state);
  }
}
