import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import {
  SignInFormGroup,
  resolveEmailError,
  resolvePasswordError,
} from '../../models/sign-in-form.model';

/** Presentational sign-in form: form group in, submit/hint events out. */
@Component({
  selector: 'app-sign-in-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInFormComponent {
  readonly form = input.required<SignInFormGroup>();
  readonly submitting = input<boolean>(false);
  readonly submitError = input<string | null>(null);

  readonly submitted = output<void>();
  readonly fieldChanged = output<void>();

  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly passwordVisible = signal(false);
  readonly passwordType = computed(() => (this.passwordVisible() ? 'text' : 'password'));

  constructor() {
    afterNextRender(() => this.emailInput()?.nativeElement.focus());
  }

  get emailError(): string | null {
    return resolveEmailError(this.form().controls.email);
  }

  get passwordError(): string | null {
    return resolvePasswordError(this.form().controls.password);
  }

  get isSubmitDisabled(): boolean {
    return this.submitting() || this.form().invalid;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  onSubmit(): void {
    this.submitted.emit();
  }

  onFieldChanged(): void {
    this.fieldChanged.emit();
  }
}
