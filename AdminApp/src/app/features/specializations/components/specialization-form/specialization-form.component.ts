import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  SERVICE_CATEGORY_OPTIONS,
  SERVICE_STATUS_OPTIONS,
  SPECIALIZATION_NAME_MAX_LENGTH,
  SPECIALIZATION_STATUS_OPTIONS,
  ServiceRowControls,
  VALIDATION_MESSAGES,
  createServiceRow,
  createSpecializationForm,
  toSpecializationFormValue,
} from '../../models/specialization-form.model';
import { SpecializationFormValue, SpecializationView } from '../../models/specialization.model';

/**
 * Dumb specialization form, shared by Create and Edit.
 *
 * Owns the typed `FormGroup` including the nested `FormArray` of service rows and all
 * validation. It never injects the API client, router, dialogs or notifications; the
 * parent decides what to do with the emitted value.
 */
@Component({
  selector: 'app-specialization-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './specialization-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecializationFormComponent {
  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValue = input<SpecializationView | null>(null);
  readonly submitting = input<boolean>(false);

  readonly submitted = output<SpecializationFormValue>();
  readonly cancelled = output<void>();

  readonly form = createSpecializationForm();
  readonly statusOptions = SPECIALIZATION_STATUS_OPTIONS;
  readonly serviceStatusOptions = SERVICE_STATUS_OPTIONS;
  readonly categoryOptions = SERVICE_CATEGORY_OPTIONS;
  readonly nameMaxLength = SPECIALIZATION_NAME_MAX_LENGTH;

  private readonly formRevision = signal(0);
  private prefilledFrom: SpecializationView | null = null;

  /**
   * Explicit submit guard: the array must not be empty even if the array validator is
   * ever relaxed (FR-014 / FR-029).
   */
  readonly canSubmit = computed(() => {
    this.formRevision();
    return this.form.valid && this.form.controls.services.length > 0 && !this.submitting();
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formRevision.update((revision) => revision + 1);
    });

    effect(() => {
      const initial = this.initialValue();

      if (initial === null || initial === this.prefilledFrom) {
        return;
      }

      this.prefilledFrom = initial;
      this.prefill(initial);
    });

    effect(() => {
      if (this.submitting()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  addService(): void {
    this.form.controls.services.push(createServiceRow());
  }

  discardRow(index: number): void {
    this.form.controls.services.removeAt(index);
  }

  isStoredRow(row: FormGroup<ServiceRowControls>): boolean {
    return row.controls.id.value !== null;
  }

  isNameShown(): boolean {
    const control = this.form.controls.name;
    return control.invalid && control.touched;
  }

  nameMessage(): string | null {
    if (!this.isNameShown()) {
      return null;
    }

    return this.form.controls.name.hasError('maxlength')
      ? VALIDATION_MESSAGES.nameTooLong
      : VALIDATION_MESSAGES.nameRequired;
  }

  isRowNameShown(row: FormGroup<ServiceRowControls>): boolean {
    const control = row.controls.name;
    return control.invalid && control.touched;
  }

  rowNameMessage(row: FormGroup<ServiceRowControls>): string | null {
    if (!this.isRowNameShown(row)) {
      return null;
    }

    return row.controls.name.hasError('maxlength')
      ? VALIDATION_MESSAGES.nameTooLong
      : VALIDATION_MESSAGES.nameRequired;
  }

  isPriceShown(row: FormGroup<ServiceRowControls>): boolean {
    const control = row.controls.price;
    return control.invalid && control.touched;
  }

  priceMessage(row: FormGroup<ServiceRowControls>): string | null {
    if (!this.isPriceShown(row)) {
      return null;
    }

    return row.controls.price.hasError('required')
      ? VALIDATION_MESSAGES.priceRequired
      : VALIDATION_MESSAGES.priceInvalid;
  }

  isCategoryShown(row: FormGroup<ServiceRowControls>): boolean {
    const control = row.controls.category;
    return control.invalid && control.touched;
  }

  categoryMessage(row: FormGroup<ServiceRowControls>): string | null {
    return this.isCategoryShown(row) ? VALIDATION_MESSAGES.categoryRequired : null;
  }

  onSubmit(): void {
    if (this.submitting()) {
      return;
    }

    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = toSpecializationFormValue(this.form);

    if (value === null) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(value);
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private prefill(view: SpecializationView): void {
    this.form.controls.name.setValue(view.name);
    this.form.controls.status.setValue(view.status);

    const services = this.form.controls.services;
    services.clear();

    for (const row of view.services) {
      services.push(createServiceRow(row));
    }
  }
}
