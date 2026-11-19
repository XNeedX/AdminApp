import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';

import { NotificationService } from '../../../../core/services/notification.service';
import { AppDialogService } from '../../../../shared/components/app-dialog/app-dialog.service';
import { ReceptionistCreateDialogComponent } from '../../components/receptionist-create-dialog/receptionist-create-dialog.component';
import { ReceptionistTableComponent } from '../../components/receptionist-table/receptionist-table.component';
import {
  CONFIRM_NO_LABEL,
  CONFIRM_YES_LABEL,
  DELETE_DIALOG_MESSAGE,
  ReceptionistCreateDialogResult,
} from '../../models/receptionist-dialog.model';
import { ReceptionistRow } from '../../models/receptionist.model';
import { ReceptionistDirectoryStore } from '../../services/receptionist-directory.store';
import { ReceptionistPhotoService } from '../../services/receptionist-photo.service';

/** Receptionist workspace: list, create, open and delete receptionists. */
@Component({
  selector: 'app-receptionists-page',
  standalone: true,
  imports: [ReceptionistTableComponent],
  templateUrl: './receptionists-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionistsPageComponent implements OnInit {
  private readonly directory = inject(ReceptionistDirectoryStore);
  private readonly photos = inject(ReceptionistPhotoService);
  private readonly dialog = inject(Dialog);
  private readonly dialogs = inject(AppDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = this.directory.rows;
  protected readonly isLoading = this.directory.isLoading;
  protected readonly loadError = this.directory.loadError;
  protected readonly deletingId = this.directory.deletingId;

  ngOnInit(): void {
    void this.directory.loadAll();
  }

  protected reload(): void {
    void this.directory.loadAll();
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open<ReceptionistCreateDialogResult>(
      ReceptionistCreateDialogComponent,
      {
        disableClose: true,
        ariaLabel: 'Create receptionist',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        width: 'min(48rem, calc(100vw - 2rem))',
        maxHeight: '90vh',
      },
    );

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.created !== null && result?.created !== undefined) {
        this.notifications.showSuccess(`Receptionist ${result.created.fullName} was created.`);
        void this.directory.loadAll();
      }
    });
  }

  protected openProfile(id: string): void {
    void this.router.navigate(['/receptionists', id, 'profile']);
  }

  protected async requestDelete(row: ReceptionistRow): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'Delete receptionist',
      message: DELETE_DIALOG_MESSAGE,
      confirmText: CONFIRM_YES_LABEL,
      cancelText: CONFIRM_NO_LABEL,
    });

    if (!confirmed) {
      return;
    }

    const deleted = await this.directory.delete(row.id);

    if (!deleted) {
      this.notifications.showError(
        this.directory.deleteError() ?? 'The receptionist could not be deleted.',
      );
      return;
    }

    this.notifications.showSuccess('Receptionist deleted.');

    if (row.photoPath !== null) {
      void this.photos.delete(row.photoPath).catch(() => undefined);
    }
  }
}
