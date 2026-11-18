import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { nonBlankValidator } from '../../../../core/validators/non-blank.validator';
import { positivePriceValidator } from '../../../../core/validators/positive-price.validator';
import {
  SERVICE_CATEGORY_OPTIONS,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_STATUS_OPTIONS,
  ServiceFormControls,
} from '../../models/service-form.model';
import { ServiceCategory, ServiceFormValue, ServiceStatus } from '../../models/service.model';

/**
 * Reusable service form, shared by Create and Edit.
 *
 * Dumb component: it owns the typed form group and validation only. It never injects
 * the API client, router, dialogs or notifications; the parent decides what to do with
 * the emitted value.
 */
@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './service-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormComponent {
  readonly mode = input<'create' | 'edit'>('create');
  readonly initialValue = input<ServiceFormValue | null>(null);
  readonly submitting = input<boolean>(false);

  readonly submitted = output<ServiceFormValue>();
  readonly cancelled = output<void>();

  readonly form = new FormGroup<ServiceFormControls>({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(SERVICE_NAME_MAX_LENGTH)],
    }),
    price: new FormControl<number | null>(null, {
      validators: [Validators.required, positivePriceValidator],
    }),
    category: new FormControl<ServiceCategory | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    status: new FormControl<ServiceStatus>('Active', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly categoryOptions = SERVICE_CATEGORY_OPTIONS;
  readonly statusOptions = SERVICE_STATUS_OPTIONS;

  constructor() {
    effect(() => {
      const initial = this.initialValue();

      if (initial !== null) {
        this.form.reset({
          name: initial.name,
          price: initial.price,
          category: initial.category,
          status: initial.status,
        });
      }
    });

    effect(() => {
      if (this.submitting()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  isShown(controlName: keyof ServiceFormControls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  nameMessage(): string | null {
    if (!this.isShown('name')) {
      return null;
    }

    return this.form.controls.name.hasError('maxlength')
      ? `The name must not exceed ${SERVICE_NAME_MAX_LENGTH} characters`
      : 'Please, enter the name';
  }

  priceMessage(): string | null {
    if (!this.isShown('price')) {
      return null;
    }

    return this.form.controls.price.hasError('required')
      ? 'Please, enter the price'
      : "You've entered an invalid price";
  }

  categoryMessage(): string | null {
    return this.isShown('category') ? 'Please, choose the service category' : null;
  }

  onSubmit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.price === null || value.category === '') {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit({
      name: value.name.trim(),
      price: value.price,
      category: value.category,
      status: value.status,
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
