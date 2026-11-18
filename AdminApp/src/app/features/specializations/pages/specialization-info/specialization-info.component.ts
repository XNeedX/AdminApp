import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';

import { SpecializationService } from '../../../../api/generated/services/services/specialization.service';
import { extractErrorMessage } from '../../../../core/interceptors/api-error.interceptor';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CancelConfirmDialogComponent,
  CancelConfirmDialogData,
} from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { SpecializationFormComponent } from '../../components/specialization-form/specialization-form.component';
import { SPECIALIZATION_STATUS_OPTIONS } from '../../models/specialization-form.model';
import {
  SpecializationFormValue,
  SpecializationStatus,
  SpecializationView,
  toSpecializationStatusRequest,
  toSpecializationView,
} from '../../models/specialization.model';
import {
  EMPTY_WRITE_SESSION,
  SpecializationWriterService,
  WriteSessionState,
  unwrapWriteError,
  writeStateFromError,
} from '../../services/specialization-writer.service';

/** Message required by US4 AC-5..8 (must not be reworded). */
export const CANCEL_EDIT_DIALOG_MESSAGE =
  'Do you really want to cancel? Changes will not be saved.';

const SPECIALIZATION_NOT_FOUND_MESSAGE = 'Specialization not found.';

/**
 * Smart specialization detail page.
 *
 * Owns the loaded record, the View/Edit mode signal, saving, immediate status changes,
 * dialogs and notifications. The form itself stays dumb and is reused for Create/Edit.
 */
@Component({
  selector: 'app-specialization-info',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, SpecializationFormComponent],
  templateUrl: './specialization-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecializationInfoComponent implements OnInit {
  private readonly specializationsApi = inject(SpecializationService);
  private readonly writer = inject(SpecializationWriterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly specialization = signal<SpecializationView | null>(null);
  readonly isEditMode = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly statusSaving = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly statusOptions = SPECIALIZATION_STATUS_OPTIONS;
  /** View-mode status group; kept in a control so rollbacks repaint the radios. */
  readonly statusControl = new FormControl<SpecializationStatus>('Active', { nonNullable: true });

  private writeState: WriteSessionState = EMPTY_WRITE_SESSION;

  constructor() {
    this.statusControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.changeStatus(status));

    // Single source of truth: the loaded/optimistically-updated status. Syncing in an
    // effect keeps the radios correct even when a rollback happens while the native
    // `change` event is still being processed.
    effect(() => {
      const status = this.specialization()?.status;

      if (status !== undefined) {
        this.statusControl.setValue(status, { emitEvent: false });
      }
    });

    effect(() => {
      if (this.statusSaving()) {
        this.statusControl.disable({ emitEvent: false });
      } else {
        this.statusControl.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(silent = false): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id === null || id.length === 0) {
      this.loadError.set(SPECIALIZATION_NOT_FOUND_MESSAGE);
      return;
    }

    if (!silent) {
      this.isLoading.set(true);
    }
    this.loadError.set(null);

    this.specializationsApi
      .specializationIdGet({ id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);

          if (response.data === undefined) {
            this.loadError.set(SPECIALIZATION_NOT_FOUND_MESSAGE);
            return;
          }

          try {
            this.specialization.set(toSpecializationView(response.data));
          } catch {
            this.loadError.set('The specialization data returned by the API is incomplete.');
          }
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.loadError.set(this.toLoadErrorMessage(error));
        },
      });
  }

  retry(): void {
    this.load();
  }

  goBack(): void {
    void this.router.navigate(['/specializations']);
  }

  enterEdit(): void {
    const current = this.specialization();

    if (current === null) {
      return;
    }

    this.writeState = { specializationId: current.id, createdServiceIds: [] };
    this.isEditMode.set(true);
  }

  onSubmitted(value: SpecializationFormValue): void {
    const current = this.specialization();

    if (current === null || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);

    this.writer
      .update(current.id, value, this.writeState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.writeState = state;
          this.isSaving.set(false);
          this.specialization.set({
            ...current,
            name: value.name,
            status: value.status,
          });
          this.isEditMode.set(false);
          this.notifications.showSuccess('Specialization updated successfully');
          this.load(true);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);

          const partialState = writeStateFromError(error);

          if (partialState !== null) {
            this.writeState = partialState;
          }

          this.notifications.showError(
            this.toErrorMessage(error, 'Could not save the specialization. Please try again.'),
          );
        },
      });
  }

  onCancelled(): void {
    const dialogRef = this.dialog.open<boolean, CancelConfirmDialogData>(
      CancelConfirmDialogComponent,
      {
        data: { message: CANCEL_EDIT_DIALOG_MESSAGE },
        disableClose: true,
        ariaLabelledBy: 'cancel-confirm-dialog-message',
        restoreFocus: true,
      },
    );

    dialogRef.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed === true) {
        this.writeState = EMPTY_WRITE_SESSION;
        this.isEditMode.set(false);
      }
    });
  }

  /**
   * Immediate status change in View mode: optimistic update, rolled back on failure.
   * Edit mode keeps the status inside the form and persists it with "Save changes".
   */
  changeStatus(next: SpecializationStatus): void {
    const current = this.specialization();

    if (current === null || current.status === next || this.statusSaving() || this.isEditMode()) {
      return;
    }

    const previous = current.status;
    this.specialization.set({ ...current, status: next });
    this.statusSaving.set(true);

    this.specializationsApi
      .specializationIdStatusPatch({
        id: current.id,
        body: toSpecializationStatusRequest(next),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.statusSaving.set(false);
          this.notifications.showSuccess('Specialization status updated successfully');
        },
        error: (error: unknown) => {
          this.statusSaving.set(false);
          this.specialization.set({ ...current, status: previous });
          this.notifications.showError(
            this.toErrorMessage(
              error,
              'Could not update the specialization status. Please try again.',
            ),
          );
        },
      });
  }

  private toLoadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return SPECIALIZATION_NOT_FOUND_MESSAGE;
    }

    return this.toErrorMessage(error, 'Could not load the specialization. Please try again.');
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    const cause = unwrapWriteError(error);

    if (cause instanceof HttpErrorResponse) {
      return extractErrorMessage(cause);
    }

    return fallback;
  }
}
