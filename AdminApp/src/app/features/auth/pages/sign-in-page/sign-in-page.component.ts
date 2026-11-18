import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ACCOUNT_EXISTS_LOOKUP } from '../../../../core/tokens/account-exists-lookup.token';
import { accountExistsValidator } from '../../../../core/validators/account-exists.validator';
import {
  SIGN_IN_MESSAGES,
  SignInFormGroup,
  createSignInForm,
} from '../../models/sign-in-form.model';
import { SignInFormComponent } from '../../components/sign-in-form/sign-in-form.component';

/** Smart sign-in container: owns the form, the session attempt and the navigation. */
@Component({
  selector: 'app-sign-in-page',
  standalone: true,
  imports: [SignInFormComponent],
  templateUrl: './sign-in-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly accountExistsLookup = inject(ACCOUNT_EXISTS_LOOKUP);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = signal<SignInFormGroup | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly isBusy = computed(() => this.submitting());

  ngOnInit(): void {
    this.form.set(createSignInForm([accountExistsValidator(this.accountExistsLookup)]));
  }

  onSubmit(): void {
    const form = this.form();
    if (form === null || this.submitting()) {
      return;
    }

    form.markAllAsTouched();

    if (form.invalid) {
      form.updateValueAndValidity();
      return;
    }

    const { email, password } = form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);

    this.auth
      .signIn(email, password)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((outcome) => {
        if (outcome.success) {
          this.notifications.showSuccess(SIGN_IN_MESSAGES.signedInSuccessfully);
          void this.router.navigate(['/']);
          return;
        }

        this.submitError.set(
          outcome.reason === 'unavailable'
            ? SIGN_IN_MESSAGES.temporarilyUnavailable
            : SIGN_IN_MESSAGES.invalidCredentials
        );

        if (outcome.reason === 'unavailable') {
          this.notifications.showError(SIGN_IN_MESSAGES.temporarilyUnavailable);
        }
      });
  }

  onFieldChanged(): void {
    if (this.submitError() !== null) {
      this.submitError.set(null);
    }
  }
}
